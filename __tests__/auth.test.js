const { hashPin, verifyPin, isHash } = require('../server/auth');

describe('Auth Module', () => {
  describe('hashPin', () => {
    test('deve hashear um PIN com sucesso', async () => {
      const pin = '1234';
      const hash = await hashPin(pin);

      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
      expect(hash).not.toBe(pin);
      expect(hash.length).toBeGreaterThan(50);
    });

    test('deve gerar hashes diferentes para o mesmo PIN', async () => {
      const pin = '1234';
      const hash1 = await hashPin(pin);
      const hash2 = await hashPin(pin);

      expect(hash1).not.toBe(hash2);
    });

    test('deve hashear PINs diferentes com resultados diferentes', async () => {
      const hash1 = await hashPin('1234');
      const hash2 = await hashPin('5678');

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('verifyPin', () => {
    test('deve verificar PIN corretamente', async () => {
      const pin = '1234';
      const hash = await hashPin(pin);
      const isValid = await verifyPin(hash, pin);

      expect(isValid).toBe(true);
    });

    test('deve rejeitar PIN incorreto', async () => {
      const pin = '1234';
      const hash = await hashPin(pin);
      const isValid = await verifyPin(hash, '5678');

      expect(isValid).toBe(false);
    });

    test('deve rejeitar PIN vazio', async () => {
      const pin = '1234';
      const hash = await hashPin(pin);
      const isValid = await verifyPin(hash, '');

      expect(isValid).toBe(false);
    });
  });

  describe('isHash', () => {
    test('deve identificar hash Argon2 corretamente', async () => {
      const pin = '1234';
      const hash = await hashPin(pin);

      expect(isHash(hash)).toBe(true);
    });

    test('deve identificar texto puro como não-hash', () => {
      expect(isHash('1234')).toBe(false);
      expect(isHash('')).toBe(false);
      expect(isHash('plain-text-password')).toBe(false);
    });
  });
});