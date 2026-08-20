import test from 'node:test';
import assert from 'node:assert/strict';
import { VoiceEngineService, VoiceEngineError } from './engine';

// Mock providers
const mockSTT = {
  configured: true,
  transcribe: async (buf: Buffer) => {
    if (!buf || buf.length === 0) throw new Error('empty');
    return 'mock transcript';
  }
};

const mockTTS = {
  configured: true,
  synthesize: async (text: string) => {
    return Buffer.from('RIFF');
  }
};

const mockRealtime = {
  configured: false,
  createSession: async () => 'prov-1',
  sendAudio: async () => {},
  closeSession: async () => {}
};

test('transcribe success', async () => {
  const engine = new VoiceEngineService({ speech: mockSTT as any });
  const out = await engine.transcribe(Buffer.from('audio'));
  assert.equal(out, 'mock transcript');
});

test('transcribe failure maps to VoiceEngineError', async () => {
  const badSTT = { configured: true, transcribe: async () => { throw new Error('provider broken'); } };
  const engine = new VoiceEngineService({ speech: badSTT as any });
  let threw = false;
  try { await engine.transcribe(Buffer.from('audio')); } catch (err) { threw = true; assert.ok(err instanceof VoiceEngineError); }
  assert.ok(threw);
});

test('synthesize success', async () => {
  const engine = new VoiceEngineService({ tts: mockTTS as any });
  const audio = await engine.synthesize('hello');
  assert.ok(Buffer.isBuffer(audio));
});

test('startVoiceSession without realtime provider still creates session', async () => {
  const engine = new VoiceEngineService({ realtime: mockRealtime as any });
  const s = await engine.startVoiceSession();
  assert.ok(s.id);
  assert.equal(s.state, 'listening');
  await engine.endVoiceSession(s.id);
});
