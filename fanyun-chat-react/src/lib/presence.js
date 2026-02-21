export const ONLINE_WINDOW_MS = 5 * 60 * 1000;

export function isOnlineFromLastLogin(lastLogin) {
  if (!lastLogin) return false;
  const ts = new Date(lastLogin).getTime();
  if (!Number.isFinite(ts)) return false;
  return Date.now() - ts < ONLINE_WINDOW_MS;
}
