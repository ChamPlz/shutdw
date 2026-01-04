const argon2 = require('argon2');

const DEFAULT_OPTS = {
  type: argon2.argon2id,
  timeCost: 3,
  memoryCost: 4096,
  parallelism: 1
};

async function hashPin(pin, opts = DEFAULT_OPTS) {
  if (typeof pin !== 'string') throw new TypeError('PIN must be a string');
  return argon2.hash(pin, opts);
}

async function verifyPin(hash, pin) {
  if (typeof hash !== 'string') return false;
  if (typeof pin !== 'string') return false;
  return argon2.verify(hash, pin);
}

function isHash(value) {
  return typeof value === 'string' && value.startsWith('$argon2');
}

module.exports = { hashPin, verifyPin, isHash };
