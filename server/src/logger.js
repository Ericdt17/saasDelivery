const pino = require("pino");

const isProduction = process.env.NODE_ENV === "production";

/**
 * pino-pretty is a devDependency; production installs use `npm install --omit=dev`,
 * so the module is missing. Only attach the pretty transport when the package exists.
 * Also skip in production even if someone installed devDependencies by mistake.
 */
function canUsePrettyTransport() {
  if (isProduction) return false;
  if (process.env.LOG_PRETTY === "0" || process.env.LOG_PRETTY === "false") {
    return false;
  }
  try {
    require.resolve("pino-pretty");
    return true;
  } catch {
    return false;
  }
}

const usePretty = canUsePrettyTransport();

const logger = pino({
  level: process.env.LOG_LEVEL || (isProduction ? "info" : "debug"),
  ...(usePretty && {
    transport: {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "SYS:HH:MM:ss",
        ignore: "pid,hostname",
      },
    },
  }),
});

module.exports = logger;
