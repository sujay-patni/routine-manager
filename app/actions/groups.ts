"use server";

import { revalidateTag, unstable_cache } from "next/cache";
import {
  getAllGroups as notionGetAllGroups,
  createGroup as notionCreateGroup,
  updateGroup as notionUpdateGroup,
  deleteGroup as notionDeleteGroup,
} from "@/lib/notion/groups";
import type { Group } from "@/lib/notion/types";

export type { Group };

const cachedGetAllGroups = unstable_cache(notionGetAllGroups, ["groups-all"], {
  tags: ["groups"],
  revalidate: 300,
});

export async function getAllGroups(): Promise<Group[]> {
  return cachedGetAllGroups();
}

export async function createGroup(data: { name: string; color: string }) {
  try {
    const group = await notionCreateGroup(data);
    revalidateTag("groups", {});
    return { success: true, group };
  } catch (e) {
    return { error: String(e) };
  }
}

export async function updateGroup(id: string, data: { name?: string; color?: string }) {
  try {
    await notionUpdateGroup(id, data);
    revalidateTag("groups", {});
    return { success: true };
  } catch (e) {
    return { error: String(e) };
  }
}

export async function deleteGroup(id: string) {
  try {
    await notionDeleteGroup(id);
    revalidateTag("groups", {});
    revalidateTag("habits", {});
    revalidateTag("events", {});
    return { success: true };
  } catch (e) {
    return { error: String(e) };
  }
}
