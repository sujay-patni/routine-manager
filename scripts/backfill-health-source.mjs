import { Client } from "@notionhq/client";
import { readFileSync } from "fs";

// Load .env.local manually (node 18 has no --env-file flag)
const envText = readFileSync(".env.local", "utf8");
for (const line of envText.split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
}

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const DB = process.env.NOTION_HABITS_DB_ID;

async function listAllHabits() {
  const out = [];
  let cursor;
  do {
    const r = await notion.dataSources.query({
      data_source_id: DB,
      start_cursor: cursor,
      page_size: 100,
    });
    out.push(...r.results);
    cursor = r.has_more ? r.next_cursor : undefined;
  } while (cursor);
  return out;
}

const habits = await listAllHabits();
console.log("found", habits.length, "habits");

let set = 0, already = 0;
for (const h of habits) {
  const cur = h.properties?.["Health Source"]?.select?.name ?? null;
  const name = h.properties?.["Name"]?.title?.[0]?.plain_text ?? "(unnamed)";
  if (cur === "none") { already++; continue; }
  await notion.pages.update({
    page_id: h.id,
    properties: { "Health Source": { select: { name: "none" } } },
  });
  console.log("  set:", name, "(was:", cur ?? "blank", ")");
  set++;
}
console.log("done — set:", set, "already-none:", already);
