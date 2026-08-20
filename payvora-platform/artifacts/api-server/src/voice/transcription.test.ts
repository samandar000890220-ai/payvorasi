import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeTranscriptionAudio } from './transcription';

test('normalizeTranscriptionAudio in test env returns input', async () => {
  // NODE_ENV is 'test' during unit tests in this repo. Expect pass-through behavior.
  const buf = Buffer.from('RIFF....WAVE');
  const out = await normalizeTranscriptionAudio(buf);
  assert.ok(Buffer.isBuffer(out));
  assert.equal(out.toString(), buf.toString());
});

test('normalizeTranscriptionAudio rejects empty buffer', async () => {
  let threw = false;
  try {
    await normalizeTranscriptionAudio(Buffer.alloc(0));
  } catch (err) {
    threw = true;
    assert.ok((err as Error).message.includes('Audio is empty'));
  }
  assert.ok(threw);
});
