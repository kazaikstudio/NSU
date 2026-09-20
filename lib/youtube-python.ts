import { spawn } from 'node:child_process';
import { join } from 'node:path';

export type PythonDownloadFormat = {
  itag: number;
  label: string;
  kind: string;
  extension: string;
  outputBitrate?: number;
  size: number | null;
};

export type PythonFormatsResult = {
  videoId: string;
  title: string;
  formats: PythonDownloadFormat[];
};

export type PythonDownloadResult = {
  videoId: string;
  title: string;
  file: string;
  size: number;
  contentType: string;
};

const YOUTUBE_DLP_SCRIPT = join(process.cwd(), 'scripts', 'youtube_dlp.py');

function getPythonBinary() {
  return process.env.PYTHON_BIN || 'python3';
}

type RunPythonResult = {
  stdout: string;
  stderr: string;
  code: number | null;
};

function runPython(args: string[], timeoutMs: number): Promise<RunPythonResult> {
  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';

    const child = spawn(getPythonBinary(), args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
    });

    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error('The Python download worker timed out.'));
    }, timeoutMs);

    child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.once('error', (error) => {
      clearTimeout(timer);
      reject(new Error(`The Python runtime could not start the download worker: ${error.message}`));
    });
    child.once('close', (code) => {
      clearTimeout(timer);
      resolve({ stdout, stderr, code });
    });
  });
}

function parseJsonObject(raw: string): Record<string, unknown> | null {
  try {
    const payload = JSON.parse(raw) as Record<string, unknown>;
    if (payload && typeof payload === 'object') return payload;
  } catch {
    // Not JSON; the caller decides how to fall back.
  }
  return null;
}

function parseWorkerPayload(stdout: string, stderr: string, fallback: string): Record<string, unknown> {
  const primary = parseJsonObject(stdout);
  if (primary && primary.status === 'done') return primary;
  if (primary && primary.status !== 'done') return primary;

  const errorPayload = parseJsonObject(stderr);
  if (errorPayload) return errorPayload;

  if (primary) return primary;
  return {
    status: 'error',
    error: 'The Python download worker returned an unreadable response.',
    detail: fallback.slice(0, 2000),
  };
}

async function runWorker(command: string, args: string[], timeoutMs: number) {
  if (typeof process === 'undefined') throw new Error('The Python download worker requires a Node runtime.');
  const { stdout, stderr, code } = await runPython([YOUTUBE_DLP_SCRIPT, command, ...args], timeoutMs);
  const fallbackDetail = stdout || stderr;
  const payload = parseWorkerPayload(stdout, stderr, fallbackDetail);

  if (code !== 0 || payload.status !== 'done') {
    const message = typeof payload.error === 'string' && payload.error
      ? payload.error
      : `The Python download worker exited with code ${code}.`;
    const error = new Error(message) as Error & { detail?: string; workerCode?: number | null };
    error.detail = stderr.trim().slice(0, 2000) || undefined;
    error.workerCode = code;
    throw error;
  }

  return payload;
}

export async function getYoutubePythonFormats(videoId: string): Promise<PythonFormatsResult> {
  const payload = await runWorker('formats', [videoId], 45_000);
  return {
    videoId: String(payload.videoId || videoId),
    title: typeof payload.title === 'string' ? payload.title : `youtube-${videoId}`,
    formats: Array.isArray(payload.formats) ? payload.formats as unknown as PythonDownloadFormat[] : [],
  };
}

export async function downloadWithPython(params: {
  videoId: string;
  itag: number;
  output: string;
  bitrate: number;
  outPrefix: string;
  ffmpegLocation?: string | null;
}): Promise<PythonDownloadResult> {
  const args = [
    '--id', params.videoId,
    '--itag', String(params.itag),
    '--output', params.output,
    '--bitrate', String(params.bitrate),
    '--out', params.outPrefix,
  ];
  if (params.ffmpegLocation) {
    args.push('--ffmpeg-location', params.ffmpegLocation);
  }

  const payload = await runWorker('download', args, 90_000);
  return {
    videoId: String(payload.videoId || params.videoId),
    title: typeof payload.title === 'string' && payload.title ? payload.title : `youtube-${params.videoId}`,
    file: String(payload.file || ''),
    size: Number(payload.size) || 0,
    contentType: typeof payload.contentType === 'string' ? payload.contentType : 'application/octet-stream',
  };
}