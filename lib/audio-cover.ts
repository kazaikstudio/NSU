function readSyncSafeInteger(bytes: Uint8Array, offset: number) {
  return (
    ((bytes[offset] & 0x7f) << 21) |
    ((bytes[offset + 1] & 0x7f) << 14) |
    ((bytes[offset + 2] & 0x7f) << 7) |
    (bytes[offset + 3] & 0x7f)
  );
}

function findNullTerminator(bytes: Uint8Array, start: number, charSize: 1 | 2) {
  let offset = start;
  for (; offset + charSize <= bytes.length; offset += charSize) {
    if (bytes[offset] === 0 && (charSize === 1 || bytes[offset + 1] === 0)) {
      return offset;
    }
  }
  return -1;
}

function extractApicFrame(frameData: Uint8Array): { image: Uint8Array; mimeType: string } | null {
  if (frameData.length < 4) return null;

  const encoding = frameData[0];
  const charSize: 1 | 2 = encoding === 0x01 || encoding === 0x02 ? 2 : 1;

  let mimeEnd = frameData.indexOf(0);
  if (mimeEnd < 1) {
    mimeEnd = frameData.indexOf(0, 1);
  }
  if (mimeEnd < 1) return null;

  const mimeType = String.fromCharCode(...frameData.subarray(1, mimeEnd)).toLowerCase();

  const pictureTypeOffset = mimeEnd + 1;
  if (pictureTypeOffset >= frameData.length) return null;

  const descriptionOffset = findNullTerminator(frameData, pictureTypeOffset + 1, charSize);
  if (descriptionOffset < 0) return null;

  const imageStart = descriptionOffset + charSize;
  if (imageStart >= frameData.length) return null;

  return {
    image: frameData.subarray(imageStart),
    mimeType: mimeType || (frameData[imageStart] === 0xff && frameData[imageStart + 1] === 0xd8 ? 'image/jpeg' : 'image/png'),
  };
}

export async function extractAudioCoverArt(file: File): Promise<{ blob: Blob; name: string } | null> {
  if (!file) return null;

  const extension = file.name.split('.').pop()?.toLowerCase() || '';
  if (!['mp3', 'm4a', 'aac', 'flac', 'wav', 'ogg'].includes(extension)) return null;

  const arrayBuffer = await file.arrayBuffer().catch(() => null);
  if (!arrayBuffer) return null;

  const bytes = new Uint8Array(arrayBuffer);
  if (bytes.length < 10 || bytes[0] !== 0x49 || bytes[1] !== 0x44 || bytes[2] !== 0x33) {
    return null;
  }

  const version = bytes[3];
  if (version < 3) return null;

  const tagSize = readSyncSafeInteger(bytes, 6);
  const tagEnd = Math.min(10 + tagSize, bytes.length);
  let offset = 10;

  while (offset + 10 <= tagEnd) {
    const frameId = String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]);
    if (frameId.charCodeAt(0) === 0) break;

    const frameSize = version === 4
      ? readSyncSafeInteger(bytes, offset + 4)
      : ((bytes[offset + 4] << 24) | (bytes[offset + 5] << 16) | (bytes[offset + 6] << 8) | bytes[offset + 7]) >>> 0;

    const frameDataStart = offset + 10;
    const frameDataEnd = frameDataStart + frameSize;
    if (frameDataEnd > tagEnd || offset + 10 > bytes.length) break;

    if (frameId === 'APIC') {
      const parsed = extractApicFrame(bytes.subarray(frameDataStart, frameDataEnd));
      if (parsed) {
        const mimeExtension = parsed.mimeType.includes('png') ? 'png' : 'jpg';
        const safeName = file.name.replace(/\.[^/.]+$/, '') || 'track';
        const copy = new Uint8Array(parsed.image);
        return {
          blob: new Blob([copy.buffer], { type: parsed.mimeType }),
          name: `${safeName}-cover.${mimeExtension}`,
        };
      }
    }

    offset = frameDataEnd;
  }

  return null;
}