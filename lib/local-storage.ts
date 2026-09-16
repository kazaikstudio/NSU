import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { randomUUID } from 'crypto';

export type LocalUpload = {
  name: string;
  mimeType: string;
  bytes: ArrayBuffer;
};

function sanitizeLocalFileName(name: string) {
  return name
    .replace(/\\/g, '-')
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'upload';
}

export function getLocalUploadsDir() {
  const configured = process.env.LOCAL_UPLOAD_DIR && process.env.LOCAL_UPLOAD_DIR.trim();
  return configured || path.join(os.tmpdir(), 'nsu-uploads');
}

export async function saveFileLocally(upload: LocalUpload) {
  const uploadDir = getLocalUploadsDir();
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
