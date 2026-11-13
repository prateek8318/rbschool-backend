import { PageMeta } from './http';

export const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const searchRegex = (value: string) => new RegExp(escapeRegex(value), 'i');

export const pageMeta = (page: number, limit: number, total: number): PageMeta => ({
  page,
  limit,
  total,
  totalPages: Math.max(1, Math.ceil(total / limit)),
});

/** Today's date as YYYY-MM-DD in the given IANA timezone. */
export const todayIn = (timeZone: string): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

/** Day of week (0 = Sunday) for a YYYY-MM-DD date string. */
export const dayOfWeek = (date: string): number => new Date(`${date}T00:00:00Z`).getUTCDay();

export const round = (value: number, digits = 2) => Math.round(value * 10 ** digits) / 10 ** digits;

export const percentage = (part: number, whole: number) => (whole > 0 ? round((part / whole) * 100) : 0);

export const generateNumericCode = (length = 6) =>
  Array.from({ length }, () => Math.floor(Math.random() * 10)).join('');

export const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
