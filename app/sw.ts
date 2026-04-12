import type { PrecacheEntry } from "serwist";
import { installSerwist } from "serwist/legacy";
import { defaultCache } from "@serwist/next/worker";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sw = self as any;

installSerwist({
  precacheEntries: sw.__SW_MANIFEST as (string | PrecacheEntry)[],
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
});
