#!/usr/bin/env bash
# bootstrap-server.sh <server-address> [--check]
#
# One-time (and safely repeatable) setup of the STAGING server, run as root on Ubuntu 22.04 or 24.04:
#
#   sudo DEPLOY_PUBLIC_KEY="$(cat deploy-key.pub)" bash bootstrap-server.sh 138.197.70.66
#
# What it does (details in README "Staging server setup"):
#   users       complystart (runs the app, no login) and complystart-deploy (receives releases over SSH)
#   layout      /opt/compinabox/{releases,incoming,data/{uploads,evidence,outbox},backups}, .env (600)
#   software    Node 22, PostgreSQL 16 (localhost only), Caddy, ufw (22/80/443 + the SSH port in use)
#   app         database + role, /opt/compinabox/.env with RANDOM secrets, systemd units and timers,
#               Caddyfile, a narrow sudoers entry for the deploy user
#
# Safe by design:
#   * Preflight first. If the server is not what this script understands (another OS, something already
#     on ports 80/443 that is not our Caddy, another PostgreSQL, another Node major, a non-empty
#     /opt/compinabox that is not ours, an existing database without its .env), it prints WHY and
#     changes NOTHING.
#   * Idempotent: every step checks the current state first. A second run prints "no changes" and
#     touches nothing. An existing .env is never rewritten (new secrets would make the stored
#     whistleblower data unreadable).
#   * Secrets are generated here, on the server. The only secret printed is the dev-outbox password, once,
#     when .env is created. Nothing is downloaded and piped to a shell; apt repositories are added with
#     their signing keys.
#   * --check: run the preflight and report what would change, then stop.
#
# Test hook (used by scripts/test-bootstrap.sh): BOOTSTRAP_ROOT prefixes every path that is written.
set -euo pipefail
umask 022

SITE_HOST=${1:-}
CHECK_ONLY=0
[ "${2:-}" = "--check" ] && CHECK_ONLY=1
if [ -z "$SITE_HOST" ] || [ "$SITE_HOST" = "--check" ]; then
  echo "usage: bootstrap-server.sh <server-ip-or-host> [--check]" >&2; exit 2
fi
[[ "$SITE_HOST" =~ ^[A-Za-z0-9.-]+$ ]] || { echo "bootstrap: the address may only contain letters, digits, dots and dashes" >&2; exit 2; }

R=${BOOTSTRAP_ROOT:-}
APP_ROOT="$R/opt/compinabox"
OPS_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
APP_PORT=3000
APP_USER=complystart
DEPLOY_USER=complystart-deploy
DB_NAME=complystart
MARKER="$APP_ROOT/.compinabox-bootstrap"

CHANGES=0
say()     { printf '%s\n' "$*"; }
changed() { CHANGES=$((CHANGES + 1)); say "  CHANGED: $*"; }
same()    { say "  unchanged: $*"; }
step()    { printf '\n== %s\n' "$*"; }

# --- helpers -----------------------------------------------------------------------------------
mem_mb()  { if [ -n "${BS_RAM_MB:-}" ]; then echo "$BS_RAM_MB"; else awk '/^MemTotal:/ {print int($2/1024)}' /proc/meminfo; fi; }
os_field() { ( . "$R/etc/os-release" 2>/dev/null && eval "printf '%s' \"\${$1:-}\"" ); }
pkg_installed() { dpkg -s "$1" >/dev/null 2>&1; }
have() { command -v "$1" >/dev/null 2>&1; }
psql_su() { runuser -u postgres -- psql -v ON_ERROR_STOP=1 -Atq "$@"; }

# Under the test hook (BOOTSTRAP_ROOT) the test users do not exist, so ownership is not compared there.
owner_is() { [ -n "$R" ] || [ "$(stat -c '%U:%G' "$1")" = "$2" ]; }

# put_file <src> <dst> <mode> <owner:group>  -> sets FILE_CHANGED=1/0
put_file() {
  local src=$1 dst=$2 mode=$3 own=$4
  FILE_CHANGED=0
  if [ -f "$dst" ] && cmp -s "$src" "$dst" && [ "$(stat -c '%a' "$dst")" = "$mode" ] && owner_is "$dst" "$own"; then
    same "$dst"; return 0
  fi
  install -D -m "$mode" "$src" "$dst"
  chown "$own" "$dst"
  changed "$dst"; FILE_CHANGED=1
}
# ensure_dir <path> <mode> <owner:group>
ensure_dir() {
  local d=$1 mode=$2 own=$3
  if [ -d "$d" ] && [ "$(stat -c '%a' "$d")" = "$mode" ] && owner_is "$d" "$own"; then same "$d"; return 0; fi
  install -d -m "$mode" "$d"; chmod "$mode" "$d"; chown "$own" "$d"
  changed "$d (mode $mode, $own)"
}
listeners() { ss -ltnpH 2>/dev/null; }                 # one line per listening TCP socket
port_owner_lines() { listeners | awk -v p=":$1" '$4 ~ p"$" {print}'; }

# --- 1. preflight (changes nothing) ------------------------------------------------------------
step "Preflight"
PROBLEMS=()
RAM_MB=$(mem_mb)
HEAP_MB=$(( RAM_MB * 60 / 100 )); [ "$HEAP_MB" -lt 384 ] && HEAP_MB=384; [ "$HEAP_MB" -gt 2048 ] && HEAP_MB=2048
say "  RAM found: ${RAM_MB} MB -> Node heap limit ${HEAP_MB} MB"
[ "$RAM_MB" -lt 2000 ] && say "  WARNING: under 2 GB of RAM. The app will run, but generating the dossier (PDF) is limited and may fail for large companies."

[ "$(id -u)" -eq 0 ] || PROBLEMS+=("run this as root (sudo).")
if [ "$(os_field ID)" != "ubuntu" ] || { [ "$(os_field VERSION_ID)" != "22.04" ] && [ "$(os_field VERSION_ID)" != "24.04" ]; }; then
  PROBLEMS+=("this script supports Ubuntu 22.04 and 24.04 only; found: $(os_field PRETTY_NAME).")
fi
for cmd in apt-get dpkg systemctl curl openssl ss install runuser useradd gpg; do
  have "$cmd" || PROBLEMS+=("the command '$cmd' is missing (install it first: apt-get install -y curl gnupg openssl iproute2).")
done
AVAIL_MB=$(df -Pm "${R:-/}" 2>/dev/null | awk 'NR==2 {print $4}')
[ "${AVAIL_MB:-0}" -ge 3000 ] || PROBLEMS+=("less than 3 GB of free disk space (${AVAIL_MB:-?} MB).")

for port in 80 443; do
  lines=$(port_owner_lines "$port" || true)
  if [ -n "$lines" ] && ! grep -q '"caddy"' <<<"$lines"; then
    PROBLEMS+=("port $port is already in use by something that is not Caddy: $(tr -s ' ' <<<"$lines" | head -1 | cut -c1-160). Stop it or tell the person who set up this server; nothing was changed.")
  fi
done
if [ -n "$(port_owner_lines 5432 || true)" ] && ! pkg_installed postgresql-16; then
  PROBLEMS+=("port 5432 is in use and PostgreSQL 16 is not ours: another database server is running here.")
fi
if have pg_lsclusters && pg_lsclusters --no-header 2>/dev/null | awk '{print $1}' | grep -qvx 16; then
  PROBLEMS+=("a PostgreSQL cluster of another version exists (pg_lsclusters). This script only manages version 16 and will not touch others.")
fi
if have node; then
  NODE_MAJOR=$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo "?")
  [ "$NODE_MAJOR" = "22" ] || PROBLEMS+=("Node.js $NODE_MAJOR is installed; this script installs Node 22 and will not replace another major that other software may need.")
fi
if [ -d "$APP_ROOT" ] && [ ! -f "$MARKER" ] && [ -n "$(ls -A "$APP_ROOT" 2>/dev/null)" ]; then
  PROBLEMS+=("$APP_ROOT exists, is not empty and was not created by this script.")
fi
if [ ! -f "$APP_ROOT/.env" ] && pkg_installed postgresql-16 && [ "$(id -u)" -eq 0 ] && \
   [ "$(psql_su -d "$DB_NAME" -c "select count(*) from information_schema.tables where table_schema='public'" 2>/dev/null || echo 0)" -gt 0 ]; then
  PROBLEMS+=("database '$DB_NAME' already has tables but $APP_ROOT/.env is missing. Generating new secrets would make its encrypted data unreadable; restore the old .env instead.")
fi
for f in Caddyfile complystart-migrate sudoers-complystart-deploy systemd/complystart.service systemd/complystart-backup.service systemd/complystart-backup.timer systemd/complystart-maintenance.service systemd/complystart-maintenance.timer; do
  [ -f "$OPS_DIR/$f" ] || PROBLEMS+=("$OPS_DIR/$f is missing: copy the whole ops/ folder to the server.")
done

if [ "${#PROBLEMS[@]}" -gt 0 ]; then
  say ""; say "NOT CONTINUING. Nothing was changed. Reasons:"
  for p in "${PROBLEMS[@]}"; do say "  - $p"; done
  exit 1
fi
say "  all checks passed"
if [ "$CHECK_ONLY" = 1 ]; then say ""; say "--check: stopping here; nothing was changed."; exit 0; fi

# --- 2. software -------------------------------------------------------------------------------
step "Software"
export DEBIAN_FRONTEND=noninteractive
APT_UPDATED=0
apt_update_once() { if [ "$APT_UPDATED" = 0 ]; then apt-get update -qq; APT_UPDATED=1; fi; }
apt_need() { # apt_need <pkg...>: install the ones that are missing
  local missing=() p
  for p in "$@"; do pkg_installed "$p" || missing+=("$p"); done
  if [ "${#missing[@]}" -gt 0 ]; then apt_update_once; apt-get install -y -qq "${missing[@]}" >/dev/null; changed "installed ${missing[*]}"; else same "packages $*"; fi
}
add_repo() { # add_repo <name> <key-url> <deb-line>: signed-by apt repository (key fetched over https, dearmored)
  local name=$1 key=$2 line=$3
  local keyfile="$R/etc/apt/keyrings/$name.gpg" list="$R/etc/apt/sources.list.d/$name.list"
  if [ -f "$keyfile" ] && [ -f "$list" ]; then same "apt repository $name"; return 0; fi
  install -d -m 0755 "$R/etc/apt/keyrings" "$R/etc/apt/sources.list.d"
  curl -fsSL "$key" | gpg --dearmor -o "$keyfile"
  chmod 0644 "$keyfile"
  printf '%s\n' "$line" > "$list"
  APT_UPDATED=0
  changed "apt repository $name"
}
CODENAME=$(os_field VERSION_CODENAME)

apt_need ca-certificates curl gnupg openssl ufw iproute2

if have node && [ "$(node -p 'process.versions.node.split(".")[0]')" = 22 ]; then same "Node $(node -v)"; else
  add_repo nodesource https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key \
    "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_22.x nodistro main"
  apt_need nodejs
fi

if ! pkg_installed postgresql-16; then
  apt_update_once
  if ! apt-cache policy postgresql-16 2>/dev/null | grep -q 'Candidate: [0-9]'; then
    add_repo pgdg https://www.postgresql.org/media/keys/ACCC4CF8.asc \
      "deb [signed-by=/etc/apt/keyrings/pgdg.gpg] https://apt.postgresql.org/pub/repos/apt ${CODENAME}-pgdg main"
    apt_update_once
  fi
fi
apt_need postgresql-16 postgresql-client-16

if ! pkg_installed caddy; then
  add_repo caddy https://dl.cloudsmith.io/public/caddy/stable/gpg.key \
    "deb [signed-by=/etc/apt/keyrings/caddy.gpg] https://dl.cloudsmith.io/public/caddy/stable/deb/debian any-version main"
fi
apt_need caddy

# --- 3. users and directories -------------------------------------------------------------------
step "Users and directories"
if id "$APP_USER" >/dev/null 2>&1; then same "user $APP_USER"; else
  useradd --system --user-group --home-dir "$APP_ROOT" --no-create-home --shell /usr/sbin/nologin "$APP_USER"; changed "user $APP_USER (no login)"
fi
if id "$DEPLOY_USER" >/dev/null 2>&1; then same "user $DEPLOY_USER"; else
  useradd --create-home --shell /bin/bash --gid "$APP_USER" "$DEPLOY_USER"; passwd -l "$DEPLOY_USER" >/dev/null; changed "user $DEPLOY_USER (key login only)"
fi
SSH_DIR="$R/home/$DEPLOY_USER/.ssh"
if [ ! -d "$SSH_DIR" ] || [ "$(stat -c '%a' "$SSH_DIR")" != "700" ] || ! owner_is "$SSH_DIR" "$DEPLOY_USER:$APP_USER"; then
  install -d -m 0700 "$SSH_DIR"; chown "$DEPLOY_USER:$APP_USER" "$SSH_DIR"; changed "$SSH_DIR"
else same "$SSH_DIR"; fi
AUTH="$SSH_DIR/authorized_keys"
if [ -n "${DEPLOY_PUBLIC_KEY:-}" ]; then
  if ! [[ "$DEPLOY_PUBLIC_KEY" =~ ^(ssh-ed25519|ssh-rsa|ecdsa-sha2-nistp256)\ [A-Za-z0-9+/=]+(\ [^[:cntrl:]]*)?$ ]]; then
    say "  DEPLOY_PUBLIC_KEY does not look like a single public key line; not added." >&2; exit 1
  fi
  keyline="no-port-forwarding,no-agent-forwarding,no-X11-forwarding,no-pty $DEPLOY_PUBLIC_KEY"
  if [ -f "$AUTH" ] && grep -qxF "$keyline" "$AUTH"; then same "deploy key in $AUTH"; else
    printf '%s\n' "$keyline" >> "$AUTH"; chmod 0600 "$AUTH"; chown "$DEPLOY_USER:$APP_USER" "$AUTH"; changed "deploy key added to $AUTH"
  fi
else
  [ -s "$AUTH" ] && same "authorized_keys present" || say "  note: no DEPLOY_PUBLIC_KEY given and none installed yet: the deploy cannot log in until you add one."
fi

ensure_dir "$APP_ROOT" 750 "$DEPLOY_USER:$APP_USER"
ensure_dir "$APP_ROOT/releases" 750 "$DEPLOY_USER:$APP_USER"
ensure_dir "$APP_ROOT/incoming" 750 "$DEPLOY_USER:$APP_USER"
ensure_dir "$APP_ROOT/data" 750 "$APP_USER:$APP_USER"
ensure_dir "$APP_ROOT/data/uploads" 750 "$APP_USER:$APP_USER"
ensure_dir "$APP_ROOT/data/evidence" 700 "$APP_USER:$APP_USER"
ensure_dir "$APP_ROOT/data/outbox" 750 "$APP_USER:$APP_USER"
ensure_dir "$APP_ROOT/backups" 750 "$APP_USER:$APP_USER"
if [ -f "$MARKER" ]; then same "$MARKER"; else printf 'created by ops/bootstrap-server.sh\n' > "$MARKER"; chown "$DEPLOY_USER:$APP_USER" "$MARKER"; changed "$MARKER"; fi

# --- 4. database and .env ----------------------------------------------------------------------
step "Database and .env"
PG_CONF="$R/etc/postgresql/16/main/conf.d/90-complystart.conf"
tmp=$(mktemp); printf "# managed by ops/bootstrap-server.sh\nlisten_addresses = 'localhost'\n" > "$tmp"
put_file "$tmp" "$PG_CONF" 644 postgres:postgres; PG_CONF_CHANGED=$FILE_CHANGED; rm -f "$tmp"
if [ "$PG_CONF_CHANGED" = 1 ]; then systemctl restart postgresql; changed "restarted postgresql (listen on localhost only)"; fi
systemctl enable --now postgresql >/dev/null 2>&1 || true

ENV_FILE="$APP_ROOT/.env"
ENV_CREATED=0
if [ -f "$ENV_FILE" ]; then
  DB_PASS=$(sed -n 's#^DATABASE_URL=[a-z]*://[^:]*:\([^@]*\)@.*#\1#p' "$ENV_FILE" | head -1)
  [ -n "$DB_PASS" ] || { say "  $ENV_FILE exists but has no usable DATABASE_URL; fix it by hand, nothing changed." >&2; exit 1; }
  same "$ENV_FILE (kept as is: secrets are never regenerated)"
else
  DB_PASS=$(openssl rand -hex 24)
fi
role_exists=$(psql_su -c "select 1 from pg_roles where rolname='$APP_USER'" || true)
if [ -z "$role_exists" ]; then
  printf "create role %s login password '%s';\n" "$APP_USER" "$DB_PASS" | psql_su; changed "database role $APP_USER"
elif [ ! -f "$ENV_FILE" ]; then
  printf "alter role %s password '%s';\n" "$APP_USER" "$DB_PASS" | psql_su; changed "database role $APP_USER (new password; there is no .env yet)"
else same "database role $APP_USER"; fi
db_exists=$(psql_su -c "select 1 from pg_database where datname='$DB_NAME'" || true)
if [ -z "$db_exists" ]; then psql_su -c "create database $DB_NAME owner $APP_USER"; changed "database $DB_NAME"; else same "database $DB_NAME"; fi

if [ ! -f "$ENV_FILE" ]; then
  OUTBOX_PW=$(openssl rand -base64 18 | tr -dc 'A-Za-z0-9' | head -c 20)
  S_AUTH=$(openssl rand -base64 32)
  tmp=$(mktemp); chmod 600 "$tmp"
  cat > "$tmp" <<ENVEOF
# STAGING server settings. Generated by ops/bootstrap-server.sh on $(date -u +%Y-%m-%dT%H:%M:%SZ).
# Mode 600, owned by $APP_USER, never in git. Do not paste it anywhere. APP_ENV=staging means: test data only.
APP_ENV=staging
NODE_ENV=production
PORT=$APP_PORT
HOSTNAME=127.0.0.1
APP_URL=https://$SITE_HOST
AUTH_URL=https://$SITE_HOST
AUTH_SECRET=$S_AUTH
DATABASE_URL=postgres://$APP_USER:$DB_PASS@127.0.0.1:5432/$DB_NAME
ENABLED_COUNTRIES=br
# Fake payments and the e-mail sink are allowed on staging only; the app refuses to start with them in production.
PAYMENT_PROVIDER=fake
ALLOW_FAKE_PAYMENTS=true
FAKE_PAYMENTS_SECRET=$(openssl rand -hex 24)
EMAIL_DEV_SINK=true
EMAIL_SINK_DIR=$APP_ROOT/data/outbox
DEV_OUTBOX_PASSWORD=$OUTBOX_PW
# Whistleblower data at rest. LOSING THIS KEY MAKES THE STORED REPORTS UNREADABLE. Staging data is fictitious,
# but keep the habit: this key must be backed up separately from the database before production.
REPORT_ENCRYPTION_KEYS=k1:$(openssl rand -base64 32)
EVIDENCE_DIR=$APP_ROOT/data/evidence
UPLOADS_DIR=$APP_ROOT/data/uploads
BINDER_CONCURRENCY=1
NEXT_TELEMETRY_DISABLED=1
BACKUP_DEST=local:$APP_ROOT/backups
BACKUP_KEEP_DAYS=14
# No analytics on staging.
GTM_ID=
ENVEOF
  put_file "$tmp" "$ENV_FILE" 600 "$APP_USER:$APP_USER"; rm -f "$tmp"
  ENV_CREATED=1
fi

# --- 5. systemd, Caddy, sudo -------------------------------------------------------------------
step "Services"
UNIT_DIR="$R/etc/systemd/system"
UNITS_CHANGED=0
for u in complystart.service complystart-backup.service complystart-backup.timer complystart-maintenance.service complystart-maintenance.timer; do
  put_file "$OPS_DIR/systemd/$u" "$UNIT_DIR/$u" 644 root:root; [ "$FILE_CHANGED" = 1 ] && UNITS_CHANGED=1
done
tmp=$(mktemp); printf '[Service]\nEnvironment=NODE_OPTIONS=--max-old-space-size=%s\n' "$HEAP_MB" > "$tmp"
put_file "$tmp" "$UNIT_DIR/complystart.service.d/10-memory.conf" 644 root:root; [ "$FILE_CHANGED" = 1 ] && UNITS_CHANGED=1; rm -f "$tmp"
if [ "$UNITS_CHANGED" = 1 ]; then systemctl daemon-reload; changed "systemd reloaded"; fi
systemctl is-enabled complystart.service >/dev/null 2>&1 && same "complystart.service enabled" || { systemctl enable complystart.service >/dev/null 2>&1; changed "enabled complystart.service (starts after the first deploy)"; }
for t in complystart-backup.timer complystart-maintenance.timer; do
  systemctl is-enabled "$t" >/dev/null 2>&1 && same "$t enabled" || { systemctl enable --now "$t" >/dev/null 2>&1; changed "enabled $t"; }
done

put_file "$OPS_DIR/complystart-migrate" "$R/usr/local/sbin/complystart-migrate" 755 root:root
tmp=$(mktemp); cp "$OPS_DIR/sudoers-complystart-deploy" "$tmp"
if [ -f "$R/etc/sudoers.d/complystart-deploy" ] && cmp -s "$tmp" "$R/etc/sudoers.d/complystart-deploy"; then same "sudoers entry"; else
  visudo -cf "$tmp" >/dev/null || { say "  the sudoers entry did not validate; not installed." >&2; rm -f "$tmp"; exit 1; }
  put_file "$tmp" "$R/etc/sudoers.d/complystart-deploy" 440 root:root
fi
rm -f "$tmp"

tmp=$(mktemp); sed -e "s#__SITE_ADDRESS__#https://$SITE_HOST#" -e "s#__APP_PORT__#$APP_PORT#" "$OPS_DIR/Caddyfile" > "$tmp"
if have caddy; then caddy validate --config "$tmp" --adapter caddyfile >/dev/null 2>&1 || { say "  the generated Caddyfile did not validate; not installed." >&2; rm -f "$tmp"; exit 1; }; fi
put_file "$tmp" "$R/etc/caddy/Caddyfile" 644 root:root; CADDY_CHANGED=$FILE_CHANGED; rm -f "$tmp"
if [ "$CADDY_CHANGED" = 1 ]; then systemctl enable caddy >/dev/null 2>&1 || true; systemctl restart caddy; changed "caddy restarted with the new Caddyfile"
else systemctl is-active caddy >/dev/null 2>&1 && same "caddy running" || { systemctl enable --now caddy >/dev/null 2>&1; changed "caddy started"; }; fi

# --- 6. firewall ---------------------------------------------------------------------------------
step "Firewall (ufw)"
SSH_PORTS=$(listeners | awk '/"sshd"/ {n=split($4,a,":"); print a[n]}' | sort -u)
[ -n "$SSH_PORTS" ] || SSH_PORTS=22
UFW_STATUS=$(ufw status 2>/dev/null || true)
need_rule() { ! grep -qE "^$1/tcp +ALLOW" <<<"$UFW_STATUS"; }
for p in $SSH_PORTS 80 443; do
  if need_rule "$p"; then ufw allow "$p/tcp" >/dev/null; changed "ufw allow $p/tcp"; else same "ufw allow $p/tcp"; fi
done
if grep -q '^Status: active' <<<"$UFW_STATUS"; then same "ufw active"; else ufw --force enable >/dev/null; changed "ufw enabled"; fi

# --- 7. report ---------------------------------------------------------------------------------
step "Summary"
if [ "$CHANGES" -eq 0 ]; then say "  no changes: this server was already set up."; else say "  $CHANGES change(s) made."; fi
say "  RAM: ${RAM_MB} MB; Node heap limit: ${HEAP_MB} MB; binder concurrency: 1"
if [ "$ENV_CREATED" = 1 ]; then
  say ""
  say "  THE DEV-OUTBOX PASSWORD (shown once; it is also in $ENV_FILE, readable by root):"
  say "      user: outbox"
  say "      password: $OUTBOX_PW"
  say "  Add it as the GitHub secret DEV_OUTBOX_PASSWORD so the deploy's smoke test can read the outbox."
fi
cat <<NEXT

Next steps:
  1. Add the four GitHub secrets (DEPLOY_HOST, DEPLOY_USER, DEPLOY_SSH_KEY, DEPLOY_KNOWN_HOSTS) and
     DEV_OUTBOX_PASSWORD (README "Staging server setup").
  2. Run the "Deploy staging" workflow (Actions tab -> Run workflow). The site answers only after it.
  3. Then open https://$SITE_HOST/br (accept the browser warning once: the certificate is self-made).
NEXT
