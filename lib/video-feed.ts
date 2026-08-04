export type VideoFeedType = "official" | "short";
export type VideoFeedSource = "youtube";

export interface VideoFeedItem {
  id: string;
  title: string;
  subtitle?: string;
  description?: string;
  thumbnail: string;
  date: string;
  url: string;
  views?: number;
  type?: VideoFeedType;
  durationSeconds?: number;
  source?: VideoFeedSource;
}

export const MEGA_UPLOADS_URL = "https://mega.nz/filerequest/YLH6T8-78xw";

export function classifyVideoType(title: string, durationSeconds?: number): VideoFeedType {
  const normalizedTitle = title.toLowerCase();
  const shortTitlePattern = /(?:#shorts?\b|\bshorts?\b)/i;

  if (durationSeconds && durationSeconds <= 60) {
    return "short";
  }

  if (shortTitlePattern.test(normalizedTitle)) {
    return "short";
  }

  return "official";
}

export function buildMegaShorts(): VideoFeedItem[] {
  return [];
}
