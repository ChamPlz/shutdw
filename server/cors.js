/**
 * Middleware CORS testável e reutilizável.
 * Permite:
 *  - requisições same-origin (Origin === http://Host), incluindo IPv6
 *  - origens da allowlist (comparação EXATA, sem prefix-matching frouxo)
 *  - requisições sem header Origin (curl, scripts, Electron)
 */

const { CORS_PREFLIGHT_MAX_AGE } = require("../shared/constants");

/**
 * Verifica se uma origem é same-origin (mesmo host/porta do request)
 * @param {string} origin - Header Origin
 * @param {string} host - Header Host
 * @returns {boolean}
 */
function isSameOrigin(origin, host) {
  if (!origin || !host) return false;
  return origin === `http://${host}`;
}

/**
 * Cria o middleware de CORS
 * @param {string[]} allowedOrigins - Lista de origens permitidas (comparação exata)
 * @returns {import('express').RequestHandler}
 */
function createCorsMiddleware(allowedOrigins) {
  return (req, res, next) => {
    const origin = req.headers.origin;
    const host = req.headers.host;

    const sameOrigin = isSameOrigin(origin, host);
    const allowlisted = origin && allowedOrigins.includes(origin);

    // Rejeitar origins não permitidas (cross-origin não autorizado)
    if (origin && !sameOrigin && !allowlisted) {
      return res.status(403).json({ error: "Origin not allowed" });
    }

    // Resposta para preflight (OPTIONS)
    if (req.method === "OPTIONS") {
      res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization,X-Pin");
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.setHeader("Access-Control-Max-Age", CORS_PREFLIGHT_MAX_AGE);
      res.setHeader("Access-Control-Allow-Origin", origin || "*");
      return res.status(204).end();
    }

    // Headers para requisições reais
    res.setHeader("Access-Control-Allow-Origin", origin || "*");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    next();
  };
}

module.exports = { createCorsMiddleware, isSameOrigin };