export type YoutubePageFormat = {
  itag: number;
  url?: string;
  mime_type: string;
  bitrate: number;
  content_length?: number;
  quality_label?: string;
  has_audio: boolean;
  has_video: boolean;
  has_text: boolean;
  is_original?: boolean;
};

export type YoutubePageInfo = {
  basic_info: { title?: string };
  streaming_data: { formats: YoutubePageFormat[]; adaptive_formats: YoutubePageFormat[] };
};

function extractPlayerResponse(html: string) {
  const marker = 'ytInitialPlayerResponse = ';
  const start = html.indexOf(marker);
  if (start < 0) return null;

  const jsonStart = start + marker.length;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = jsonStart; index < html.length; index += 1) {
    const character = html[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') inString = true;
    else if (character === '{') depth += 1;
    else if (character === '}' && --depth === 0) {
      try {
        return JSON.parse(html.slice(jsonStart, index + 1)) as Record<string, unknown>;
      } catch {
        return null;
      }
    }
  }
  return null;
}

function normalizeFormat(format: Record<string, unknown>): YoutubePageFormat {
  const mimeType = typeof format.mimeType === 'string' ? format.mimeType : '';
  return {
    itag: Number(format.itag),
    url: typeof format.url === 'string' ? format.url : undefined,
    mime_type: mimeType,
    bitrate: Number(format.bitrate || format.averageBitrate || 0),
    content_length: Number(format.contentLength || 0) || undefined,
    quality_label: typeof format.qualityLabel === 'string' ? format.qualityLabel : undefined,
    has_audio: mimeType.includes('audio/') || mimeType.includes('video/'),
    has_video: mimeType.includes('video/'),
    has_text: false,
    is_original: true,
  };
}

export async function getYoutubePageInfo(videoId: string): Promise<YoutubePageInfo> {
  const response = await fetch(`https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`YouTube watch page returned ${response.status}`);

  const playerResponse = extractPlayerResponse(await response.text());
  const streamingData = playerResponse?.streamingData as Record<string, unknown> | undefined;
  if (!streamingData) throw new Error('YouTube watch page did not include stream metadata.');

  const mapFormats = (value: unknown) => Array.isArray(value)
    ? value.map((format) => normalizeFormat(format as Record<string, unknown>)).filter((format) => format.itag > 0)
    : [];

  return {
    basic_info: { title: (playerResponse?.videoDetails as Record<string, unknown> | undefined)?.title as string | undefined },
    streaming_data: {
      formats: mapFormats(streamingData.formats),
      adaptive_formats: mapFormats(streamingData.adaptiveFormats),
    },
  };
}
