import { NextResponse } from 'next/server';
import { ClientType, Innertube } from 'youtubei.js';
import { getFfmpegDiagnostics, getRuntimeDiagnostics } from '@/lib/youtube-download-diagnostics';
import ffmpegPath from 'ffmpeg-static';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { configureYoutubeEvaluator, getYoutubeSessionConfig } from '@/lib/youtube-client';
import { getYoutubePageInfo } from '@/lib/youtube-page';
import { getYoutubeDlpInfo } from '@/lib/youtube-dlp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

configureYoutubeEvaluator();

const YOUTUBE_CLIENT_TYPES = [
  ClientType.WEB,
  ClientType.MWEB,
  ClientType.TV,
  ClientType.ANDROID,
  ClientType.ANDROID_VR,
  ClientType.WEB_EMBEDDED,
  ClientType.IOS,
] as const;

async function getYoutubeVideoInfo(videoId: string) {
  let lastError: unknown;

  try {
    const info = await getYoutubeDlpInfo(videoId);
    return { youtube: undefined, info, clientType: 'yt-dlp' as const };
  } catch (error) {
    lastError = error;
  }

  try {
    const pageInfo = await getYoutubePageInfo(videoId);
    const pageFormats = [
      ...pageInfo.streaming_data.formats,
      ...pageInfo.streaming_data.adaptive_formats,
    ];
    if (pageFormats.some((format) => format.url)) {
      return { youtube: undefined, info: pageInfo, clientType: 'watch-page' as const };
    }
  } catch (error) {
    lastError = error;
  }

  for (const clientType of YOUTUBE_CLIENT_TYPES) {
    try {
      const youtube = await Innertube.create({
        ...getYoutubeSessionConfig(),
        client_type: clientType,
        retrieve_player: true,
      });
      const info = await youtube.getBasicInfo(videoId);
      const formatCount = (info.streaming_data?.formats?.length ?? 0) + (info.streaming_data?.adaptive_formats?.length ?? 0);
      if (formatCount > 0) {
        const formats = [...(info.streaming_data?.formats || []), ...(info.streaming_data?.adaptive_formats || [])];
        if (formats.some((format) => format.url)) {
          return { youtube, info, clientType };
        }
        try {
          return { youtube: undefined, info: await getYoutubePageInfo(videoId), clientType: 'watch-page' as const };
        } catch {
          return { youtube, info, clientType };
        }
      }

      lastError = new Error(`No playable stream metadata for ${videoId}`);
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError) {
    try {
      return { youtube: undefined, info: await getYoutubePageInfo(videoId), clientType: 'watch-page' as const };
    } catch {
      throw lastError;
    }
  }

  throw new Error(`Unable to fetch YouTube metadata for ${videoId}`);
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
    const { info } = await getYoutubeVideoInfo(id);
    const allFormats = [
      ...(info.streaming_data?.formats || []),
      ...(info.streaming_data?.adaptive_formats || []),
    ];

    if (allFormats.length === 0) {
      return NextResponse.json({
        error: 'This YouTube video is not currently returning playable streams from the server runtime.',
        code: 'NO_STREAMS_AVAILABLE',
        videoId: id,
        title: info.basic_info?.title || `YouTube video ${id}`,
        diagnostics: {
          runtime: getRuntimeDiagnostics(),
          ffmpeg: getFfmpegDiagnostics(getFfmpegPath()),
          formatCounts: {
            total: 0,
            audioOnly: 0,
            videoMp4: 0,
            directVideoMp4: 0,
            mergeOnlyVideoMp4: 0,
            exposedFormats: 0,
          },
        },
      }, { status: 404 });
    }

    const ffmpegAvailable = Boolean(getFfmpegPath());
    const audioSource = allFormats
      .filter((format) => format.has_audio && !format.has_video && !format.has_text && format.url)
      .sort((left, right) => right.bitrate - left.bitrate)[0]
      || allFormats
        .filter((format) => format.has_audio && !format.has_text && format.url)
        .sort((left, right) => right.bitrate - left.bitrate)[0];
    const audioFormats = allFormats
      .filter((format) => format.has_audio && !format.has_video && !format.has_text && format.url)
      .sort((left, right) => right.bitrate - left.bitrate);
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
        { itag: audioSource.itag, label: 'MP3 192 kbps', kind: 'audio', mimeType: 'audio/mpeg', extension: 'mp3', outputBitrate: 192, size: null, bitrate: 192000 },
        ...audioFormats.map((audio) => ({
          itag: audio.itag,
          label: `${Math.round(audio.bitrate / 1000)} kbps M4A`,
          kind: 'audio',
          mimeType: 'audio/mp4',
          extension: 'm4a',
          outputBitrate: 192,
          size: audio.content_length || null,
          bitrate: audio.bitrate,
        })),
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
        label: video.quality_label || 'Video',
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
