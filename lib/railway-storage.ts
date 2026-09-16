import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';

type StorageUpload = {
  name: string;
  mimeType: string;
  bytes: ArrayBuffer;
};

export type BucketStorageUsage = {
  used: number;
  limit: number | null;
  usedInDrive: number;
  usedInTrash: number;
};

const BUCKET_KEY_PREFIX = 'media-';

export type BucketFolder = 'music' | 'images' | 'videos';

function readFirstEnvValue(names: string[]) {
  return names
    .map((name) => process.env[name]?.trim().replace(/^['"]|['"]$/g, ''))
    .find(Boolean);
}

export type BucketConfig = {
  label: string;
  endpoint: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
};

export function getBucketConfig(): BucketConfig {
  const endpoint = readFirstEnvValue(['RAILWAY_BUCKET_ENDPOINT', 'BUCKET_ENDPOINT', 'AWS_ENDPOINT_URL', 'ENDPOINT', 'Endpoint']);
  const bucket = readFirstEnvValue(['RAILWAY_BUCKET_NAME', 'BUCKET_NAME', 'AWS_S3_BUCKET_NAME', 'S3_BUCKET_NAME', 'BUCKET', 'Bucket']);
  const accessKeyId = readFirstEnvValue(['RAILWAY_BUCKET_ACCESS_KEY', 'BUCKET_ACCESS_KEY_ID', 'AWS_ACCESS_KEY_ID', 'ACCESS_KEY_ID', 'Access']);
  const secretAccessKey = readFirstEnvValue(['RAILWAY_BUCKET_SECRET_KEY', 'BUCKET_SECRET_ACCESS_KEY', 'AWS_SECRET_ACCESS_KEY', 'SECRET_ACCESS_KEY', 'Secret']);
  const region = readFirstEnvValue(['RAILWAY_BUCKET_REGION', 'AWS_REGION', 'AWS_DEFAULT_REGION', 'REGION']) || 'auto';

  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
    throw new Error(
      'Railway bucket storage is not configured. Set RAILWAY_BUCKET_ENDPOINT, RAILWAY_BUCKET_NAME, RAILWAY_BUCKET_ACCESS_KEY, and RAILWAY_BUCKET_SECRET_KEY on the server.'
    );
  }

  if (/your_|example|placeholder/i.test(`${endpoint} ${bucket} ${accessKeyId} ${secretAccessKey}`)) {
    throw new Error('Railway bucket storage is using placeholder credentials. Replace the bucket environment variables with real server-side values.');
  }

  return { label: 'Railway Bucket', endpoint, bucket, accessKeyId, secretAccessKey, region };
}

let s3Client: S3Client | null = null;

export function getBucketClient() {
  if (s3Client) {
    return s3Client;
  }

  const config = getBucketConfig();
  s3Client = new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    forcePathStyle: false,
  });

  return s3Client;
}

export function resolveBucketFolderName(upload: Partial<StorageUpload> & { kind?: string; type?: string }) {
  const type = (upload.type || '').trim().toLowerCase();
  const mimeType = (upload.mimeType || '').trim().toLowerCase();
  const kind = (upload.kind || '').trim().toLowerCase();

  if (kind === 'banner' || kind === 'profile' || mimeType.startsWith('image/') || type === 'image') {
    return 'images' as const;
  }

  if (mimeType.startsWith('video/') || type === 'video') {
    return 'videos' as const;
  }

  if (mimeType.startsWith('audio/') || type === 'music' || type === 'track' || kind === 'track') {
    return 'music' as const;
  }

  return 'music' as const;
}

export function isBucketKey(id: string | null | undefined): id is string {
  if (typeof id !== 'string' || !id.trim()) {
    return false;
  }

  const normalized = decodeURIComponent(id).replace(/\\/g, '/');
  if (!normalized || normalized.includes('..')) {
    return false;
  }

  return /^[A-Za-z0-9._/-]+$/.test(normalized) && normalized.split('/').every((segment) => segment.length > 0);
}

export function generateBucketKey(name: string, folder: BucketFolder = 'music') {
  const slug = name
    .replace(/\\/g, '-')
    .replace(/\.[a-zA-Z0-9]+$/, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);

  const safeFolder = folder.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-|-$/g, '') || 'media';
  return `${safeFolder}/${BUCKET_KEY_PREFIX}${Date.now()}-${randomUUID().slice(0, 8)}${slug ? `-${slug}` : ''}`;
}

export async function uploadToBucket(upload: StorageUpload & { kind?: string; type?: string }) {
  const config = getBucketConfig();
  const folder = resolveBucketFolderName(upload);
  const key = generateBucketKey(upload.name, folder);

  await getBucketClient().send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      Body: Buffer.from(upload.bytes),
      ContentType: upload.mimeType || 'application/octet-stream',
    })
  );

  return {
    id: key,
    name: upload.name,
    mimeType: upload.mimeType,
    publicUrl: `/api/dashboard/media/${encodeURIComponent(key)}`,
  };
}

export async function deleteFromBucket(key: string) {
  const config = getBucketConfig();
  await getBucketClient().send(
    new DeleteObjectCommand({
      Bucket: config.bucket,
      Key: key,
    })
  );
}

export async function deleteStoredObject(key: string) {
  if (isBucketKey(key)) {
    await deleteFromBucket(key);
  }
}

export function isBucketNotFoundError(error: unknown) {
  if (error instanceof S3ServiceException) {
    return (
      error.name === 'NoSuchKey' ||
      error.name === 'NotFound' ||
      error.name === 'NoSuchBucket' ||
      error.$metadata.httpStatusCode === 404
    );
  }
  return false;
}

async function buildResponseHeaders(result: { ContentType?: string; ContentLength?: number; ContentRange?: string; AcceptRanges?: string }) {
  const headers = new Headers();
  if (result.ContentType) headers.set('Content-Type', result.ContentType);
  if (result.ContentLength !== undefined && result.ContentLength !== null) headers.set('Content-Length', String(result.ContentLength));
  if (result.ContentRange) headers.set('Content-Range', result.ContentRange);
  if (result.AcceptRanges) headers.set('Accept-Ranges', result.AcceptRanges);
  headers.set('Vary', 'Range');
  return headers;
}

export async function getBucketObject(key: string, range?: string): Promise<Response> {
  const config = getBucketConfig();
  const normalizedRange = range?.trim();

  if (normalizedRange) {
    const result = await getBucketClient().send(
      new GetObjectCommand({
        Bucket: config.bucket,
        Key: key,
        Range: normalizedRange,
      })
    );
    const headers = await buildResponseHeaders(result);
    return new Response(result.Body?.transformToWebStream() ?? null, { status: 206, headers });
  }

  const result = await getBucketClient().send(
    new GetObjectCommand({
      Bucket: config.bucket,
      Key: key,
    })
  );
  const headers = await buildResponseHeaders(result);
  return new Response(result.Body?.transformToWebStream() ?? null, { status: 200, headers });
}

export async function headBucketObject(key: string): Promise<Response> {
  const config = getBucketConfig();
  const result = await getBucketClient().send(
    new HeadObjectCommand({
      Bucket: config.bucket,
      Key: key,
    })
  );
  const headers = await buildResponseHeaders(result);
  return new Response(null, { status: 200, headers });
}

export async function getBucketStorageUsage(): Promise<BucketStorageUsage> {
  const config = getBucketConfig();
  const client = getBucketClient();

  let used = 0;
  let continuationToken: string | undefined;

  do {
    const result = await client.send(
      new ListObjectsV2Command({
        Bucket: config.bucket,
        ContinuationToken: continuationToken,
      })
    );

    for (const object of result.Contents ?? []) {
      used += Number(object.Size || 0);
    }

    continuationToken = result.NextContinuationToken;
  } while (continuationToken);

  return { used, limit: null, usedInDrive: used, usedInTrash: 0 };
}

export type ConfiguredStorageEntry = {
  label: string;
  used: number;
  limit: number | null;
  usedInDrive: number;
  usedInTrash: number;
  error?: string;
};

export function isBucketConfigured() {
  try {
    getBucketConfig();
    return true;
  } catch {
    return false;
  }
}

export async function getConfiguredStorageEntries(): Promise<ConfiguredStorageEntry[]> {
  if (!isBucketConfigured()) {
    return [];
  }

  try {
    const storage = await getBucketStorageUsage();
    return [{ label: 'Railway Bucket', ...storage }];
  } catch (error) {
    return [{
      label: 'Railway Bucket',
      used: 0,
      limit: null,
      usedInDrive: 0,
      usedInTrash: 0,
      error: error instanceof Error ? error.message : String(error),
    }];
  }
}

export async function testBucketAuth(): Promise<{ ok: boolean; error?: string }> {
  try {
    const config = getBucketConfig();
    await getBucketClient().send(
      new ListObjectsV2Command({
        Bucket: config.bucket,
        MaxKeys: 1,
      })
    );
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}