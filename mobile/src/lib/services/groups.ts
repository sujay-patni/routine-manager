import { notifyDataChanged } from "../store";
import {
  getAllGroups as dbGetAllGroups,
  createGroup as dbCreateGroup,
  updateGroup as dbUpdateGroup,
  deleteGroup as dbDeleteGroup,
} from "../db/groups";
import type { Group } from "../types";

export type { Group };

export async function getAllGroups(): Promise<Group[]> {
  return dbGetAllGroups();
}

export async function createGroup(data: { name: string; color: string }) {
  try {
    const group = await dbCreateGroup(data);
    notifyDataChanged();
    return { success: true, group };
  } catch (e) {
    return { error: String(e) };
  }
}

export async function updateGroup(id: string, data: { name?: string; color?: string }) {
  try {
    await dbUpdateGroup(id, data);
    notifyDataChanged();
    return { success: true };
  } catch (e) {
    return { error: String(e) };
  }
}

export async function deleteGroup(id: string) {
  try {
    await dbDeleteGroup(id);
    notifyDataChanged();
    return { success: true };
  } catch (e) {
    return { error: String(e) };
  }
}
