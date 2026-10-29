#!/usr/bin/env bash
# bootstrap-server.sh <server-address> [options]
#
# One-time (and safely repeatable) setup of the STAGING server, run as root on Ubuntu 22.04 or 24.04.
# ALWAYS start with the dry run and read what it found:
#
#   sudo bash bootstrap-server.sh 138.197.70.66 --check
#
# and only then (after the person responsible has looked at the report):
#
#   sudo DEPLOY_PUBLIC_KEY="$(cat deploy-key.pub)" bash bootstrap-server.sh 138.197.70.66 --yes
#
# Options
#   --check                   print the "what I found" report and the verdict, change NOTHING
#   --yes                     required to change anything (a run without it behaves like --check)
#   --https-port N            public HTTPS port (default 443, or the one chosen on the first run)
#   --http-port N             public HTTP port (default 80); --no-http turns the HTTP listener off
#   --app-port N              port of the app on 127.0.0.1 (default: the first free port >= 3100;
#                             never 3000 or 8080)
#   --use-existing-postgres   create ONLY our role and database inside the PostgreSQL that is already
#                             running (major version >= 15); touches nothing else in that cluster.
#                             Without it, an existing PostgreSQL makes the script stop.
#
# What it does (details in README "Staging server setup"):
#   users       complystart (runs the app, no login) and complystart-deploy (receives releases over SSH)
#   layout      /opt/compinabox/{releases,incoming,data/{uploads,evidence,outbox},backups}, .env (600)
#   software    Node 22, PostgreSQL 16 on localhost (or our own role+db in an existing cluster), Caddy
#   app         database + role, /opt/compinabox/.env with RANDOM secrets, systemd units and timers,
#               Caddyfile, a narrow sudoers entry for the deploy user, firewall rules for OUR ports only
#
# Safe by design:
#   * Preflight first. If the server is not what this script understands (another OS, a public port held
#     by something that is not our Caddy, an existing PostgreSQL without --use-existing-postgres, another
#     Node major, a Caddy configuration that is not ours, a non-empty /opt/compinabox that is not ours, an
#     existing database without its .env), it prints WHY and changes NOTHING.
#   * It never stops, kills, reloads or edits another service or another site's configuration, and never
#     takes a port another service owns.
#   * Idempotent: every step checks the current state first. A second run prints "no changes" and touches
#     nothing. An existing .env is never rewritten (new secrets would make stored data unreadable). The
#     ports chosen on the first run are remembered and reused.
#   * Secrets are generated here, on the server. The only secret printed is the dev-outbox password, once,
#     when .env is created. Apt repositories are added with their signing keys; nothing is piped to a shell.
#
# Test hook (used by tests/ops-bootstrap.test.ts): BOOTSTRAP_ROOT prefixes every path that is written.
set -euo pipefail
umask 022

SITE_HOST=""
CHECK_ONLY=0; YES=0; NO_HTTP=0; USE_EXISTING_PG=0
HTTPS_PORT_ARG=""; HTTP_PORT_ARG=""; APP_PORT_ARG=""
usage() { echo "usage: bootstrap-server.sh <server-ip-or-host> [--check] [--yes] [--https-port N] [--http-port N | --no-http] [--app-port N] [--use-existing-postgres]" >&2; exit 2; }
while [ "$#" -gt 0 ]; do
  case "$1" in
    --check) CHECK_ONLY=1 ;;
    --yes) YES=1 ;;
    --no-http) NO_HTTP=1 ;;
    --use-existing-postgres) USE_EXISTING_PG=1 ;;
    --https-port) [ "$#" -ge 2 ] || usage; HTTPS_PORT_ARG=$2; shift ;;
    --http-port) [ "$#" -ge 2 ] || usage; HTTP_PORT_ARG=$2; shift ;;
    --app-port) [ "$#" -ge 2 ] || usage; APP_PORT_ARG=$2; shift ;;
    -*) usage ;;
    *) [ -z "$SITE_HOST" ] || usage; SITE_HOST=$1 ;;
  esac
  shift
done
[ -n "$SITE_HOST" ] || usage
[[ "$SITE_HOST" =~ ^[A-Za-z0-9.-]+$ ]] || { echo "bootstrap: the address may only contain letters, digits, dots and dashes" >&2; exit 2; }
for v in "$HTTPS_PORT_ARG" "$HTTP_PORT_ARG" "$APP_PORT_ARG"; do
  [ -z "$v" ] || { [[ "$v" =~ ^[0-9]{2,5}$ ]] && [ "$v" -ge 1 ] && [ "$v" -le 65535 ]; } || { echo "bootstrap: ports must be numbers between 1 and 65535" >&2; exit 2; }
done
[ "$NO_HTTP" = 0 ] || [ -z "$HTTP_PORT_ARG" ] || { echo "bootstrap: --http-port and --no-http contradict each other" >&2; exit 2; }
[ "$CHECK_ONLY" = 1 ] || [ "$YES" = 1 ] || CHECK_ONLY=2   # no --yes: report, then stop (below)

R=${BOOTSTRAP_ROOT:-}
APP_ROOT="$R/opt/compinabox"
OPS_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
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
listeners() { ss -ltnpH 2>/dev/null; }                 # one line per listening TCP socket, with the owning process
port_lines() { listeners | awk -v p=":$1" '$4 ~ p"$" {print}'; }
owner_names() { sed -n 's/.*users:((\("[^"]*"\).*/\1/p' | tr -d '"' | sort -u | tr '\n' ' ' | sed 's/ *$//'; }
marker_get() { [ -f "$MARKER" ] && sed -n "s/^$1=//p" "$MARKER" | head -1 || true; }
first_free_port() { # first_free_port <from>: not listening, not 3000/8080, not one of ours
  local p=$1
  while [ "$p" = 3000 ] || [ "$p" = 8080 ] || [ -n "$(port_lines "$p")" ] || [ "$p" = "${HTTPS_PORT:-0}" ] || [ "$p" = "${HTTP_PORT:-0}" ]; do p=$((p + 1)); done
  echo "$p"
}
svc_state() { systemctl is-active "$1" 2>/dev/null || true; }

# --- 1. what I found, and the verdict (changes nothing) -----------------------------------------
step "What I found"
PROBLEMS=()
RAM_MB=$(mem_mb)
SWAP_MB=$(awk '/^SwapTotal:/ {print int($2/1024)}' /proc/meminfo 2>/dev/null || echo 0)
HEAP_MB=$(( RAM_MB * 40 / 100 )); [ "$HEAP_MB" -lt 384 ] && HEAP_MB=384; [ "$HEAP_MB" -gt 1536 ] && HEAP_MB=1536
AVAIL_MB=$(df -Pm "${R:-/}" 2>/dev/null | awk 'NR==2 {print $4}')
say "  OS:            $(os_field PRETTY_NAME)"
say "  RAM / swap:    ${RAM_MB} MB / ${SWAP_MB:-0} MB   (Node heap limit chosen: ${HEAP_MB} MB = 40% of RAM, bounded 384..1536)"
say "  free disk:     ${AVAIL_MB:-?} MB"
say "  listeners (address -> process):"
if [ -n "$(listeners || true)" ]; then listeners | awk '{print $4}' | sort -u | while read -r addr; do
  who=$(port_lines "${addr##*:}" | owner_names); say "    $addr -> ${who:-(owner not visible)}"; done
else say "    (none, or ss cannot list them)"; fi
say "  software:      node $(node -v 2>/dev/null || echo none); caddy $(have caddy && caddy version 2>/dev/null | head -1 | cut -d' ' -f1 || echo none); nginx $(have nginx && nginx -v 2>&1 | sed 's/.*\///' || echo none); apache2 $(have apache2 && apache2 -v 2>/dev/null | sed -n '1s/.*\///p' || echo none); psql $(have psql && psql --version | awk '{print $3}' || echo none)"
say "  services:      caddy=$(svc_state caddy) nginx=$(svc_state nginx) apache2=$(svc_state apache2) postgresql=$(svc_state postgresql)"
say "  PostgreSQL clusters: $( (have pg_lsclusters && pg_lsclusters --no-header 2>/dev/null | awk '{printf "%s/%s(port %s) ", $1,$2,$3}') || true)"
say "  firewall:      $(have ufw && ufw status 2>/dev/null | head -1 || echo 'ufw not installed')"
say "  existing:      user $APP_USER: $(id "$APP_USER" >/dev/null 2>&1 && echo yes || echo no); user $DEPLOY_USER: $(id "$DEPLOY_USER" >/dev/null 2>&1 && echo yes || echo no); $APP_ROOT: $([ -d "$APP_ROOT" ] && echo present || echo absent)"
[ "$RAM_MB" -lt 2000 ] && say "  WARNING: under 2 GB of RAM. The app will run, but generating the dossier (PDF) is limited and may fail for large companies; BINDER_CONCURRENCY stays 1."
PUBLIC_OTHER=$(listeners | awk '$4 !~ /^(127\.|\[::1\]|::1)/ {print}' | grep -v '"sshd"' || true)
PG_PUBLIC=$(port_lines 5432 | awk '$4 !~ /^(127\.|\[::1\])/ {print}' || true)
[ -n "$PG_PUBLIC" ] && say "  WARNING: a PostgreSQL is listening on a PUBLIC address (port 5432). It is reachable from the internet unless a firewall (ufw or the DigitalOcean cloud firewall) blocks it. Check this whatever you decide."

# ports: arguments, else what an earlier run chose, else defaults
HTTPS_PORT=${HTTPS_PORT_ARG:-$(marker_get https_port)}; HTTPS_PORT=${HTTPS_PORT:-443}
if [ "$NO_HTTP" = 1 ]; then HTTP_PORT=0
elif [ -n "$HTTP_PORT_ARG" ]; then HTTP_PORT=$HTTP_PORT_ARG
else HTTP_PORT=$(marker_get http_port); HTTP_PORT=${HTTP_PORT:-80}; [ "$HTTP_PORT" != off ] || HTTP_PORT=0; fi
APP_PORT=${APP_PORT_ARG:-$(marker_get app_port)}
[ -n "$APP_PORT" ] || APP_PORT=$(first_free_port 3100)
say "  chosen:        https ${HTTPS_PORT}; http $([ "$HTTP_PORT" = 0 ] && echo off || echo "$HTTP_PORT"); app 127.0.0.1:${APP_PORT}"

[ "$(id -u)" -eq 0 ] || PROBLEMS+=("run this as root (sudo) so that every listener and its owner can be seen.")
if [ "$(os_field ID)" != "ubuntu" ] || { [ "$(os_field VERSION_ID)" != "22.04" ] && [ "$(os_field VERSION_ID)" != "24.04" ]; }; then
  PROBLEMS+=("this script supports Ubuntu 22.04 and 24.04 only; found: $(os_field PRETTY_NAME). Interim releases such as 25.04 are past end of life and get no security updates: rebuild on 24.04 LTS. Nothing was changed.")
fi
for cmd in apt-get dpkg systemctl curl openssl ss install runuser useradd gpg; do
  have "$cmd" || PROBLEMS+=("the command '$cmd' is missing (install it first: apt-get install -y curl gnupg openssl iproute2).")
done
[ "${AVAIL_MB:-0}" -ge 3000 ] || PROBLEMS+=("less than 3 GB of free disk space (${AVAIL_MB:-?} MB).")

# ports we would use
if [ "$APP_PORT" = 3000 ] || [ "$APP_PORT" = 8080 ] || [ "$APP_PORT" -lt 1024 ]; then PROBLEMS+=("the app port must not be 3000, 8080 or below 1024 (got $APP_PORT).")
elif [ -n "$(port_lines "$APP_PORT")" ] && ! port_lines "$APP_PORT" | grep -q '"node"'; then PROBLEMS+=("app port $APP_PORT is already in use ($(port_lines "$APP_PORT" | owner_names)); pass --app-port with a free port.")
elif [ "$APP_PORT" = "$HTTPS_PORT" ] || [ "$APP_PORT" = "$HTTP_PORT" ]; then PROBLEMS+=("the app port equals a public port.")
fi
check_public_port() { # check_public_port <port> <flag>
  local lines; lines=$(port_lines "$1" || true)
  if [ -n "$lines" ] && ! grep -q '"caddy"' <<<"$lines"; then
    local alt; alt=$(( $1 < 1024 ? 8443 : $1 + 1 )); while [ -n "$(port_lines "$alt")" ] || [ "$alt" = 8080 ] || [ "$alt" = 3000 ]; do alt=$((alt + 1)); done
    PROBLEMS+=("port $1 is already in use by $(owner_names <<<"$lines"), which is not our Caddy. I will not touch it. Choose another port, for example: bash bootstrap-server.sh $SITE_HOST $2 $alt --check")
  fi
}
check_public_port "$HTTPS_PORT" --https-port
[ "$HTTP_PORT" = 0 ] || check_public_port "$HTTP_PORT" --http-port
[ "$HTTP_PORT" = 0 ] || [ "$HTTP_PORT" != "$HTTPS_PORT" ] || PROBLEMS+=("the http and https ports are the same.")

# an existing Caddy configuration that is not ours must not be replaced
if [ -f "$R/etc/caddy/Caddyfile" ] && ! grep -q 'managed-by: complystart-bootstrap' "$R/etc/caddy/Caddyfile" && ! grep -q '/usr/share/caddy' "$R/etc/caddy/Caddyfile"; then
  PROBLEMS+=("an existing Caddy configuration was found in /etc/caddy/Caddyfile and it is not ours. I will not replace it.")
fi

# PostgreSQL: ours, or someone else's
PG_MODE=$(marker_get postgres)
if [ -z "$PG_MODE" ]; then
  PG_FOUND=0
  { [ -n "$(port_lines 5432 || true)" ] || { have pg_lsclusters && [ -n "$(pg_lsclusters --no-header 2>/dev/null)" ]; } || dpkg -l 2>/dev/null | grep -qE '^ii +postgresql-[0-9]+ '; } && PG_FOUND=1
  if [ "$PG_FOUND" = 1 ]; then
    if [ "$USE_EXISTING_PG" = 1 ]; then PG_MODE=existing
    else PROBLEMS+=("found an existing PostgreSQL on this server. I will not install another one next to it or change it. To use it, create only our own role and database inside it, run again with --use-existing-postgres (needs version 15 or newer).") ; fi
  else PG_MODE=installed; fi
fi
PG_PORT=5432
if [ "$PG_MODE" = existing ] && [ "$(id -u)" -eq 0 ]; then
  PGVER=$(psql_su -c "show server_version_num" 2>/dev/null || true)
  if [ -z "$PGVER" ]; then PROBLEMS+=("cannot connect to the existing PostgreSQL as the postgres user (peer authentication).")
  elif [ "$PGVER" -lt 150000 ]; then PROBLEMS+=("the existing PostgreSQL is version $PGVER (needs 15 or newer; our tests run on 16).")
  else PG_PORT=$(psql_su -c "show port" 2>/dev/null || echo 5432); say "  existing PostgreSQL: server_version_num $PGVER, port $PG_PORT (only our role and database would be created)"; fi
fi

if have node; then
  NODE_MAJOR=$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo "?")
  [ "$NODE_MAJOR" = "22" ] || PROBLEMS+=("Node.js $NODE_MAJOR is installed; this script installs Node 22 and will not replace another major that other software may need.")
fi
if [ -d "$APP_ROOT" ] && [ ! -f "$MARKER" ] && [ -n "$(ls -A "$APP_ROOT" 2>/dev/null)" ]; then
  PROBLEMS+=("$APP_ROOT exists, is not empty and was not created by this script.")
fi
if [ ! -f "$APP_ROOT/.env" ] && [ "$PG_MODE" != existing ] && pkg_installed postgresql-16 && [ "$(id -u)" -eq 0 ] && \
   [ "$(psql_su -d "$DB_NAME" -c "select count(*) from information_schema.tables where table_schema='public'" 2>/dev/null || echo 0)" -gt 0 ]; then
  PROBLEMS+=("database '$DB_NAME' already has tables but $APP_ROOT/.env is missing. Generating new secrets would make its encrypted data unreadable; restore the old .env instead.")
fi
for f in Caddyfile complystart-migrate sudoers-complystart-deploy systemd/complystart.service systemd/complystart-backup.service systemd/complystart-backup.timer systemd/complystart-maintenance.service systemd/complystart-maintenance.timer systemd/complystart-reconcile.service systemd/complystart-reconcile.timer; do
  [ -f "$OPS_DIR/$f" ] || PROBLEMS+=("$OPS_DIR/$f is missing: copy the whole ops/ folder to the server.")
done

step "Verdict"
if [ "${#PROBLEMS[@]}" -gt 0 ]; then
  say "NOT READY. Nothing was changed. Reasons:"
  for p in "${PROBLEMS[@]}"; do say "  - $p"; done
  exit 1
fi
say "  ready: nothing found that this script cannot handle."
if [ "$CHECK_ONLY" = 1 ]; then say "  --check: stopping here; nothing was changed."; exit 0; fi
if [ "$CHECK_ONLY" = 2 ]; then
  say "  Nothing was changed: changes need --yes. Read the report above (send it to whoever decides), then run again with --yes."
  exit 3
fi

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

if [ "$PG_MODE" = installed ]; then
  if ! pkg_installed postgresql-16; then
    apt_update_once
    if ! apt-cache policy postgresql-16 2>/dev/null | grep -q 'Candidate: [0-9]'; then
      add_repo pgdg https://www.postgresql.org/media/keys/ACCC4CF8.asc \
        "deb [signed-by=/etc/apt/keyrings/pgdg.gpg] https://apt.postgresql.org/pub/repos/apt ${CODENAME}-pgdg main"
      apt_update_once
    fi
  fi
  apt_need postgresql-16 postgresql-client-16
else
  same "PostgreSQL: using the existing cluster (no package installed, no configuration touched)"
fi

if ! pkg_installed caddy; then
  add_repo caddy https://dl.cloudsmith.io/public/caddy/stable/gpg.key \
    "deb [signed-by=/etc/apt/keyrings/caddy.gpg] https://dl.cloudsmith.io/public/caddy/stable/deb/debian any-version main"
  # The package would start Caddy on port 80 with its stock page the moment it is installed. Not here:
  # it is started only after our Caddyfile (our ports) is in place.
  install -d "$R/usr/sbin"; printf '#!/bin/sh\nexit 101\n' > "$R/usr/sbin/policy-rc.d"; chmod +x "$R/usr/sbin/policy-rc.d"
  apt_need caddy
  rm -f "$R/usr/sbin/policy-rc.d"
else same "package caddy"; fi

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
  if [ -s "$AUTH" ]; then same "authorized_keys present"; else say "  note: no DEPLOY_PUBLIC_KEY given and none installed yet: the deploy cannot log in until you add one."; fi
fi

ensure_dir "$APP_ROOT" 750 "$DEPLOY_USER:$APP_USER"
ensure_dir "$APP_ROOT/releases" 750 "$DEPLOY_USER:$APP_USER"
ensure_dir "$APP_ROOT/incoming" 750 "$DEPLOY_USER:$APP_USER"
ensure_dir "$APP_ROOT/data" 750 "$APP_USER:$APP_USER"
ensure_dir "$APP_ROOT/data/uploads" 750 "$APP_USER:$APP_USER"
ensure_dir "$APP_ROOT/data/evidence" 700 "$APP_USER:$APP_USER"
ensure_dir "$APP_ROOT/data/outbox" 750 "$APP_USER:$APP_USER"
ensure_dir "$APP_ROOT/backups" 750 "$APP_USER:$APP_USER"
# what this script decided, remembered so that a re-run reuses it (ports, PostgreSQL mode)
tmp=$(mktemp)
{ echo "created by ops/bootstrap-server.sh"; echo "https_port=$HTTPS_PORT"; echo "http_port=$([ "$HTTP_PORT" = 0 ] && echo off || echo "$HTTP_PORT")"; echo "app_port=$APP_PORT"; echo "postgres=$PG_MODE"; } > "$tmp"
put_file "$tmp" "$MARKER" 644 "$DEPLOY_USER:$APP_USER"; rm -f "$tmp"
# the deploy script reads the app port from here (it cannot read .env)
tmp=$(mktemp); printf '%s\n' "$APP_PORT" > "$tmp"
put_file "$tmp" "$APP_ROOT/app-port" 644 "$DEPLOY_USER:$APP_USER"; rm -f "$tmp"

# --- 4. database and .env ----------------------------------------------------------------------
step "Database and .env"
if [ "$PG_MODE" = installed ]; then
  PG_CONF="$R/etc/postgresql/16/main/conf.d/90-complystart.conf"
  tmp=$(mktemp); printf "# managed by ops/bootstrap-server.sh\nlisten_addresses = 'localhost'\n" > "$tmp"
  put_file "$tmp" "$PG_CONF" 644 postgres:postgres; PG_CONF_CHANGED=$FILE_CHANGED; rm -f "$tmp"
  if [ "$PG_CONF_CHANGED" = 1 ]; then systemctl restart postgresql; changed "restarted postgresql (listen on localhost only)"; fi
  systemctl enable --now postgresql >/dev/null 2>&1 || true
fi

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
if [ "$PG_MODE" = existing ] && [ -z "${BS_SKIP_PG_LOGIN_CHECK:-}" ]; then
  PGPASSWORD="$DB_PASS" psql -h 127.0.0.1 -p "$PG_PORT" -U "$APP_USER" -d "$DB_NAME" -Atqc 'select 1' >/dev/null 2>&1 \
    || { say "  our role cannot log in over 127.0.0.1:$PG_PORT (the existing cluster's pg_hba.conf does not allow it). I will not edit another cluster's configuration; ask whoever runs it to allow password login for role $APP_USER on database $DB_NAME from 127.0.0.1." >&2; exit 1; }
  same "login as $APP_USER over 127.0.0.1:$PG_PORT works"
fi

if [ "$HTTPS_PORT" = 443 ]; then BASE_URL="https://$SITE_HOST"; else BASE_URL="https://$SITE_HOST:$HTTPS_PORT"; fi
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
APP_URL=$BASE_URL
AUTH_URL=$BASE_URL
AUTH_SECRET=$S_AUTH
DATABASE_URL=postgres://$APP_USER:$DB_PASS@127.0.0.1:$PG_PORT/$DB_NAME
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
for u in complystart.service complystart-backup.service complystart-backup.timer complystart-maintenance.service complystart-maintenance.timer complystart-reconcile.service complystart-reconcile.timer; do
  put_file "$OPS_DIR/systemd/$u" "$UNIT_DIR/$u" 644 root:root; [ "$FILE_CHANGED" = 1 ] && UNITS_CHANGED=1
done
tmp=$(mktemp); printf '[Service]\nEnvironment=NODE_OPTIONS=--max-old-space-size=%s\n' "$HEAP_MB" > "$tmp"
put_file "$tmp" "$UNIT_DIR/complystart.service.d/10-memory.conf" 644 root:root; [ "$FILE_CHANGED" = 1 ] && UNITS_CHANGED=1; rm -f "$tmp"
if [ "$UNITS_CHANGED" = 1 ]; then systemctl daemon-reload; changed "systemd reloaded"; fi
systemctl is-enabled complystart.service >/dev/null 2>&1 && same "complystart.service enabled" || { systemctl enable complystart.service >/dev/null 2>&1; changed "enabled complystart.service (starts after the first deploy)"; }
for t in complystart-backup.timer complystart-maintenance.timer complystart-reconcile.timer; do
  systemctl is-enabled "$t" >/dev/null 2>&1 && same "$t enabled" || { systemctl enable --now "$t" >/dev/null 2>&1; changed "enabled $t"; }
done

put_file "$OPS_DIR/complystart-migrate" "$R/usr/local/sbin/complystart-migrate" 755 root:root
tmp=$(mktemp); cp "$OPS_DIR/sudoers-complystart-deploy" "$tmp"
if [ -f "$R/etc/sudoers.d/complystart-deploy" ] && cmp -s "$tmp" "$R/etc/sudoers.d/complystart-deploy"; then same "sudoers entry"; else
  visudo -cf "$tmp" >/dev/null || { say "  the sudoers entry did not validate; not installed." >&2; rm -f "$tmp"; exit 1; }
  put_file "$tmp" "$R/etc/sudoers.d/complystart-deploy" 440 root:root
fi
rm -f "$tmp"

# Caddyfile: our ports only. (Global options: https_port / http_port / no HTTP listener.)
GLOBAL_PORTS=""
[ "$HTTPS_PORT" = 443 ] || GLOBAL_PORTS+=$'\n\thttps_port '"$HTTPS_PORT"
if [ "$HTTP_PORT" = 0 ]; then GLOBAL_PORTS+=$'\n\tauto_https disable_redirects'
elif [ "$HTTP_PORT" != 80 ]; then GLOBAL_PORTS+=$'\n\thttp_port '"$HTTP_PORT"; fi
SITE_ADDRESS="https://$SITE_HOST"; [ "$HTTPS_PORT" = 443 ] || SITE_ADDRESS="$SITE_ADDRESS:$HTTPS_PORT"
tmp=$(mktemp)
awk -v ports="$GLOBAL_PORTS" -v site="$SITE_ADDRESS" -v app="$APP_PORT" '
  { gsub(/__SITE_ADDRESS__/, site); gsub(/__APP_PORT__/, app) }
  /^[ \t]*__GLOBAL_PORTS__[ \t]*$/ { if (ports != "") print substr(ports, 2); next }
  { print }' "$OPS_DIR/Caddyfile" > "$tmp"
if have caddy; then caddy validate --config "$tmp" --adapter caddyfile >/dev/null 2>&1 || { say "  the generated Caddyfile did not validate; not installed." >&2; rm -f "$tmp"; exit 1; }; fi
put_file "$tmp" "$R/etc/caddy/Caddyfile" 644 root:root; CADDY_CHANGED=$FILE_CHANGED; rm -f "$tmp"
if [ "$CADDY_CHANGED" = 1 ]; then systemctl enable caddy >/dev/null 2>&1 || true; systemctl restart caddy; changed "caddy (re)started with our Caddyfile"
elif systemctl is-active caddy >/dev/null 2>&1; then same "caddy running"
else systemctl enable --now caddy >/dev/null 2>&1; changed "caddy started"; fi

# --- 6. firewall ---------------------------------------------------------------------------------
step "Firewall (ufw)"
SSH_PORTS=$(listeners | awk '/"sshd"/ {n=split($4,a,":"); print a[n]}' | sort -u)
[ -n "$SSH_PORTS" ] || SSH_PORTS=22
UFW_STATUS=$(ufw status 2>/dev/null || true)
need_rule() { ! grep -qE "^$1/tcp +ALLOW" <<<"$UFW_STATUS"; }
WANT_PORTS="$SSH_PORTS $HTTPS_PORT"; [ "$HTTP_PORT" = 0 ] || WANT_PORTS="$WANT_PORTS $HTTP_PORT"
if grep -q '^Status: active' <<<"$UFW_STATUS"; then
  for p in $WANT_PORTS; do
    if need_rule "$p"; then ufw allow "$p/tcp" >/dev/null; changed "ufw allow $p/tcp"; else same "ufw allow $p/tcp"; fi
  done
  same "ufw active (only our rules were added)"
elif [ -n "$PUBLIC_OTHER" ]; then
  say "  WARNING: ufw is inactive and other services are listening on this server, so I did NOT enable it (that could cut them off). The ports of this app ($WANT_PORTS) are open to the internet like everything else here. If you want a firewall, set it up deliberately (ufw or the DigitalOcean cloud firewall)."
else
  for p in $WANT_PORTS; do ufw allow "$p/tcp" >/dev/null; done
  ufw --force enable >/dev/null; changed "ufw enabled with $WANT_PORTS allowed (SSH first)"
fi

# --- 7. report ---------------------------------------------------------------------------------
step "Summary"
if [ "$CHANGES" -eq 0 ]; then say "  no changes: this server was already set up."; else say "  $CHANGES change(s) made."; fi
say "  RAM: ${RAM_MB} MB; Node heap limit: ${HEAP_MB} MB; binder concurrency: 1; app 127.0.0.1:$APP_PORT; site $BASE_URL"
if [ "$ENV_CREATED" = 1 ]; then
  say ""
  say "  THE DEV-OUTBOX PASSWORD (shown once; it is also in $ENV_FILE, readable by root):"
  say "      user: outbox"
  say "      password: $OUTBOX_PW"
  say "  Add it as the GitHub secret DEV_OUTBOX_PASSWORD so the deploy's smoke test can read the outbox."
fi
cat <<NEXT

Next steps:
  1. Add the GitHub secrets DEPLOY_HOST, DEPLOY_USER, DEPLOY_SSH_KEY, DEPLOY_KNOWN_HOSTS, DEV_OUTBOX_PASSWORD
     and DEPLOY_BASE_URL = $BASE_URL (README "Staging server setup").
  2. Run the "Deploy staging" workflow (Actions tab -> Run workflow). The site answers only after it.
  3. Then open $BASE_URL/br (accept the browser warning once: the certificate is self-made).
NEXT
