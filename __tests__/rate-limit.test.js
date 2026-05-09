const request = require('supertest');
const express = require('express');
const { rateLimit } = require('express-rate-limit');
const {
  RATE_LIMIT_WINDOW_MS,
  RATE_LIMIT_READ_MAX,
  RATE_LIMIT_ACTION_MAX,
  RATE_LIMIT_AUTH_MAX,
} = require('../shared/constants');

describe('Rate Limiting', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());

    // Limiter de leitura
    const readLimiter = rateLimit({
      windowMs: RATE_LIMIT_WINDOW_MS,
      limit: RATE_LIMIT_READ_MAX,
      message: { error: 'Muitas requisições, tente novamente em breve.' },
      statusCode: 429,
    });

    // Limiter de ação
    const actionLimiter = rateLimit({
      windowMs: RATE_LIMIT_WINDOW_MS,
      limit: RATE_LIMIT_ACTION_MAX,
      message: { error: 'Muitas ações, aguarde antes de tentar novamente.' },
      statusCode: 429,
    });

    // Limiter de autenticação
    const authLimiter = rateLimit({
      windowMs: RATE_LIMIT_WINDOW_MS,
      limit: RATE_LIMIT_AUTH_MAX,
      message: { error: 'Muitas tentativas de autenticação. Tente novamente em 1 minuto.' },
      statusCode: 429,
    });

    app.get('/read', readLimiter, (req, res) => {
      res.json({ status: 'ok' });
    });

    app.post('/action', actionLimiter, (req, res) => {
      res.json({ status: 'ok' });
    });

    app.post('/auth', authLimiter, (req, res) => {
      res.json({ status: 'ok' });
    });
  });

  describe('Read Limiter', () => {
    test('deve permitir requisições dentro do limite', async () => {
      const response = await request(app).get('/read');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('ok');
    });

    test('deve bloquear após exceder limite de leitura', async () => {
      // Fazer RATE_LIMIT_READ_MAX + 1 requisições
      const promises = [];
      for (let i = 0; i <= RATE_LIMIT_READ_MAX; i++) {
        promises.push(request(app).get('/read'));
      }

      const responses = await Promise.all(promises);
      const blockedResponses = responses.filter(r => r.status === 429);

      expect(blockedResponses.length).toBeGreaterThan(0);
      expect(blockedResponses[0].body.error).toContain('Muitas requisições');
    });
  });

  describe('Action Limiter', () => {
    test('deve permitir ações dentro do limite', async () => {
      const response = await request(app).post('/action').send({});

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('ok');
    });

    test('deve bloquear após exceder limite de ação', async () => {
      // Fazer RATE_LIMIT_ACTION_MAX + 1 requisições
      const promises = [];
      for (let i = 0; i <= RATE_LIMIT_ACTION_MAX; i++) {
        promises.push(request(app).post('/action').send({}));
      }

      const responses = await Promise.all(promises);
      const blockedResponses = responses.filter(r => r.status === 429);

      expect(blockedResponses.length).toBeGreaterThan(0);
      expect(blockedResponses[0].body.error).toContain('Muitas ações');
    });
  });

  describe('Auth Limiter', () => {
    test('deve permitir autenticação dentro do limite', async () => {
      const response = await request(app).post('/auth').send({});

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('ok');
    });

    test('deve bloquear após exceder limite de autenticação', async () => {
      // Fazer RATE_LIMIT_AUTH_MAX + 1 requisições
      const promises = [];
      for (let i = 0; i <= RATE_LIMIT_AUTH_MAX; i++) {
        promises.push(request(app).post('/auth').send({}));
      }

      const responses = await Promise.all(promises);
      const blockedResponses = responses.filter(r => r.status === 429);

      expect(blockedResponses.length).toBeGreaterThan(0);
      expect(blockedResponses[0].body.error).toContain('Muitas tentativas de autenticação');
    });
  });

  describe('Rate Limit Constants', () => {
    test('constantes devem ter valores esperados', () => {
      expect(RATE_LIMIT_WINDOW_MS).toBe(60 * 1000); // 1 minuto
      expect(RATE_LIMIT_READ_MAX).toBe(120);
      expect(RATE_LIMIT_ACTION_MAX).toBe(20);
      expect(RATE_LIMIT_AUTH_MAX).toBe(5);
    });
  });
});