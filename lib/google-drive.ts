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

async function getAccessToken() {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID || '',
      client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN || '',
      grant_type: 'refresh_token',
    }),
  });

  const data = await response.json();
  if (!response.ok || !data.access_token) {
    throw new Error(data.error_description || 'Unable to authenticate with Google Drive');
  }

  return data.access_token as string;
}

export async function uploadToGoogleDrive(upload: DriveUpload) {
  const accessToken = await getAccessToken();
  const boundary = `noll-drive-${Date.now()}`;
  const metadata = JSON.stringify({ name: upload.name });
  const encoder = new TextEncoder();
  const prefix = encoder.encode(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n` +
    `--${boundary}\r\nContent-Type: ${upload.mimeType}\r\n\r\n`
  );
  const suffix = encoder.encode(`\r\n--${boundary}--\r\n`);
  const body = new Uint8Array(prefix.byteLength + upload.bytes.byteLength + suffix.byteLength);
  body.set(prefix, 0);
  body.set(new Uint8Array(upload.bytes), prefix.byteLength);
  body.set(suffix, prefix.byteLength + upload.bytes.byteLength);

  const response = await fetch(
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
  const file = (await response.json()) as DriveFile & { error?: { message?: string } };
  if (!response.ok || !file.id) {
    throw new Error(file.error?.message || 'Unable to upload file to Google Drive');
  }

  const permissionResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}/permissions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ role: 'reader', type: 'anyone' }),
  });

  if (!permissionResponse.ok) {
    throw new Error('File uploaded, but Google Drive sharing could not be enabled');
  }

  return {
    ...file,
    publicUrl: file.mimeType.startsWith('image/')
      ? `https://drive.google.com/uc?export=view&id=${file.id}`
      : `https://drive.google.com/uc?export=download&id=${file.id}`,
  };
}