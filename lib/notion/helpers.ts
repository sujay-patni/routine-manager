/* eslint-disable @typescript-eslint/no-explicit-any */

export function getText(prop: any): string {
  if (!prop) return "";
  if (prop.title) return prop.title.map((t: any) => t.plain_text).join("") ?? "";
  if (prop.rich_text) return prop.rich_text.map((t: any) => t.plain_text).join("") ?? "";
  return "";
}

export function getSelect(prop: any): string {
  return prop?.select?.name ?? "";
}

export function getNumber(prop: any): number {
  return prop?.number ?? 0;
}

export function getCheckbox(prop: any): boolean {
  return prop?.checkbox ?? false;
}

export function getDate(prop: any): string {
  return prop?.date?.start ?? "";
}

export function getDateEnd(prop: any): string {
  return prop?.date?.end ?? "";
}

export function getRelationIds(prop: any): string[] {
  return prop?.relation?.map((r: any) => r.id) ?? [];
}
