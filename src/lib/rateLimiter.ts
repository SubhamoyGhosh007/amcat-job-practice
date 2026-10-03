/**
 * Client-side leaky bucket for AI generation entry points. Capacity 5 tokens,
 * refill 1 token / 10 s. Stops rapid tab cycling from spamming AI calls
 * before the cloud quotas respond. Throws a human error when empty — route it
 * through friendly.ts at the call site (it already matches the quota pattern).
 */
const CAPACITY = 5;
const REFILL_MS = 10_000;

let tokens = CAPACITY;
let last = Date.now();

function refill() {
  const now = Date.now();
  const gained = Math.floor((now - last) / REFILL_MS);
  if (gained > 0) {
    tokens = Math.min(CAPACITY, tokens + gained);
    last += gained * REFILL_MS;
  }
}

/** Consume one token. Returns ms to wait when empty (0 = token granted). */
export function takeToken(): number {
  refill();
  if (tokens >= 1) {
    tokens -= 1;
    return 0;
  }
  return REFILL_MS - ((Date.now() - last) % REFILL_MS);
}

/** Throw a quota-flavoured error when the bucket is empty. */
export function requireToken(): void {
  const waitMs = takeToken();
  if (waitMs > 0) throw new Error(`AI rate limited — too many requests, retry in ${Math.ceil(waitMs / 1000)}s.`);
}
