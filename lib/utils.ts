import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Normalize an admin-entered slug into a URL-safe form: lowercase, diacritics
 * stripped, and any run of non-alphanumeric characters collapsed to a single
 * hyphen. "Animal Farm" -> "animal-farm". Returns "" when nothing usable
 * remains (e.g. an all-Arabic input), so callers can reject it.
 */
export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
