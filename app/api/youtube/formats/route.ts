import { NextResponse } from 'next/server';
import { ClientType, Innertube } from 'youtubei.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

let youtubeClientPromise: Promise<Innertube> | undefined;

function getYoutubeClient() {
  youtubeClientPromise ??= Innertube.create({ client_type: ClientType.ANDROID_VR, retrieve_player: true });
  return youtubeClientPromise;
}

function isVideoId(value: string) {
  return /^[a-zA-Z0-9_-]{11}$/.test(value);
}

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get('id')?.trim() || '';

  if (!isVideoId(id)) {
    return NextResponse.json({ error: 'Invalid YouTube video ID.' }, { status: 400 });
  }

  try {
    const youtube = await getYoutubeClient();
    const info = await youtube.getBasicInfo(id);
    const allFormats = [
      ...(info.streaming_data?.formats || []),
      ...(info.streaming_data?.adaptive_formats || []),
    ];
    const formats = Array.from(new Map(
      allFormats
        .filter((format) => (format.has_video || format.has_audio) && !format.has_text)
        .map((format) => [format.itag, format]),
    ).values())
      .sort((left, right) => {
        const kindWeight = Number(right.has_video) - Number(left.has_video);
        return kindWeight || (right.height || 0) - (left.height || 0) || right.bitrate - left.bitrate;
      })
      .map((format) => {
        const [mimeType] = format.mime_type.split(';');
        const extension = mimeType.split('/')[1] || 'bin';
        const kind = format.has_video && format.has_audio
          ? 'video+audio'
          : format.has_video
            ? 'video'
            : 'audio';

        return {
          itag: format.itag,
          label: format.quality_label || format.quality || (format.has_audio ? 'Audio' : 'Video'),
          kind,
          mimeType,
          extension,
          codec: format.mime_type,
          hasAudio: format.has_audio,
          hasVideo: format.has_video,
          size: format.content_length || null,
          bitrate: format.bitrate,
        };
      });

    return NextResponse.json({
      videoId: id,
      title: info.basic_info.title || `YouTube video ${id}`,
      formats,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to fetch YouTube formats.' },
      { status: 502 },
    );
  }
}
