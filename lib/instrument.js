// Sentry starts before anything else so it can trace incoming requests and outgoing calls
// (Gemini, Bright Data, Jev). Loaded first by server.js.
import * as Sentry from "@sentry/node";

const isProd = process.env.NODE_ENV === "production";

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: isProd ? "production" : "development",
    release: process.env.SENTRY_RELEASE || process.env.COMMIT_SHA || undefined,
    // Every trace locally so we can verify; 10% in production.
    tracesSampleRate: isProd ? 0.1 : 1.0,
    enableLogs: true,
  });
}
