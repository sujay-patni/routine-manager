"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import {
  createVacation,
  deleteVacation,
  getActiveVacations,
  getAllVacations,
  getVacation,
  getVacationTemplates,
  updateVacation,
  type VacationInput,
} from "@/lib/notion/vacations";
import { formatDateForDB } from "@/lib/habit-logic";
import { subDays } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { getSettings } from "@/app/actions/settings";
import type { Vacation } from "@/lib/notion/types";

export type { Vacation };

export async function getVacations(): Promise<Vacation[]> {
  return getAllVacations();
}

export async function getTemplates(): Promise<Vacation[]> {
  return getVacationTemplates();
}

export async function getActiveVacationsForDate(date: string): Promise<Vacation[]> {
  return getActiveVacations(date);
}

function revalidateVacationPaths() {
  revalidateTag("vacations", {});
  revalidatePath("/");
  revalidatePath("/today");
  revalidatePath("/settings");
  revalidatePath("/settings/vacations");
}

export async function saveVacation(
  input: VacationInput & { id?: string }
): Promise<{ data?: Vacation; error?: string }> {
  try {
    const payload: VacationInput = {
      name: input.name.trim(),
      is_template: !!input.is_template,
      start_date: input.is_template ? null : input.start_date ?? null,
      end_date: input.is_template ? null : input.end_date ?? null,
      habit_ids: input.habit_ids ?? [],
      group_ids: input.group_ids ?? [],
      note: input.note ?? null,
    };

    if (!payload.name) return { error: "name_required" };
    if (!payload.is_template) {
      if (!payload.start_date || !payload.end_date) return { error: "dates_required" };
      if (payload.start_date > payload.end_date) return { error: "invalid_range" };
    }

    const data = input.id
      ? await updateVacation(input.id, payload)
      : await createVacation(payload);

    revalidateVacationPaths();
    return { data };
  } catch (e) {
    console.error("saveVacation failed", e);
    return { error: e instanceof Error ? e.message : "save_failed" };
  }
}

export async function removeVacation(id: string): Promise<{ error?: string }> {
  try {
    await deleteVacation(id);
    revalidateVacationPaths();
    return {};
  } catch (e) {
    console.error("removeVacation failed", e);
    return { error: e instanceof Error ? e.message : "delete_failed" };
  }
}

export async function endVacationNow(id: string): Promise<{ error?: string }> {
  try {
    const v = await getVacation(id);
    if (!v) return { error: "not_found" };

    const settings = await getSettings();
    const today = formatDateForDB(toZonedTime(new Date(), settings.timezone));
    const yesterday = formatDateForDB(subDays(toZonedTime(new Date(), settings.timezone), 1));

    if (!v.start_date || v.start_date >= today) {
      await deleteVacation(id);
      revalidateVacationPaths();
      return {};
    }

    await updateVacation(id, {
      name: v.name,
      is_template: false,
      start_date: v.start_date,
      end_date: yesterday,
      habit_ids: v.habit_ids,
      group_ids: v.group_ids,
      note: v.note,
    });
    revalidateVacationPaths();
    return {};
  } catch (e) {
    console.error("endVacationNow failed", e);
    return { error: e instanceof Error ? e.message : "end_failed" };
  }
}

export async function applyTemplate(
  templateId: string,
  opts: { start_date: string; end_date: string; name?: string }
): Promise<{ data?: Vacation; error?: string }> {
  try {
    const tpl = await getVacation(templateId);
    if (!tpl) return { error: "template_not_found" };
    if (!opts.start_date || !opts.end_date) return { error: "dates_required" };
    if (opts.start_date > opts.end_date) return { error: "invalid_range" };

    const data = await createVacation({
      name: (opts.name ?? tpl.name).trim() || tpl.name,
      is_template: false,
      start_date: opts.start_date,
      end_date: opts.end_date,
      habit_ids: tpl.habit_ids,
      group_ids: tpl.group_ids,
      note: tpl.note,
    });
    revalidateVacationPaths();
    return { data };
  } catch (e) {
    console.error("applyTemplate failed", e);
    return { error: e instanceof Error ? e.message : "apply_failed" };
  }
}
