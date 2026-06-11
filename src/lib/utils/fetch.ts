// Shared fetch helper: enforces a timeout so a hung upstream doesn't block
// the whole Promise.all in runIngest until the serverless function dies.
// Preserves Next's `next.revalidate` data-cache option.
//
// Deliberately does NOT pass an AbortSignal into fetch: combining a signal
// with Next's patched, data-cached fetch was one of two candidate causes of
// the June 2026 incident where every ingest source failed at once on the
// on-demand path (all-ok locally and via the cron). Promise.race gives the
// same caller-side timeout without touching the request itself; the loser
// request just gets dropped with the function instance.

const DEFAULT_TIMEOUT_MS = 15_000;

export async function fetchWithTimeout(
  url: string,
  init: RequestInit & { next?: { revalidate?: number } } = {},
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`fetch timed out after ${timeoutMs}ms: ${url}`)),
      timeoutMs,
    );
  });
  try {
    return await Promise.race([fetch(url, init), timeout]);
  } finally {
    clearTimeout(timer);
  }
}
