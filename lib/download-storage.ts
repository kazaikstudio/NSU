import { createWriteStream } from "node:fs";
import { mkdir, stat } from "node:fs/promises";
import { join, parse } from "node:path";
import { PassThrough, type Readable } from "node:stream";

export type DownloadStorageCategory = "audio" | "video";

const DOWNLOADS_ROOT = join(process.cwd(), "downloads");
const NOLL_MUSIC_ROOT = join(DOWNLOADS_ROOT, "Noll-Music");

function getCategoryDirectory(category: DownloadStorageCategory) {
  return join(NOLL_MUSIC_ROOT, category === "audio" ? "Audio" : "Video");
}

export async function ensureDownloadStoragePath(filename: string, category: DownloadStorageCategory) {
  const directory = getCategoryDirectory(category);
  await mkdir(directory, { recursive: true });

  const safeName = filename.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, "_").trim() || `download`;
  const parsed = parse(safeName);
  const baseName = parsed.name || "download";
  const extension = parsed.ext || "";
  const targetPath = join(directory, `${baseName}${extension}`);

  let candidatePath = targetPath;
  let counter = 1;
  while (true) {
    try {
      await stat(candidatePath);
      candidatePath = join(directory, `${baseName} (${counter++})${extension}`);
    } catch {
      return candidatePath;
    }
  }
}

export function teeStreamToFile(source: Readable, targetPath: string) {
  const passthrough = new PassThrough();
  const writer = createWriteStream(targetPath);

  source.pipe(passthrough);
  passthrough.pipe(writer);

  source.on("error", (error) => {
    passthrough.destroy(error);
    writer.destroy(error);
  });

  passthrough.on("error", (error) => {
    writer.destroy(error);
  });

  writer.on("error", (error) => {
    passthrough.destroy(error);
  });

  return passthrough;
}
