/**
 * ShutDW — Constantes compartilhadas
 * Centraliza valores configuráveis usados em múltiplos módulos
 */

// ============================================================================
// CONFIGURAÇÃO DE REDE
// ============================================================================
const PORT = 3333;

// ============================================================================
// TIMEOUTS
// ============================================================================
const EXEC_TIMEOUT = 5000; // 5 segundos — timeout para execução de comandos
const GRACEFUL_SHUTDOWN_TIMEOUT = 10000; // 10 segundos — graceful shutdown do servidor

// ============================================================================
// RATE LIMITING
// ============================================================================
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minuto
const RATE_LIMIT_READ_MAX = 120; // 120 requisições/min para endpoints de leitura
const RATE_LIMIT_ACTION_MAX = 20; // 20 requisições/min para endpoints de ação
const RATE_LIMIT_AUTH_MAX = 5; // 5 requisições/min para autenticação (/config/pin)

// ============================================================================
// QR CODE CACHE
// ============================================================================
const QR_CACHE_TTL = 5 * 60 * 1000; // 5 minutos — TTL para cache de IP/QR
const QR_CACHE_KEY = "shutdw_qr_cache"; // Chave localStorage para cache client-side

// ============================================================================
// CORS
// ============================================================================
const CORS_ALLOWED_ORIGINS = [
  "http://localhost:3333",
  "app://localhost",
  "file://"
];
const CORS_PREFLIGHT_MAX_AGE = 86400; // 24 horas — cache de preflight

// ============================================================================
// PIN
// ============================================================================
const PIN_MIN_LENGTH = 4; // Mínimo de 4 dígitos para PIN
const PIN_MAX_LENGTH = 20; // Máximo de 20 dígitos para PIN

// ============================================================================
// LOGGING
// ============================================================================
const LOG_DIR = "logs"; // Diretório de logs relativo a userData
const LOG_MAX_SIZE = "5m"; // Tamanho máximo de arquivo de log
const LOG_MAX_FILES = 14; // Retenção de 14 dias para logs normais
const LOG_ERROR_MAX_SIZE = "15m"; // Tamanho máximo de arquivo de log de erro
const LOG_ERROR_MAX_FILES = 30; // Retenção de 30 dias para logs de erro

module.exports = {
  // Rede
  PORT,

  // Timeouts
  EXEC_TIMEOUT,
  GRACEFUL_SHUTDOWN_TIMEOUT,

  // Rate limiting
  RATE_LIMIT_WINDOW_MS,
  RATE_LIMIT_READ_MAX,
  RATE_LIMIT_ACTION_MAX,
  RATE_LIMIT_AUTH_MAX,

  // QR cache
  QR_CACHE_TTL,
  QR_CACHE_KEY,

  // CORS
  CORS_ALLOWED_ORIGINS,
  CORS_PREFLIGHT_MAX_AGE,

  // PIN
  PIN_MIN_LENGTH,
  PIN_MAX_LENGTH,

  // Logging
  LOG_DIR,
  LOG_MAX_SIZE,
  LOG_MAX_FILES,
  LOG_ERROR_MAX_SIZE,
  LOG_ERROR_MAX_FILES,
};