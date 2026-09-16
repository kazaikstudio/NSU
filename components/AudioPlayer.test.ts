import test from 'node:test';
import assert from 'node:assert/strict';

import { extractFileId, getMetricLabel } from './AudioPlayer';

test('getMetricLabel uses the correct singular/plural wording for the metric', () => {
  assert.equal(getMetricLabel('plays', 1), 'Play');
  assert.equal(getMetricLabel('plays', 2), 'Plays');
  assert.equal(getMetricLabel('downloads', 1), 'Download');
  assert.equal(getMetricLabel('downloads', 2), 'Downloads');
});

test('extractFileId reads nested media ids with folders and encoded characters', () => {
  assert.equal(
    extractFileId('/api/dashboard/media/artist%2Ffolder%2Ftrack%20name.mp3?play=1'),
    'artist/folder/track name.mp3',
  );

  assert.equal(
    extractFileId('/api/dashboard/media/music/artist%2Fsong.mp3'),
    'music/artist/song.mp3',
  );
});
