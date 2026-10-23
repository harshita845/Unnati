const inFlight = new Map<string, Promise<unknown>>();

/**
 * Identical requests made at the same moment share one network call.
 *
 * Several parts of a page ask for the same thing as it loads (the deals list is wanted by three
 * sections, the header categories by two providers), and each used to send its own request. This
 * hands every caller the one already on its way and forgets it as soon as it finishes, so nothing
 * is ever served stale: a request made after it completes is a fresh one.
 */
export const coalesce = <T>(key: string, fetcher: () => Promise<T>): Promise<T> => {
  const existing = inFlight.get(key) as Promise<T> | undefined;
  if (existing) return existing;
  const request = fetcher().finally(() => {
    if (inFlight.get(key) === request) inFlight.delete(key);
  });
  inFlight.set(key, request);
  return request;
};
