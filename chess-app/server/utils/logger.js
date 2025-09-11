import winston from "winston";

// Define log format
const logFormat = winston.format.printf(({ level, message, timestamp, stack }) => {
  return stack
    ? `${timestamp} [${level.toUpperCase()}]: ${message}\n${stack}`
    : `${timestamp} [${level.toUpperCase()}]: ${message}`;
});

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info", // Default to "info"
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }), // Capture stack traces
    winston.format.splat(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: process.env.NODE_ENV === "production"
        ? winston.format.combine(winston.format.timestamp(), winston.format.json())
        : winston.format.combine(
            winston.format.colorize(),
            winston.format.timestamp(),
            logFormat
          ),
    }),

     new winston.transports.File({ filename: "logs/app.log" }),
  ],
});

// Helper functions for cleaner usage
export const log = {
  info: (msg, meta) => logger.info(msg, meta),
  warn: (msg, meta) => logger.warn(msg, meta),
  error: (msg, meta) => logger.error(msg, meta),
  debug: (msg, meta) => logger.debug(msg, meta),
};

export default logger;
