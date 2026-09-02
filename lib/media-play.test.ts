import test from 'node:test';
import assert from 'node:assert/strict';

import { incrementMediaPlayCount } from './media-play';

test('incrementMediaPlayCount writes the play count immediately and returns the updated value', async () => {
  const calls: string[] = [];
  const query = async (sql: string) => {
    calls.push(sql.trim());

    if (sql.includes('UPDATE artist_media')) {
      return { rows: [] };
    }

    if (sql.includes('UPDATE artists')) {
      return { rows: [] };
    }

    return {
      rows: [{ trackDownloads: 7 }],
    };
  };

  const value = await incrementMediaPlayCount('abc123', query as never);

  assert.equal(value, 7);
  assert.equal(calls.length, 3);
  assert.match(calls[0], /UPDATE artist_media/);
  assert.match(calls[1], /UPDATE artists/);
  assert.match(calls[2], /SELECT download_count/);
});
