import Pusher from "pusher";

export const validRoom = (value: unknown): value is string =>
  typeof value === "string" && /^[a-z0-9_-]{1,20}$/.test(value);
export const validUser = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0 && value.length <= 15;
export function getPusher() {
  const {
    PUSHER_APP_ID: appId,
    NEXT_PUBLIC_PUSHER_KEY: key,
    PUSHER_SECRET: secret,
    NEXT_PUBLIC_PUSHER_CLUSTER: cluster,
  } = process.env;
  if (!appId || !key || !secret || !cluster) return null;
  return new Pusher({ appId, key, secret, cluster, useTLS: true });
}
