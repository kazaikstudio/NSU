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

test('normalizeFormat preserves signed cipher URLs for selected format downloads', () => {
  const format = normalizeFormat({
    format_id: '251',
    ext: 'webm',
    signatureCipher: 'Sp=signature&url=https%3A%2F%2Fexample.com%2Faudio%3Ffoo%3Dbar%26sig%3Dabc%26sp%3Dsig&key=xyz',
    acodec: 'opus',
    vcodec: 'none',
    abr: 160,
  });

  assert.equal(format.url, 'https://example.com/audio?foo=bar&sig=abc&sp=sig');
  assert.equal(format.has_audio, true);
  assert.equal(format.has_video, false);
  assert.equal(format.is_original, true);
});
