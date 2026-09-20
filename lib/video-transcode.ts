import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ffmpegPath from 'ffmpeg-static';

const VIDEO_EXTENSIONS = new Set([
  'mp4',
  'm4v',
  'mov',
  'webm',
  'mkv',
  'avi',
  'flv',
  'wmv',
  'ts',
  'mts',
  'm2ts',
  '3gp',
  'ogv',
  'mpeg',
  'mpg',
]);

const COMPATIBLE_CONTAINERS = new Set(['mp4', 'm4v']);

const TRANSCODE_TIMEOUT_MS = 10 * 60 * 1000;

export function getVideoTranscodeThreshold() {
  const configured = Number(process.env.VIDEO_TRANSCODE_THRESHOLD_MB);
  return Number.isFinite(configured) && configured > 0 ? configured * 1024 * 1024 : 12 * 1024 * 1024;
}

function getFileExtension(name: string) {
  const lastDot = name.lastIndexOf('.');
  return lastDot > 0 ? name.slice(lastDot + 1).toLowerCase() : '';
}

export function isVideoUpload(name: string, mimeType: string) {
  return mimeType.trim().toLowerCase().startsWith('video/') || VIDEO_EXTENSIONS.has(getFileExtension(name));
}

export function shouldTranscodeVideo(name: string, mimeType: string, byteLength: number) {
  if (!isVideoUpload(name, mimeType)) {
    return false;
  }

  const extension = getFileExtension(name);
  const isCompatibleContainer = COMPATIBLE_CONTAINERS.has(extension);

  return byteLength > getVideoTranscodeThreshold() || !isCompatibleContainer;
}

function getFfmpegPath() {
  const localPath = join(process.cwd(), 'node_modules', 'ffmpeg-static', 'ffmpeg');
  return [process.env.FFMPEG_PATH, localPath, ffmpegPath].find((path): path is string => Boolean(path && existsSync(path)));
}

function runFfmpeg(executable: string, args: string[]) {
  return new Promise<boolean>((resolve) => {
    const converter = spawn(executable, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    const stderr: string[] = [];
    converter.stderr?.on('data', (chunk) => {
      stderr.push(String(chunk));
    });

    const timeout = setTimeout(() => {
      converter.kill('SIGTERM');
    }, TRANSCODE_TIMEOUT_MS);

    converter.once('error', () => {
      clearTimeout(timeout);
      resolve(false);
    });

    converter.once('close', (code) => {
      clearTimeout(timeout);
      if (code && code !== 0) {
        console.warn('ffmpeg transcode failed', {
          code,
          output: args[args.length - 1],
          stderr: stderr.join('').trim().slice(0, 2000),
        });
        resolve(false);
      } else {
        resolve(true);
      }
    });
  });
}

export type TranscodedVideo = {
  name: string;
  mimeType: string;
  bytes: Uint8Array;
};

export async function transcodeVideoToStreamable(
  bytes: ArrayBuffer,
  name: string,
): Promise<TranscodedVideo | null> {
  const executable = getFfmpegPath();
  if (!executable) {
    return null;
  }

  let directory: string | null = null;

  try {
    directory = await mkdtemp(join(tmpdir(), 'nsu-video-'));
    const extension = getFileExtension(name) || 'mp4';
    const inputPath = join(directory, `input.${extension}`);
    const outputPath = join(directory, 'output.mp4');
    await writeFile(inputPath, Buffer.from(bytes));

    const ffmpegArgs = [
      '-y',
      '-loglevel', 'error',
      '-i', inputPath,
      '-map', '0:v:0?',
      '-map', '0:a:0?',
      '-vf', "scale='min(960,iw)':'min(540,ih)':force_original_aspect_ratio=decrease",
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-crf', '26',
      '-c:a', 'aac',
      '-b:a', '96k',
      '-ac', '2',
      '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart',
      '-f', 'mp4',
      outputPath,
    ];

    const succeeded = await runFfmpeg(executable, ffmpegArgs);
    if (!succeeded) {
      return null;
    }

    const output = await readFile(outputPath);
    if (output.byteLength <= 0) {
      return null;
    }

    const isCompatibleContainer = COMPATIBLE_CONTAINERS.has(extension);
    if (output.byteLength >= bytes.byteLength && isCompatibleContainer) {
      return null;
    }

    const baseName = name.replace(/\.[^./]+$/, '');
    return {
      name: `${baseName || 'video'}.mp4`,
      mimeType: 'video/mp4',
      bytes: new Uint8Array(output),
    };
  } catch (error) {
    console.warn(
      'Video transcoding failed; storing the original file',
      error instanceof Error ? error.message : String(error),
    );
    return null;
  } finally {
    if (directory) {
      await rm(directory, { recursive: true, force: true }).catch(() => {});
    }
  }
}