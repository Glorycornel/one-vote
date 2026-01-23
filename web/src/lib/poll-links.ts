export const extractPollId = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const getFromPath = (path: string) => {
    const match = path.match(/\/poll\/([^/?#]+)/i);
    return match?.[1] ?? null;
  };

  if (trimmed.startsWith("/poll/")) {
    return getFromPath(trimmed);
  }

  if (trimmed.includes("://") || trimmed.startsWith("www.")) {
    const candidate = trimmed.startsWith("www.") ? `https://${trimmed}` : trimmed;
    try {
      const url = new URL(candidate);
      const pollIdFromUrl = getFromPath(url.pathname);
      if (pollIdFromUrl) return pollIdFromUrl;
      return null;
    } catch {
      return null;
    }
  }

  if (trimmed.includes("/poll/")) {
    const pollIdFromPath = getFromPath(trimmed);
    if (pollIdFromPath) return pollIdFromPath;
  }

  return trimmed;
};
