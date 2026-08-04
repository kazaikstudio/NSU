export function shouldAutoUploadOnSelection(file: File | null, title: string, isUploading: boolean) {
  return Boolean(file && title.trim() && !isUploading);
}

export function clampUploadProgress(value: number) {
  return Math.min(100, Math.max(0, Math.round(value)));
}

export function formatUploadStatusMessage(uploadError: string | null) {
  if (!uploadError) {
    return 'Uploaded to Talk Show Drive.';
  }

  if (uploadError.includes('Unable to reach Google Drive')) {
    return 'Uploaded locally because Google Drive was unavailable. The file is saved and ready in storage.';
  }

  return `Uploaded locally because Google Drive was unavailable. ${uploadError}`;
}
