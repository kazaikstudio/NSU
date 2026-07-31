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
    const audioSource = allFormats
      .filter((format) => format.has_audio && !format.has_video && !format.has_text)
      .sort((left, right) => right.bitrate - left.bitrate)[0];
    const videoSource = allFormats
      .filter((format) => {
        const quality = Number(format.quality_label?.match(/^(\d+)p$/)?.[1] || 0);
        return format.has_video && format.has_audio && !format.has_text && quality >= 360;
      })
      .sort((left, right) => {
        const leftQuality = Number(left.quality_label?.match(/^(\d+)p$/)?.[1] || 0);
        const rightQuality = Number(right.quality_label?.match(/^(\d+)p$/)?.[1] || 0);
        return leftQuality - rightQuality || left.bitrate - right.bitrate;
      });
    const formats = [
      ...(audioSource ? [
        { itag: audioSource.itag, label: 'MP3 128 kbps', kind: 'audio', mimeType: 'audio/mpeg', extension: 'mp3', outputBitrate: 128, size: null, bitrate: 128000 },
        { itag: audioSource.itag, label: 'MP3 192 kbps', kind: 'audio', mimeType: 'audio/mpeg', extension: 'mp3', outputBitrate: 192, size: null, bitrate: 192000 },
        { itag: audioSource.itag, label: 'MP3 320 kbps', kind: 'audio', mimeType: 'audio/mpeg', extension: 'mp3', outputBitrate: 320, size: null, bitrate: 320000 },
      ] : []),
      ...videoSource.map((video) => ({
        itag: video.itag,
        label: video.quality_label || 'Video',
        kind: 'video+audio',
        mimeType: 'video/mp4',
        extension: 'mp4',
        size: video.content_length || null,
        bitrate: video.bitrate,
      })),
    ];

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
