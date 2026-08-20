import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../app';
import { F5TtsClient, F5TtsUnavailableError } from '../voice/f5tts/client';

// Helper to monkeypatch transcribe behavior
const originalTranscribe = F5TtsClient.prototype.transcribe;

test.afterEach(() => {
  // restore
  F5TtsClient.prototype.transcribe = originalTranscribe;
});

test('missing audio (multipart) -> 400', async () => {
  const res = await request(app).post('/api/voice/transcribe').field('foo', 'bar');
  assert.equal(res.status, 400);
  assert.match(res.body.message, /No audio file provided/i);
});

test('unsupported content type -> 415', async () => {
  const res = await request(app).post('/api/voice/transcribe').set('Content-Type', 'application/json').send({});
  assert.equal(res.status, 415);
});

test('multipart upload with field file -> success', async () => {
  F5TtsClient.prototype.transcribe = async function (_buf: Buffer) { return 'hello multipart'; } as any;
  const buf = Buffer.from('RIFF....WAVE');
  const res = await request(app).post('/api/voice/transcribe').attach('file', buf, { filename: 'test.wav', contentType: 'audio/wav' });
  assert.equal(res.status, 200);
  assert.equal(res.body.transcript, 'hello multipart');
});

test('raw audio upload Content-Type audio/wav -> success', async () => {
  F5TtsClient.prototype.transcribe = async function (_buf: Buffer) { return 'hello raw'; } as any;
  const buf = Buffer.from('RIFF....WAVE');
  const res = await request(app).post('/api/voice/transcribe').set('Content-Type', 'audio/wav').send(buf);
  assert.equal(res.status, 200);
  assert.equal(res.body.transcript, 'hello raw');
});

test('oversized upload -> 413', async () => {
  // create >20MB buffer
  const big = Buffer.alloc(21 * 1024 * 1024, 0);
  const res = await request(app).post('/api/voice/transcribe').attach('file', big, { filename: 'big.wav', contentType: 'audio/wav' });
  assert.equal(res.status, 413);
});

test('worker unavailable -> 503', async () => {
  F5TtsClient.prototype.transcribe = async function (_buf: Buffer) { throw new F5TtsUnavailableError(); } as any;
  const buf = Buffer.from('RIFF....WAVE');
  const res = await request(app).post('/api/voice/transcribe').attach('file', buf, { filename: 'test.wav', contentType: 'audio/wav' });
  assert.equal(res.status, 503);
});

test('worker failure -> 502', async () => {
  F5TtsClient.prototype.transcribe = async function (_buf: Buffer) { throw new Error('worker failed'); } as any;
  const buf = Buffer.from('RIFF....WAVE');
  const res = await request(app).post('/api/voice/transcribe').attach('file', buf, { filename: 'test.wav', contentType: 'audio/wav' });
  assert.equal(res.status, 502);
});

test('empty transcript handling -> return empty string', async () => {
  F5TtsClient.prototype.transcribe = async function (_buf: Buffer) { return ''; } as any;
  const buf = Buffer.from('RIFF....WAVE');
  const res = await request(app).post('/api/voice/transcribe').attach('file', buf, { filename: 'test.wav', contentType: 'audio/wav' });
  assert.equal(res.status, 200);
  assert.equal(res.body.transcript, '');
});
