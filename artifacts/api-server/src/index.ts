import app from "./app.js";
import { logger } from "./lib/logger.js";

const rawPort = process.env["PORT"];

// Only start the cron-based reminder scheduler in local development.
// Vercel serverless functions spin up on each request, so cron jobs
// must NOT be registered on the server-side platform.
if (process.env.VERCEL !== "1") {
  await import("./reminders.js");
}

const port = Number(rawPort);

// Export the app for Vercel serverless deployment (@vercel/node).
// Vercel will use this export as the request handler.
export default app;

// Only listen locally when running via `pnpm run start`.
// In the Vercel runtime, the platform handles incoming requests
// by invoking the exported handler directly.
if (!process.env.VERCEL) {
  if (!rawPort) {
    throw new Error(
      "PORT environment variable is required but was not provided.",
    );
  }

  if (Number.isNaN(port) || port <= 0) {
    throw new Error(`Invalid PORT value: "${rawPort}"`);
  }

  app.listen(port, (err: Error) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }

    logger.info({ port }, "Server listening");
  });
}
