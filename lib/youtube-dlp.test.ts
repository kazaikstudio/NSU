import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeFormat } from './youtube-dlp';

test('normalizeFormat rejects storyboard and manifest-only placeholder entries', () => {
  const storyboard = normalizeFormat({
    format_id: 'sb3',
    ext: 'mhtml',
    url: 'https://i.ytimg.com/sb/abc/storyboard3_L0/default.jpg',
    acodec: 'none',
    vcodec: 'none',
  });

  const manifestOnly = normalizeFormat({
    format_id: '233',
    ext: 'mp4',
    url: 'https://manifest.googlevideo.com/api/manifest/hls_playlist',
    acodec: undefined,
    vcodec: 'none',
  });

  const audio = normalizeFormat({
    format_id: '140',
    ext: 'm4a',
    url: 'https://example.com/audio',
    acodec: 'mp4a.40.2',
    vcodec: 'none',
    abr: 129.5,
  });

  const video = normalizeFormat({
    format_id: '18',
    ext: 'mp4',
    url: 'https://example.com/video',
    acodec: 'mp4a.40.2',
    vcodec: 'avc1.4d401e',
    tbr: 740,
    height: 360,
  });

  assert.equal(storyboard.has_audio, false);
  assert.equal(storyboard.has_video, false);
  assert.equal(manifestOnly.has_audio, false);
  assert.equal(manifestOnly.has_video, false);
  assert.equal(audio.has_audio, true);
  assert.equal(video.has_video, true);
  assert.equal(video.quality_label, '360p');
});
