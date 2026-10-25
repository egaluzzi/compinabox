// Runs once when the Node server starts. In `production` a violation of the environment guard
// (lib/env.ts) stops the process from coming up; elsewhere it is logged loudly.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { appEnv, checkEnvironment } = await import("./lib/env");
  const env = appEnv();
  const violations = checkEnvironment();
  if (violations.length > 0) {
    const msg = `ENVIRONMENT GUARD (APP_ENV=${env}): ${violations.join(", ")}`;
    if (env === "production") throw new Error(`${msg} — refusing to start`);
    console.error(msg);
  }
  if (env === "staging") {
    console.warn(
      "APP_ENV=staging: test environment, fictitious data only, fake payments and e-mail sink allowed",
    );
  }
}
