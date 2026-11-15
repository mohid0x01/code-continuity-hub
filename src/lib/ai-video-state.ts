export type AiVideoViewState = {
  status: string;
  url?: string | null;
  error?: string;
  progress?: number;
};

export function resolveAiPollResult(result: AiVideoViewState): AiVideoViewState {
  if (result.status === "none") {
    return {
      status: "ai_failed",
      error: "The saved render has no provider job. Start a new render explicitly.",
    };
  }
  return result;
}

export function isAiVideoProcessing(status: string | null | undefined) {
  return status === "processing" || status === "ai_processing";
}
