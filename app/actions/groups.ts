"use server";

import { revalidateTag, unstable_cache } from "next/cache";
import {
  getAllGroups as dbGetAllGroups,
  createGroup as dbCreateGroup,
  updateGroup as dbUpdateGroup,
  deleteGroup as dbDeleteGroup,
} from "@/lib/db/groups";
import type { Group } from "@/lib/domain/types";

export type { Group };

const cachedGetAllGroups = unstable_cache(dbGetAllGroups, ["groups-all"], {
  tags: ["groups"],
  revalidate: 300,
});

export async function getAllGroups(): Promise<Group[]> {
  return cachedGetAllGroups();
}

export async function createGroup(data: { name: string; color: string }) {
  try {
    const group = await dbCreateGroup(data);
    revalidateTag("groups", {});
    return { success: true, group };
  } catch (e) {
    return { error: String(e) };
  }
}

export async function updateGroup(id: string, data: { name?: string; color?: string }) {
  try {
    await dbUpdateGroup(id, data);
    revalidateTag("groups", {});
    return { success: true };
  } catch (e) {
    return { error: String(e) };
  }
}

export async function deleteGroup(id: string) {
  try {
    await dbDeleteGroup(id);
    revalidateTag("groups", {});
    revalidateTag("habits", {});
    revalidateTag("events", {});
    return { success: true };
  } catch (e) {
    return { error: String(e) };
  }
}
