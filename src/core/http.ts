import { Response } from 'express';

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/** Every successful response has the shape `{ success: true, data, meta? , message? }`. */
export const ok = <T>(res: Response, data: T, meta?: PageMeta | Record<string, unknown>, message?: string) =>
  res.status(200).json({ success: true, ...(message ? { message } : {}), data, ...(meta ? { meta } : {}) });

export const created = <T>(res: Response, data: T, message?: string) =>
  res.status(201).json({ success: true, ...(message ? { message } : {}), data });

export const noContent = (res: Response) => res.status(204).send();

export const sendCsv = (res: Response, filename: string, rows: Array<Array<string | number | null | undefined>>) => {
  const escape = (value: string | number | null | undefined) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const csv = rows.map((row) => row.map(escape).join(',')).join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.status(200).send(csv);
};
