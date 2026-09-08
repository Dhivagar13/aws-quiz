export interface RateCheck {
  allowed: boolean;
  retryAfterSec: number;
  remaining: number;
}

const POST_KEY = "sbg-post-times";
const POST_LIMIT = 3;
const POST_WINDOW_MS = 60_000;

function readTimes(key: string): number[] {
  try {
    const raw = localStorage.getItem(key) ?? "[]";
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return [];
    const now = Date.now();
    return arr.filter((t): t is number => typeof t === "number" && now - t < POST_WINDOW_MS);
  } catch {
    return [];
  }
}

export function checkPostRate(): RateCheck {
  const times = readTimes(POST_KEY);
  const remaining = Math.max(0, POST_LIMIT - times.length);
  if (remaining > 0) return { allowed: true, retryAfterSec: 0, remaining };
  const oldest = Math.min(...times);
  const retryAfterSec = Math.ceil((POST_WINDOW_MS - (Date.now() - oldest)) / 1000);
  return { allowed: false, retryAfterSec: Math.max(1, retryAfterSec), remaining: 0 };
}

export function recordPost(): void {
  try {
    const times = readTimes(POST_KEY);
    times.push(Date.now());
    localStorage.setItem(POST_KEY, JSON.stringify(times));
  } catch {
    // private mode: skip persistence, still allow the post attempt
  }
}
