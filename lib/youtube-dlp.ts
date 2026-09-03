import youtubeDl from 'youtube-dl-exec';

export interface DlpFormat {
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
}

export interface DlpInfo {
  basic_info: { title?: string };
  streaming_data: { formats: DlpFormat[]; adaptive_formats: DlpFormat[] };
}

type RawFormat = {
  format_id?: string;
  url?: string;
  manifest_url?: string;
  ext?: string;
  format_note?: string;
  height?: number;
  tbr?: number | null;
  abr?: number | null;
  vbr?: number | null;
  filesize?: number;
  filesize_approx?: number;
  acodec?: string;
  vcodec?: string;
};

type RawInfo = { title?: string; formats?: RawFormat[] };

export function normalizeFormat(format: RawFormat): DlpFormat {
  const url = typeof format.url === 'string' ? format.url : undefined;
  const manifestUrl = typeof format.manifest_url === 'string' ? format.manifest_url : undefined;
  const formatId = String(format.format_id || '');
  const isStoryboard = /^sb\d+$/i.test(formatId);
  const isManifestPlaceholder = Boolean(
    (url && /manifest\.googlevideo\.com|\/api\/manifest\//i.test(url)) ||
    (manifestUrl && /manifest\.googlevideo\.com|\/api\/manifest\//i.test(manifestUrl)) ||
    isStoryboard,
  );
  const hasAudio = Boolean(
    (format.acodec && format.acodec !== 'none') ||
    (typeof format.abr === 'number' && Number.isFinite(format.abr) && format.abr > 0),
  );
  const hasVideo = Boolean(
    (format.vcodec && format.vcodec !== 'none') ||
    (typeof format.height === 'number' && Number.isFinite(format.height) && format.height > 0),
  );
  const extension = format.ext || (hasVideo ? 'mp4' : hasAudio ? 'm4a' : 'mp4');
  const isPlayable = !isManifestPlaceholder && Boolean(url) && (hasAudio || hasVideo);

  return {
    itag: Number(format.format_id),
    url: isPlayable ? url : undefined,
    mime_type: hasAudio && hasVideo ? `video/${extension}` : hasAudio ? `audio/${extension}` : hasVideo ? `video/${extension}` : '',
    bitrate: Math.round((format.tbr ?? format.abr ?? format.vbr ?? 0) * 1000),
    content_length: format.filesize || format.filesize_approx,
    quality_label: format.height ? `${format.height}p` : format.format_note,
    has_audio: hasAudio,
    has_video: hasVideo,
    has_text: false,
    is_original: isPlayable,
  };
}

export async function getYoutubeDlpInfo(videoId: string): Promise<DlpInfo> {
  const raw = await youtubeDl(`https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`, {
    dumpSingleJson: true,
    skipDownload: true,
    noWarnings: true,
    quiet: true,
    noCheckCertificates: true,
  }) as RawInfo;
  const formats = (raw.formats || [])
    .map(normalizeFormat)
    .filter((format) => format.itag > 0 && format.url && (format.has_audio || format.has_video));

  if (!formats.length) throw new Error('yt-dlp returned no playable formats.');

  return {
    basic_info: { title: raw.title },
    streaming_data: {
      formats: formats.filter((format) => format.has_video),
      adaptive_formats: formats.filter((format) => !format.has_video),
    },
  };
}
