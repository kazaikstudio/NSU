import { NextResponse } from 'next/server';
import { ClientType, Innertube } from 'youtubei.js';
import { getFfmpegDiagnostics, getRuntimeDiagnostics } from '@/lib/youtube-download-diagnostics';
import ffmpegPath from 'ffmpeg-static';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

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

function getFfmpegPath() {
  const localPath = join(process.cwd(), 'node_modules', 'ffmpeg-static', 'ffmpeg');
  return [process.env.FFMPEG_PATH, localPath, ffmpegPath].find((path): path is string => Boolean(path && existsSync(path)));
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
    const ffmpegAvailable = Boolean(getFfmpegPath());
    const audioSource = allFormats
      .filter((format) => format.has_audio && !format.has_video && !format.has_text)
      .sort((left, right) => right.bitrate - left.bitrate)[0]
      || allFormats
        .filter((format) => format.has_audio && !format.has_text)
        .sort((left, right) => right.bitrate - left.bitrate)[0];
    const directVideoSources = allFormats
      .filter((format) => {
        const quality = Number(format.quality_label?.match(/^(\d+)p$/)?.[1] || 0);
        return (
          format.has_video &&
          format.has_audio &&
          !format.has_text &&
          format.mime_type?.startsWith('video/mp4') &&
          quality >= 360
        );
      })
      .sort((left, right) => {
        const leftQuality = Number(left.quality_label?.match(/^(\d+)p$/)?.[1] || 0);
        const rightQuality = Number(right.quality_label?.match(/^(\d+)p$/)?.[1] || 0);
        return leftQuality - rightQuality || left.bitrate - right.bitrate;
      });
    const mergeOnlyVideoSources = ffmpegAvailable
      ? allFormats
          .filter((format) => {
            const quality = Number(format.quality_label?.match(/^(\d+)p$/)?.[1] || 0);
            return (
              format.has_video &&
              !format.has_audio &&
              !format.has_text &&
              format.mime_type?.startsWith('video/mp4') &&
              quality >= 360
            );
          })
          .sort((left, right) => {
            const leftQuality = Number(left.quality_label?.match(/^(\d+)p$/)?.[1] || 0);
            const rightQuality = Number(right.quality_label?.match(/^(\d+)p$/)?.[1] || 0);
            return leftQuality - rightQuality || left.bitrate - right.bitrate;
          })
      : [];
    const formats = [
      ...(ffmpegAvailable && audioSource ? [
        { itag: audioSource.itag, label: 'MP3 128 kbps', kind: 'audio', mimeType: 'audio/mpeg', extension: 'mp3', outputBitrate: 128, size: null, bitrate: 128000 },
        { itag: audioSource.itag, label: 'MP3 192 kbps', kind: 'audio', mimeType: 'audio/mpeg', extension: 'mp3', outputBitrate: 192, size: null, bitrate: 192000 },
        { itag: audioSource.itag, label: 'MP3 320 kbps', kind: 'audio', mimeType: 'audio/mpeg', extension: 'mp3', outputBitrate: 320, size: null, bitrate: 320000 },
      ] : []),
      ...directVideoSources.map((video) => ({
        itag: video.itag,
        label: video.quality_label || 'Video',
        kind: 'video+audio',
        mimeType: 'video/mp4',
        extension: 'mp4',
        size: video.content_length || null,
        bitrate: video.bitrate,
      })),
      ...mergeOnlyVideoSources.map((video) => ({
        itag: video.itag,
        label: `${video.quality_label || 'Video'} (server merged)`,
        kind: 'video',
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
      diagnostics: {
        runtime: getRuntimeDiagnostics(),
        ffmpeg: getFfmpegDiagnostics(getFfmpegPath()),
        formatCounts: {
          total: allFormats.length,
          audioOnly: allFormats.filter((format) => format.has_audio && !format.has_video && !format.has_text).length,
          videoMp4: allFormats.filter((format) => format.has_video && format.mime_type?.startsWith('video/mp4')).length,
          directVideoMp4: directVideoSources.length,
          mergeOnlyVideoMp4: mergeOnlyVideoSources.length,
          exposedFormats: formats.length,
        },
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unable to fetch YouTube formats.',
        code: 'YOUTUBE_INFO_FAILED',
        diagnostics: {
          runtime: getRuntimeDiagnostics(),
          ffmpeg: getFfmpegDiagnostics(getFfmpegPath()),
          errorName: error instanceof Error ? error.name : 'UnknownError',
        },
      },
      { status: 502 },
    );
  }
}
