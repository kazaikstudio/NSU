import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { randomUUID } from 'crypto';

type DriveUpload = {
  name: string;
  mimeType: string;
  bytes: ArrayBuffer;
};

type DriveConfig = {
  label: string;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  redirectUri?: string;
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

function normalizeDriveNetworkError(message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes('fetch failed') || normalized.includes('network request failed')) {
    return 'network access to Google Drive is unavailable';
  }
  return message;
}

async function fetchGoogle(input: string, init: RequestInit) {
  let lastError: unknown;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(input, init);
      if (!response.ok) {
        const data = await response.clone().json().catch(() => null);
        const apiError = data?.error?.message || data?.error?.errors?.[0]?.message || 'Google Drive rejected the request';
        throw new Error(apiError);
      }
      return response;
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('Google Drive')) {
        throw error;
      }

      lastError = error;
      if (attempt < 2) {
        await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
      }
    }
  }

  const detail = lastError instanceof Error ? normalizeDriveNetworkError(lastError.message) : 'network request failed';
  throw new Error(`Unable to reach Google Drive: ${detail}`);
}

const TALK_SHOW_DEFAULTS = {
  redirectUri: 'https://developers.google.com/oauthplayground',
};

function readFirstEnvValue(names: string[]) {
  return names
    .map((name) => process.env[name]?.trim().replace(/^['"]|['"]$/g, ''))
    .find(Boolean);
}

function getGoogleConfig(label = 'Primary Drive', clientIdNames = ['GOOGLE_CLIENT_ID', 'CLIENT_ID', 'NEXT_PUBLIC_GOOGLE_CLIENT_ID'], clientSecretNames = ['GOOGLE_CLIENT_SECRET', 'CLIENT_SECRET'], refreshTokenNames = ['GOOGLE_REFRESH_TOKEN', 'GOOGLE_DRIVE_REFRESH_TOKEN', 'GOOGLE_OAUTH_REFRESH_TOKEN', 'REFRESH_TOKEN', 'CLIENT_REFRESH_TOKEN'], redirectUriNames = ['REDIRECT_URI', 'GOOGLE_REDIRECT_URI']) {
  const talkShowClientIdNames = ['TALK_SHOW_CLIENT_ID', 'GOOGLE_CLIENT_ID', 'CLIENT_ID', 'NEXT_PUBLIC_GOOGLE_CLIENT_ID'];
  const talkShowClientSecretNames = ['TALK_SHOW_CLIENT_SECRET', 'GOOGLE_CLIENT_SECRET', 'CLIENT_SECRET'];
  const talkShowRefreshTokenNames = ['TALK_SHOW_REFRESH_TOKEN', 'GOOGLE_REFRESH_TOKEN', 'GOOGLE_DRIVE_REFRESH_TOKEN', 'GOOGLE_OAUTH_REFRESH_TOKEN', 'REFRESH_TOKEN', 'CLIENT_REFRESH_TOKEN'];
  const talkShowRedirectUriNames = ['TALK_SHOW_REDIRECT_URI', 'REDIRECT_URI', 'GOOGLE_REDIRECT_URI'];

  const resolvedClientIdNames = label === 'Talk Show' ? talkShowClientIdNames : clientIdNames;
  const resolvedClientSecretNames = label === 'Talk Show' ? talkShowClientSecretNames : clientSecretNames;
  const resolvedRefreshTokenNames = label === 'Talk Show' ? talkShowRefreshTokenNames : refreshTokenNames;
  const resolvedRedirectUriNames = label === 'Talk Show' ? talkShowRedirectUriNames : redirectUriNames;

  const clientId = readFirstEnvValue(resolvedClientIdNames);
  const clientSecret = readFirstEnvValue(resolvedClientSecretNames);
  const refreshToken = readFirstEnvValue(resolvedRefreshTokenNames);
  const redirectUri = readFirstEnvValue(resolvedRedirectUriNames) || (label === 'Talk Show' ? TALK_SHOW_DEFAULTS.redirectUri : undefined);

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(`Google Drive is not configured for ${label}. Set ${resolvedClientIdNames.join('/')}, ${resolvedClientSecretNames.join('/')}, and ${resolvedRefreshTokenNames.join('/')} on the server.`);
  }

  if (/your_|example|placeholder/i.test(`${clientId} ${clientSecret} ${refreshToken}`)) {
    throw new Error(`Google Drive is using placeholder credentials for ${label}. Replace the Google OAuth environment variables with real server-side values.`);
  }

  return { label, clientId, clientSecret, refreshToken, redirectUri } as DriveConfig;
}

export function getTalkShowGoogleConfig() {
  return getGoogleConfig('Talk Show');
}

export { getGoogleConfig };

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
  const configured = process.env.LOCAL_UPLOAD_DIR && process.env.LOCAL_UPLOAD_DIR.trim();
  const uploadDir = configured || path.join(os.tmpdir(), 'nsu-uploads');
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

async function getAccessToken(config: DriveConfig = getGoogleConfig()) {
  const params = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: config.refreshToken,
    grant_type: 'refresh_token',
  });

  if (config.redirectUri) {
    params.set('redirect_uri', config.redirectUri);
  }

  const response = await fetchGoogle('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
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

export async function testDriveAuth(): Promise<{ ok: boolean; error?: string }> {
  try {
    await getAccessToken();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function uploadToGoogleDrive(upload: DriveUpload, config: DriveConfig = getGoogleConfig()) {
  const accessToken = await getAccessToken(config);
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
  if (!file.id) {
    const detail = file.error?.errors?.[0]?.message || file.error?.message;
    throw new Error(detail || 'Unable to upload file to Google Drive');
  }

  try {
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
  } catch (permissionError) {
    if (permissionError instanceof Error && permissionError.message.includes('Unable to reach Google Drive')) {
      throw permissionError;
    }
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

export async function getGoogleDriveStorageUsage(config: DriveConfig = getGoogleConfig()): Promise<DriveStorageUsage> {
  const accessToken = await getAccessToken(config);
  const response = await fetchGoogle('https://www.googleapis.com/drive/v3/about?fields=storageQuota', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await response.json() as {
    error?: { message?: string };
    storageQuota?: { usage?: string; limit?: string; usageInDrive?: string; usageInDriveTrash?: string };
  };

  if (!response.ok) {
    const apiError = data.error;
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

export async function getConfiguredDriveStorageEntries() {
  const entries: Array<{ label: string; clientId: string; clientSecret: string; refreshToken: string; redirectUri?: string; storage: DriveStorageUsage | null; error?: string }> = [];

  const addEntry = async (label: string, clientIdNames: string[], clientSecretNames: string[], refreshTokenNames: string[], redirectUriNames: string[]) => {
    const hasConfiguredValues = label === 'Talk Show'
      ? true
      : [clientIdNames, clientSecretNames, refreshTokenNames].some((names) => readFirstEnvValue(names));

    if (!hasConfiguredValues) {
      return;
    }

    try {
      const config = getGoogleConfig(label, clientIdNames, clientSecretNames, refreshTokenNames, redirectUriNames);
      const storage = await getGoogleDriveStorageUsage(config);
      entries.push({
        label: config.label,
        clientId: config.clientId,
        clientSecret: config.clientSecret,
        refreshToken: config.refreshToken,
        redirectUri: config.redirectUri,
        storage,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      entries.push({
        label,
        clientId: '',
        clientSecret: '',
        refreshToken: '',
        error: message,
        storage: null,
      });
    }
  };

  await addEntry('Primary Drive', ['GOOGLE_CLIENT_ID', 'CLIENT_ID', 'NEXT_PUBLIC_GOOGLE_CLIENT_ID'], ['GOOGLE_CLIENT_SECRET', 'CLIENT_SECRET'], ['GOOGLE_REFRESH_TOKEN', 'GOOGLE_DRIVE_REFRESH_TOKEN', 'GOOGLE_OAUTH_REFRESH_TOKEN', 'REFRESH_TOKEN', 'CLIENT_REFRESH_TOKEN'], ['REDIRECT_URI', 'GOOGLE_REDIRECT_URI']);
  await addEntry('Talk Show', ['TALK_SHOW_CLIENT_ID', 'GOOGLE_CLIENT_ID', 'CLIENT_ID', 'NEXT_PUBLIC_GOOGLE_CLIENT_ID'], ['TALK_SHOW_CLIENT_SECRET', 'GOOGLE_CLIENT_SECRET', 'CLIENT_SECRET'], ['TALK_SHOW_REFRESH_TOKEN', 'GOOGLE_REFRESH_TOKEN', 'GOOGLE_DRIVE_REFRESH_TOKEN', 'GOOGLE_OAUTH_REFRESH_TOKEN', 'REFRESH_TOKEN', 'CLIENT_REFRESH_TOKEN'], ['TALK_SHOW_REDIRECT_URI', 'REDIRECT_URI', 'GOOGLE_REDIRECT_URI']);

  return entries;
}