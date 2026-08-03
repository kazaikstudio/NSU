import { promises as fs } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

type DriveUpload = {
  name: string;
  mimeType: string;
  bytes: ArrayBuffer;
};

type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
  webContentLink?: string;
  thumbnailLink?: string;
};

export type DriveStorageUsage = {
  used: number;
  limit: number | null;
  usedInDrive: number;
  usedInTrash: number;
};

async function fetchGoogle(input: string, init: RequestInit) {
  let lastError: unknown;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await fetch(input, init);
    } catch (error) {
      lastError = error;
      if (attempt < 2) {
        await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
      }
    }
  }

  throw new Error(`Unable to reach Google Drive: ${lastError instanceof Error ? lastError.message : 'network request failed'}`);
}

function getGoogleConfig() {
  const clientId = (process.env.GOOGLE_CLIENT_ID || process.env.CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID)?.trim();
  const clientSecret = (process.env.GOOGLE_CLIENT_SECRET || process.env.CLIENT_SECRET)?.trim();
  const refreshToken = [
    process.env.GOOGLE_REFRESH_TOKEN,
    process.env.GOOGLE_DRIVE_REFRESH_TOKEN,
    process.env.GOOGLE_OAUTH_REFRESH_TOKEN,
    process.env.REFRESH_TOKEN,
    process.env.CLIENT_REFRESH_TOKEN,
  ]
    .map((value) => value?.trim().replace(/^['"]|['"]$/g, ''))
    .find(Boolean);

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Google Drive is not configured. Set GOOGLE_CLIENT_ID/CLIENT_ID, GOOGLE_CLIENT_SECRET/CLIENT_SECRET, and GOOGLE_REFRESH_TOKEN/REFRESH_TOKEN on the server.');
  }

  if (/your_|example|placeholder/i.test(`${clientId} ${clientSecret} ${refreshToken}`)) {
    throw new Error('Google Drive is using placeholder credentials. Replace the Google OAuth environment variables with real server-side values.');
  }

  return { clientId, clientSecret, refreshToken };
}

function sanitizeLocalFileName(name: string) {
  return name
    .replace(/\\/g, '-')
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'upload';
}

export async function saveFileLocally(upload: DriveUpload) {
  const uploadDir = path.join(process.cwd(), 'uploads');
  await fs.mkdir(uploadDir, { recursive: true });

  const extension = path.extname(upload.name) || '';
  const baseName = sanitizeLocalFileName(path.basename(upload.name, extension));
  const fileName = `${Date.now()}-${randomUUID().slice(0, 8)}-${baseName}${extension}`;
  const filePath = path.join(uploadDir, fileName);
  await fs.writeFile(filePath, Buffer.from(upload.bytes));

  return {
    id: fileName,
    name: upload.name,
    mimeType: upload.mimeType,
    publicUrl: `/api/uploads/${fileName}`,
  };
}

async function getAccessToken() {
  const response = await fetchGoogle('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: getGoogleConfig().clientId,
      client_secret: getGoogleConfig().clientSecret,
      refresh_token: getGoogleConfig().refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  const data = await response.json();
  if (!response.ok || !data.access_token) {
    if (data.error === 'invalid_client') {
      throw new Error('Google rejected the OAuth client. Verify GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET belong to the client that issued GOOGLE_REFRESH_TOKEN.');
    }
    if (data.error === 'invalid_grant') {
      throw new Error('Google rejected the refresh token. Generate a new refresh token for this OAuth client with Drive access.');
    }
    throw new Error(data.error_description || 'Unable to authenticate with Google Drive');
  }

  return data.access_token as string;
}

export async function uploadToGoogleDrive(upload: DriveUpload) {
  const accessToken = await getAccessToken();
  const boundary = `noll-drive-${Date.now()}`;
  const metadata = JSON.stringify({
    name: upload.name,
    mimeType: upload.mimeType,
  });
  const encoder = new TextEncoder();
  const prefix = encoder.encode(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n` +
    `--${boundary}\r\nContent-Type: ${upload.mimeType || 'application/octet-stream'}\r\n\r\n`
  );
  const suffix = encoder.encode(`\r\n--${boundary}--\r\n`);
  const buffer = new Uint8Array(upload.bytes);
  const body = new Uint8Array(prefix.byteLength + buffer.byteLength + suffix.byteLength);
  body.set(prefix, 0);
  body.set(buffer, prefix.byteLength);
  body.set(suffix, prefix.byteLength + buffer.byteLength);

  const response = await fetchGoogle(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,webViewLink,webContentLink,thumbnailLink',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    }
  );
  const file = (await response.json()) as DriveFile & { error?: { message?: string; errors?: Array<{ message?: string }> } };
  if (!response.ok || !file.id) {
    const detail = file.error?.errors?.[0]?.message || file.error?.message;
    throw new Error(detail || 'Unable to upload file to Google Drive');
  }

  const permissionResponse = await fetchGoogle(`https://www.googleapis.com/drive/v3/files/${file.id}/permissions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ role: 'reader', type: 'anyone', allowFileDiscovery: false }),
  });

  if (!permissionResponse.ok) {
    throw new Error('File uploaded, but Google Drive sharing could not be enabled');
  }

  return {
    ...file,
    publicUrl: file.mimeType.startsWith('image/')
      ? `https://drive.google.com/thumbnail?id=${file.id}&sz=w1600`
      : `/api/dashboard/media/${file.id}`,
  };
}

export async function deleteFromGoogleDrive(fileId: string) {
  const accessToken = await getAccessToken();
  const response = await fetchGoogle(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok && response.status !== 404) {
    throw new Error(`Unable to delete Google Drive file ${fileId}`);
  }
}

export async function getGoogleDriveStorageUsage(): Promise<DriveStorageUsage> {
  const accessToken = await getAccessToken();
  const response = await fetchGoogle('https://www.googleapis.com/drive/v3/about?fields=storageQuota', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await response.json() as {
    storageQuota?: { usage?: string; limit?: string; usageInDrive?: string; usageInDriveTrash?: string };
  };

  if (!response.ok) {
    const apiError = (data as any)?.error;
    if (response.status === 401) {
      throw new Error(apiError?.message || 'Unauthorized: Google Drive access denied. Check OAuth credentials and refresh token.');
    }
    if (response.status === 403) {
      throw new Error(apiError?.message || 'Forbidden: Google Drive API refused the request. Ensure the refresh token has Drive scopes.');
    }
    throw new Error(apiError?.message || 'Unable to read Google Drive storage usage');
  }

  if (!data.storageQuota) {
    throw new Error('Google Drive did not return storage information');
  }

  return {
    used: Number(data.storageQuota.usage || 0),
    limit: data.storageQuota.limit ? Number(data.storageQuota.limit) : null,
    usedInDrive: Number(data.storageQuota.usageInDrive || 0),
    usedInTrash: Number(data.storageQuota.usageInDriveTrash || 0),
  };
}