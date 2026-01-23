export type PollOption = {
  id: string;
};

export const normalizeCounts = (
  options: PollOption[],
  rawCounts: Record<string, string>,
) => {
  const counts: Record<string, number> = {};
  for (const option of options) {
    counts[option.id] = Number(rawCounts[option.id]) || 0;
  }
  return counts;
};

export const sumCounts = (counts: Record<string, number>) =>
  Object.values(counts).reduce((sum, value) => sum + value, 0);

export const isUniqueConstraintError = (error: unknown) => {
  if (!error || typeof error !== "object") return false;
  return "code" in error && (error as { code?: string }).code === "P2002";
};
