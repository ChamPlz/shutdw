const { app } = require("electron");
const path = require("path");
const winston = require("winston");
const DailyRotateFile = require("winston-daily-rotate-file");
const {
  LOG_DIR,
  LOG_MAX_SIZE,
  LOG_MAX_FILES,
  LOG_ERROR_MAX_SIZE,
  LOG_ERROR_MAX_FILES,
} = require("./shared/constants");

/**
 * Configuração de logging estruturado
 * Usa winston com rotação diária de arquivos
 */

const logDir = path.join(app.getPath("userData"), LOG_DIR);

// Formato de log estruturado
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Formato para console (mais legível)
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: "HH:mm:ss" }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0) {
      msg += ` ${JSON.stringify(meta)}`;
    }
    return msg;
  })
);

// Transporte de arquivo com rotação diária
const fileTransport = new DailyRotateFile({
  filename: path.join(logDir, "shutdw-%DATE%.log"),
  datePattern: "YYYY-MM-DD",
  maxSize: LOG_MAX_SIZE,
  maxFiles: LOG_MAX_FILES,
  format: logFormat,
});

// Transporte de erro separado
const errorTransport = new DailyRotateFile({
  filename: path.join(logDir, "shutdw-error-%DATE%.log"),
  datePattern: "YYYY-MM-DD",
  level: "error",
  maxSize: LOG_ERROR_MAX_SIZE,
  maxFiles: LOG_ERROR_MAX_FILES,
  format: logFormat,
});

// Logger principal
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: logFormat,
  transports: [
    fileTransport,
    errorTransport,
  ],
  // Não logar no console em produção
  silent: process.env.NODE_ENV === "production",
});

// Adicionar console em desenvolvimento
if (process.env.NODE_ENV !== "production") {
  logger.add(
    new winston.transports.Console({
      format: consoleFormat,
    })
  );
}

/**
 * Cria um logger com contexto específico
 * @param {string} context - Contexto do log (ex: "main", "server", "auth")
 * @returns {winston.Logger} Logger com contexto
 */
function createLogger(context) {
  const childLogger = logger.child({ context });
  return childLogger;
}

module.exports = {
  logger,
  createLogger,
};