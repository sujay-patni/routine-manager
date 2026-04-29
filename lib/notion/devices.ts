let cachedDevices: Set<string> | null = null;
let cacheExpiry = 0;
const CACHE_TTL = 5 * 60 * 1000;

export async function isDeviceAllowed(deviceId: string): Promise<boolean> {
  const dbId = process.env.NOTION_DEVICES_DB_ID?.trim();
  if (!dbId) return true; // fail-open if not configured

  try {
    const devices = await getAllowedDevices(dbId);
    return devices.has(deviceId);
  } catch {
    // On error, fall back to last known cache; if none, fail-open
    return cachedDevices ? cachedDevices.has(deviceId) : true;
  }
}

async function getAllowedDevices(dbId: string): Promise<Set<string>> {
  if (cachedDevices && Date.now() < cacheExpiry) return cachedDevices;

  const res = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.NOTION_API_KEY}`,
      "Notion-Version": "2022-06-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      filter: { property: "Active", checkbox: { equals: true } },
    }),
  });

  if (!res.ok) throw new Error(`Notion devices fetch failed: ${res.status}`);

  const data = await res.json();
  const devices = new Set<string>();

  for (const page of data.results ?? []) {
    const id = page.properties?.["Device ID"]?.rich_text?.[0]?.plain_text?.trim();
    if (id) devices.add(id);
  }

  cachedDevices = devices;
  cacheExpiry = Date.now() + CACHE_TTL;
  return devices;
}
