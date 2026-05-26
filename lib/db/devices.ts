import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { getDb } from "./client";
import { allowedDevices } from "./schema";

let cachedDevices: Set<string> | null = null;
let cacheExpiry = 0;
const CACHE_TTL = 5 * 60 * 1000;

async function getActiveAllowedDevices(): Promise<Set<string>> {
  if (cachedDevices && Date.now() < cacheExpiry) return cachedDevices;

  const rows = await getDb()
    .select({ deviceId: allowedDevices.deviceId })
    .from(allowedDevices)
    .where(eq(allowedDevices.isActive, true));
  cachedDevices = new Set(rows.map((row) => row.deviceId));
  cacheExpiry = Date.now() + CACHE_TTL;
  return cachedDevices;
}

export async function isDeviceAllowed(deviceId: string): Promise<boolean> {
  try {
    const devices = await getActiveAllowedDevices();
    if (devices.size === 0) return true;
    return devices.has(deviceId);
  } catch {
    return cachedDevices ? cachedDevices.has(deviceId) : true;
  }
}

export async function upsertAllowedDevice(data: {
  id?: string;
  deviceId: string;
  name?: string | null;
  isActive?: boolean;
}): Promise<void> {
  await getDb()
    .insert(allowedDevices)
    .values({
      id: data.id ?? randomUUID(),
      deviceId: data.deviceId,
      name: data.name ?? null,
      isActive: data.isActive ?? true,
    })
    .onConflictDoUpdate({
      target: allowedDevices.deviceId,
      set: {
        name: data.name ?? null,
        isActive: data.isActive ?? true,
      },
    });
  cachedDevices = null;
}
