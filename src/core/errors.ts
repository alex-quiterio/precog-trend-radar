// PRECOG / Trend Radar · Reading caught errors, which TypeScript rightly types as `unknown`.

/** The request was cancelled on purpose (a newer one replaced it): not worth showing. */
export const isAbort = (e: unknown): boolean =>
  (e instanceof Error || (typeof DOMException !== 'undefined' && e instanceof DOMException)) && e.name === 'AbortError';
/** A short message for anything thrown. */
export const errorText = (e: unknown): string => (e instanceof Error ? e.message : String(e)) || 'unknown error';
