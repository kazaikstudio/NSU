import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ensureDownloadStoragePath } from './download-storage';

test('ensureDownloadStoragePath creates the Noll-Music audio folder structure', async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), 'noll-downloads-'));
  process.cwd = () => tempRoot;

  try {
    const storedPath = await ensureDownloadStoragePath('My Song.mp3', 'audio');
    assert.match(storedPath, /Noll-Music\/Audio\/My Song\.mp3$/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
