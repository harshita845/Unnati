/**
 * Debug logging that stays out of the way: only in development builds, and each distinct message
 * only once per page load (the request interceptor and token helpers run on every API call).
 */
const seen = new Set<string>();

const once = (level: "log" | "warn", key: string, args: unknown[]) => {
  if (!import.meta.env.DEV || seen.has(key)) return;
  seen.add(key);
  console[level](...args);
};

export const devLogOnce = (key: string, ...args: unknown[]) => once("log", key, args);
export const devWarnOnce = (key: string, ...args: unknown[]) => once("warn", key, args);
