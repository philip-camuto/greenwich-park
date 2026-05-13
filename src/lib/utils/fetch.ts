// Shared fetch helper: enforces a timeout so a hung upstream doesn't block
// the whole Promise.all in runIngest until the serverless function dies.
// Preserves Next's `next.revalidate` data-cache option.

const DEFAULT_TIMEOUT_MS = 8_000;

export async function fetchWithTimeout(
  url: string,
  init: RequestInit & { next?: { revalidate?: number } } = {},
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
