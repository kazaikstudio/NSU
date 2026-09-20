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

export type PythonDownloadProgress = {
  percent: number;
  downloadedBytes?: number;
  totalBytes?: number;
};

export type PythonDownloadParams = {
  videoId: string;
  itag: number;
  output: string;
  bitrate: number;
  outPrefix: string;
  ffmpegLocation?: string | null;
  onProgress?: (progress: PythonDownloadProgress) => void;
  signal?: AbortSignal;
};

export async function downloadWithPython(params: PythonDownloadParams): Promise<PythonDownloadResult> {
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

  return new Promise((resolve, reject) => {
    let stdoutBuffer = '';
    let stderr = '';
    let lastDone: PythonDownloadResult | null = null;

    const child = spawn(getPythonBinary(), [YOUTUBE_DLP_SCRIPT, 'download', ...args], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
    });

    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error('The Python download worker timed out.'));
    }, 90_000);

    const onAbort = () => child.kill('SIGKILL');
    params.signal?.addEventListener('abort', onAbort, { once: true });
    if (params.signal?.aborted) onAbort();

    const handleLine = (line: string) => {
      let payload: Record<string, unknown>;
      try {
        payload = JSON.parse(line) as Record<string, unknown>;
      } catch {
        return;
      }

      if (payload.type === 'progress' && typeof payload.percent === 'number' && params.onProgress) {
        params.onProgress({
          percent: payload.percent,
          downloadedBytes: typeof payload.downloadedBytes === 'number' ? payload.downloadedBytes : undefined,
          totalBytes: typeof payload.totalBytes === 'number' ? payload.totalBytes : undefined,
        });
      } else if (payload.status === 'done' && typeof payload.file === 'string') {
        lastDone = {
          videoId: String(payload.videoId || params.videoId),
          title: typeof payload.title === 'string' && payload.title ? payload.title : `youtube-${params.videoId}`,
          file: payload.file,
          size: Number(payload.size) || 0,
          contentType: typeof payload.contentType === 'string' ? payload.contentType : 'application/octet-stream',
        };
      }
    };

    const drainStdout = () => {
      let newlineIndex: number;
      while ((newlineIndex = stdoutBuffer.indexOf('\n')) !== -1) {
        const line = stdoutBuffer.slice(0, newlineIndex).trim();
        stdoutBuffer = stdoutBuffer.slice(newlineIndex + 1);
        if (line) handleLine(line);
      }
      if (stdoutBuffer.trim()) {
        handleLine(stdoutBuffer.trim());
        stdoutBuffer = '';
      }
    };

    child.stdout.on('data', (chunk) => {
      stdoutBuffer += chunk.toString();
      drainStdout();
    });

    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });

    child.once('error', (error) => {
      clearTimeout(timer);
      params.signal?.removeEventListener('abort', onAbort);
      reject(new Error(`The Python runtime could not start the download worker: ${error.message}`));
    });

    child.once('close', (code) => {
      clearTimeout(timer);
      params.signal?.removeEventListener('abort', onAbort);
      drainStdout();
      if (lastDone) {
        resolve(lastDone);
        return;
      }
      const errorPayload = parseJsonObject(stderr.trim());
      const message = errorPayload && typeof errorPayload.error === 'string' && errorPayload.error
        ? errorPayload.error
        : `The Python download worker exited with code ${code}.`;
      const error = new Error(message) as Error & { detail?: string; workerCode?: number | null };
      error.detail = stderr.trim().slice(0, 2000) || undefined;
      error.workerCode = code;
      reject(error);
    });
  });
}