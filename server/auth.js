const argon2 = require('argon2');

/**
 * Configurações padrão para hash Argon2
 */
const DEFAULT_OPTS = {
  type: argon2.argon2id,
  timeCost: 3,
  memoryCost: 4096,
  parallelism: 1,
};

/**
 * Gera hash de um PIN usando Argon2
 * @param {string} pin - PIN para hashear
 * @param {object} opts - Opções do Argon2
 * @returns {Promise<string>} Hash do PIN
 */
async function hashPin(pin, opts = DEFAULT_OPTS) {
  if (typeof pin !== 'string') {
    throw new TypeError('PIN deve ser uma string');
  }
  if (pin.length < 4) {
    throw new Error('PIN deve ter no mínimo 4 caracteres');
  }
  return argon2.hash(pin, opts);
}

/**
 * Verifica se um PIN corresponde a um hash
 * @param {string} hash - Hash armazenado
 * @param {string} pin - PIN para verificar
 * @returns {Promise<boolean>} True se o PIN for válido
 */
async function verifyPin(hash, pin) {
  if (typeof hash !== 'string' || typeof pin !== 'string') {
    return false;
  }
  try {
    return await argon2.verify(hash, pin);
  } catch {
    return false;
  }
}

/**
 * Verifica se um valor é um hash Argon2
 * @param {string} value - Valor para verificar
 * @returns {boolean} True se for um hash Argon2
 */
function isHash(value) {
  return typeof value === 'string' && value.startsWith('$argon2');
}

module.exports = {
  hashPin,
  verifyPin,
  isHash,
  DEFAULT_OPTS,
};
