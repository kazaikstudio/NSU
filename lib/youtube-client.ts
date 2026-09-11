import { ClientType, Platform } from 'youtubei.js';

let evaluatorConfigured = false;

export function configureYoutubeEvaluator() {
  if (evaluatorConfigured) return;

  Platform.shim.eval = async (data, env) => {
    const evaluator = Function;
    return evaluator(...Object.keys(env), data.output)(...Object.values(env));
  };
  evaluatorConfigured = true;
}

// Clients ordered by how reliably they return playable stream URLs without a
// PO token: Android VR and iOS surface googlevideo URLs, while WEB/MWEB now
// routinely withhold them.
export const YOUTUBE_CLIENT_TYPES = [
  ClientType.ANDROID_VR,
  ClientType.IOS,
  ClientType.ANDROID,
  ClientType.MWEB,
  ClientType.WEB,
  ClientType.TV,
  ClientType.WEB_EMBEDDED,
] as const;

type YoutubeSessionConfig = {
  po_token?: string;
  visitor_data?: string;
  cookie?: string;
  user_agent?: string;
};

export function getYoutubeSessionConfig(): YoutubeSessionConfig {
  return {
    ...(process.env.YOUTUBE_PO_TOKEN ? { po_token: process.env.YOUTUBE_PO_TOKEN } : {}),
    ...(process.env.YOUTUBE_VISITOR_DATA ? { visitor_data: process.env.YOUTUBE_VISITOR_DATA } : {}),
    ...(process.env.YOUTUBE_COOKIE ? { cookie: process.env.YOUTUBE_COOKIE } : {}),
    ...(process.env.YOUTUBE_USER_AGENT ? { user_agent: process.env.YOUTUBE_USER_AGENT } : {}),
  };
}