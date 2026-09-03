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
  ext?: string;
  format_note?: string;
  height?: number;
  tbr?: number;
  abr?: number;
  vbr?: number;
  filesize?: number;
  filesize_approx?: number;
  acodec?: string;
  vcodec?: string;
};

type RawInfo = { title?: string; formats?: RawFormat[] };

function normalizeFormat(format: RawFormat): DlpFormat {
  const hasAudio = Boolean(format.acodec && format.acodec !== 'none');
  const hasVideo = Boolean(format.vcodec && format.vcodec !== 'none');
  const extension = format.ext || 'mp4';
  return {
    itag: Number(format.format_id),
    url: format.url,
    mime_type: `${hasAudio && !hasVideo ? 'audio' : 'video'}/${extension}`,
    bitrate: Math.round((format.tbr || format.abr || format.vbr || 0) * 1000),
    content_length: format.filesize || format.filesize_approx,
    quality_label: format.height ? `${format.height}p` : format.format_note,
    has_audio: hasAudio,
    has_video: hasVideo,
    has_text: false,
    is_original: true,
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
    .filter((format) => format.itag > 0 && format.url);

  if (!formats.length) throw new Error('yt-dlp returned no playable formats.');

  return {
    basic_info: { title: raw.title },
    streaming_data: {
      formats: formats.filter((format) => format.has_video),
      adaptive_formats: formats.filter((format) => !format.has_video),
    },
  };
}
