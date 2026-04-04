import app from "./app";
import { logger } from "./lib/logger";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  // ── Print Replit public URL ──────────────────────────────────────────
  const replSlug  = process.env["REPL_SLUG"]  ?? "";
  const replOwner = process.env["REPL_OWNER"] ?? "";
  const devDomain = process.env["REPLIT_DEV_DOMAIN"] ?? "";

  let baseUrl: string;
  if (devDomain) {
    baseUrl = `https://${devDomain}`;
  } else if (replSlug && replOwner) {
    baseUrl = `https://${replSlug}.${replOwner}.replit.dev`;
  } else {
    baseUrl = `http://localhost:${port}`;
  }

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🚀  Server is running");
  console.log(`📍  Base URL : ${baseUrl}`);
  console.log(`🔗  API  URL : ${baseUrl}/api`);
  console.log(`🔗  Services : ${baseUrl}/api/smm/services`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
});
