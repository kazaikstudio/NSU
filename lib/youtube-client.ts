import { Platform } from 'youtubei.js';

let evaluatorConfigured = false;

export function configureYoutubeEvaluator() {
  if (evaluatorConfigured) return;

  Platform.shim.eval = async (data, env) => {
    const evaluator = Function;
    return evaluator(...Object.keys(env), data.output)(...Object.values(env));
  };
  evaluatorConfigured = true;
}