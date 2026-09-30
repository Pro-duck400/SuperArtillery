import express from 'express';
import request from 'supertest';
import { describe, it, expect, beforeEach } from 'vitest';
import { createApiRouter } from '../routes/api';
import { GameManager } from '../services/gameManager';
import { CONTRACT_VERSION, CORE_VERSION } from '@superartillery/core';

describe('API routes', () => {
  let app: express.Express;
  let gameManager: GameManager;

  beforeEach(() => {
    gameManager = new GameManager();
    app = express();
    app.use(express.json());
    app.use('/api', createApiRouter(gameManager));
  });

  it('creates a game and returns invite details', async () => {
    const response = await request(app)
      .post('/api/v1/games')
      .send({ name: 'Alice' })
      .expect(201);

    expect(response.body.gameId).toBeTruthy();
    expect(response.body.playerToken).toBeTruthy();
    expect(response.body.inviteCode).toMatch(/^[A-Z0-9]{4}$/i);
    expect(response.body.inviteUrl).toContain('invite=');
  });

  it('does not expose server-side hot-seat game creation', async () => {
    await request(app)
      .post('/api/v1/hot-seat/games')
      .send({ names: ['Alice', 'Bob'] })
      .expect(404);
  });

  it('accepts an invitation by code', async () => {
    const created = gameManager.createGame('Alice');
    if ('error' in created) throw new Error('Expected created game');

    const response = await request(app)
      .post('/api/v1/invitations/accept')
      .send({ inviteCode: created.inviteCode, name: 'Bob' })
      .expect(200);

    expect(response.body.gameId).toBe(created.gameId);
    expect(response.body.playerToken).toBeTruthy();
  });

  it('requires a session token for status polling', async () => {
    const created = gameManager.createGame('Alice');
    if ('error' in created) throw new Error('Expected created game');

    const response = await request(app)
      .get(`/api/v1/games/${created.gameId}/status`)
      .expect(401);

    expect(response.body.code).toBe('MISSING_SESSION_TOKEN');
  });

  it('returns status for a valid session token', async () => {
    const created = gameManager.createGame('Alice');
    if ('error' in created) throw new Error('Expected created game');

    const response = await request(app)
      .get(`/api/v1/games/${created.gameId}/status`)
      .query({ sessionToken: created.playerToken })
      .expect(200);

    expect(response.body.status).toBe('pending');
    expect(response.body.playersConnected).toBe(0);
    expect(response.body.required).toBe(2);
    expect(response.body.ready).toBe(false);
    expect(response.body.readyCount).toBe(0);
  });

  it('rejects a rematch request before the game has finished', async () => {
    const created = gameManager.createGame('Alice');
    if ('error' in created) throw new Error('Expected created game');

    const response = await request(app)
      .post(`/api/v1/games/${created.gameId}/rematch`)
      .query({ sessionToken: created.playerToken })
      .expect(400);

    expect(response.body.code).toBe('REMATCH_NOT_AVAILABLE');
  });

  it('requires a session token for rematch requests', async () => {
    const response = await request(app)
      .post('/api/v1/games/game-1/rematch')
      .expect(401);

    expect(response.body.code).toBe('MISSING_SESSION_TOKEN');
  });

  it('rejects fire without required payload fields', async () => {
    const response = await request(app)
      .post('/api/v1/fire')
      .query({ sessionToken: 'abc' })
      .send({ gameId: 'x', angle: 45 })
      .expect(400);

    expect(response.body.code).toBe('MISSING_FIELDS');
  });

  it('reports health without runtime metrics or versions', async () => {
    const response = await request(app)
      .get('/api/v1/health')
      .expect(200);

    expect(response.body).toMatchObject({
      status: 'ok',
      timestamp: expect.any(String),
      uptime: expect.stringMatching(/^\d+\.\d{2}:\d{2}:\d{2}\.\d{3}$/)
    });
    expect(response.body.games).toBeUndefined();
    expect(response.body.coreVersion).toBeUndefined();
  });

  it('reports status including webSockets and lifetime totals', async () => {
    const response = await request(app)
      .get('/api/v1/status')
      .expect(200);

    expect(response.body).toMatchObject({
      games: expect.any(Number),
      invites: expect.any(Number),
      webSockets: expect.any(Number),
      totals: { games: expect.any(Number), rematches: expect.any(Number) },
    });
    expect(Object.keys(response.body.totals).sort()).toEqual(['games', 'rematches']);
    expect(response.body.contractVersion).toBeUndefined();
  });

  it('reports server, core, and contract versions separately', async () => {
    const response = await request(app)
      .get('/api/v1/version')
      .expect(200);

    expect(response.body).toMatchObject({
      serverVersion: expect.any(String),
      coreVersion: CORE_VERSION,
      contractVersion: CONTRACT_VERSION
    });
  });
});
