export const MIN_LEN = 2;
export const MAX_LEN = 280;

const HANDLE_KEY = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

export function generateHandle(): string {
  let suffix = "";
  const bytes = new Uint32Array(4);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < 4; i++) {
    suffix += HANDLE_KEY[Number(bytes[i]) % HANDLE_KEY.length];
  }
  return `anon-${suffix}`;
}

export function sanitizeBody(input: string): string {
  return (
    input
      // strip control chars except newline/tab
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, MAX_LEN)
  );
}

export function validateBody(input: string): string | null {
  const v = sanitizeBody(input);
  if (v.length < MIN_LEN) return `Ask at least ${MIN_LEN} characters.`;
  if (v.length > MAX_LEN) return `Keep it under ${MAX_LEN} characters.`;
  return null;
}

/** Remove emails + phone-like runs before insert. Keeps wall safe for projection. */
export function maskPII(input: string): string {
  return sanitizeBody(input)
    .replace(/\S+@\S+\.\S+/g, "[email removed]")
    .replace(/\+?\d[\d\s\-()]{7,}\d/g, "[phone removed]");
}

export function getOrCreateVoterHash(): string {
  const key = "sbg-voter-hash";
  try {
    const existing = localStorage.getItem(key);
    if (existing && existing.length >= 8) return existing;
    const fresh =
      typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `v-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(key, fresh);
    return fresh;
  } catch {
    return `ephemeral-${Math.random().toString(36).slice(2)}`;
  }
}

export function getVotedIds(): Set<string> {
  try {
    const raw = localStorage.getItem("sbg-voted") ?? "[]";
    const arr = JSON.parse(raw) as unknown;
    if (Array.isArray(arr)) return new Set(arr.filter((x): x is string => typeof x === "string"));
    return new Set();
  } catch {
    return new Set();
  }
}

export function markVoted(id: string): void {
  try {
    const next = getVotedIds();
    next.add(id);
    localStorage.setItem("sbg-voted", JSON.stringify([...next]));
  } catch {
    // storage may be blocked in kiosk mode; voting still attempted server-side
  }
}
