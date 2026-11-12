import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { makeTestApp, type TestApp } from '../helpers/app.js';

let t: TestApp;

beforeAll(async () => {
  t = await makeTestApp();
});

afterAll(async () => {
  await t.cleanup();
});

describe('tools API', () => {
  it('GET /api/tools returns the status shape', async () => {
    const res = await request(t.app).get('/api/tools');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      desktop: false,
      appVersion: null,
      download: { status: 'idle' },
      benchmark: { status: 'idle' },
    });
    expect(res.body.models).toHaveLength(3);
    expect(res.body.models[0]).toMatchObject({
      id: 'large-v3-turbo-q5_0',
      installed: false,
      selected: false,
      partialBytes: 0,
    });
    expect(typeof res.body.ffmpeg.found).toBe('boolean');
    expect(typeof res.body.ready).toBe('boolean');
    expect(typeof res.body.freeDiskBytes).toBe('number');
  });

  it('answers 400 for an unknown model to download', async () => {
    const res = await request(t.app).post('/api/tools/models/no-such-model/download');
    expect(res.status).toBe(400);
  });

  it('answers 400 when selecting a model that is not installed', async () => {
    const res = await request(t.app).put('/api/tools/model').send({ id: 'small-q5_1' });
    expect(res.status).toBe(400);
  });

  it('answers 400 when the selection has no model id', async () => {
    const res = await request(t.app).put('/api/tools/model').send({});
    expect(res.status).toBe(400);
  });

  it('POST /api/tools/download/cancel answers 204 with nothing running', async () => {
    const res = await request(t.app).post('/api/tools/download/cancel');
    expect(res.status).toBe(204);
  });
});
