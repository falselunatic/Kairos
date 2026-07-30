/** A bare `fetch` rejection (network down, backend not running, CORS) surfaces as a generic
 * "TypeError: Failed to fetch" with no useful detail - translate it into something actionable. */
export function friendlyFetchError(err: unknown, fallback: string): string {
  if (err instanceof TypeError) {
    return "Couldn't reach the backend. Make sure it's running, then try again.";
  }
  return err instanceof Error ? err.message : fallback;
}

/** Reads the error detail out of a non-ok response (FastAPI's HTTPException body has a
 * `detail` string; an unhandled exception falls back to a plain-text "Internal Server
 * Error" page instead, so this degrades to the status text rather than throwing). */
export async function extractErrorDetail(res: Response): Promise<string> {
  try {
    const body = await res.json();
    if (typeof body?.detail === "string") return body.detail;
  } catch {
    // not JSON - the default unhandled-exception response is plain text
  }
  return res.statusText || `Request failed (${res.status})`;
}

const RETRY_DELAYS_MS = [800, 2000, 4000];

/** Retries with backoff on a network-level failure (TypeError) - smooths over the dev backend
 * being mid-restart (which can take several seconds) instead of surfacing an error immediately.
 * Does NOT retry on an HTTP error response (4xx/5xx), only on the fetch itself failing. */
export async function fetchWithRetry(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fetch(input, init);
    } catch (err) {
      if (!(err instanceof TypeError) || attempt >= RETRY_DELAYS_MS.length) throw err;
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt]));
    }
  }
}
