const STATS_KEY = "hk_usage_stats";

export interface UsageStat {
  question: string;
  count: number;
  lastAsked: number;
}

function loadStats(): Record<string, UsageStat> {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") return parsed;
    return {};
  } catch {
    return {};
  }
}

function saveStats(stats: Record<string, UsageStat>) {
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  } catch {
    /* ignore */
  }
}

/** Record a user question (normalized) and return the updated top list. */
export function recordUsage(question: string): UsageStat[] {
  const clean = question.trim().toLowerCase();
  if (!clean) return getTopUsage();
  const stats = loadStats();
  const key = clean.replace(/\s+/g, " ").slice(0, 200);
  const existing = stats[key];
  stats[key] = {
    question: clean,
    count: (existing?.count ?? 0) + 1,
    lastAsked: Date.now(),
  };
  saveStats(stats);
  return getTopUsage();
}

export function getTopUsage(limit = 10): UsageStat[] {
  return Object.values(loadStats())
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export function clearUsageStats() {
  try {
    localStorage.removeItem(STATS_KEY);
  } catch {
    /* ignore */
  }
}