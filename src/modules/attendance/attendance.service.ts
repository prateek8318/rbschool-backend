import { Types } from 'mongoose';
import { oid } from '../../core/auth';
import { percentage } from '../../core/utils';
import { ATTENDED, AttendanceSheet } from './attendance.models';

export interface AttendanceStats {
  present: number;
  absent: number;
  late: number;
  leave: number;
  excused: number;
  /** Sessions that count towards the percentage. */
  total: number;
  percentage: number;
}

const emptyStats = (): AttendanceStats => ({ present: 0, absent: 0, late: 0, leave: 0, excused: 0, total: 0, percentage: 0 });

const finalize = (stats: AttendanceStats) => {
  // "excused" sessions are ignored entirely; "leave" still counts as not attended.
  stats.total = stats.present + stats.absent + stats.late + stats.leave;
  const attended = ATTENDED.reduce((sum, status) => sum + stats[status as 'present' | 'late'], 0);
  stats.percentage = percentage(attended, stats.total);
  return stats;
};

/** Attendance totals per student over a date range. */
export const attendanceStats = async (
  institutionId: string,
  studentIds: Array<string | Types.ObjectId>,
  range: { from?: string; to?: string } = {},
  groupBy: 'student' | 'student_month' | 'student_subject' = 'student',
) => {
  const ids = studentIds.map((id) => oid(id));
  const dateMatch: Record<string, string> = {};
  if (range.from) dateMatch.$gte = range.from;
  if (range.to) dateMatch.$lte = range.to;

  const groupId: Record<string, unknown> = { student: '$entries.studentId', status: '$entries.status' };
  if (groupBy === 'student_month') groupId.month = { $substrBytes: ['$date', 0, 7] };
  if (groupBy === 'student_subject') groupId.subject = '$subjectId';

  const rows = await AttendanceSheet.aggregate<{ _id: { student: Types.ObjectId; status: string; month?: string; subject?: Types.ObjectId }; count: number }>([
    {
      $match: {
        institutionId: oid(institutionId),
        'entries.studentId': { $in: ids },
        ...(Object.keys(dateMatch).length ? { date: dateMatch } : {}),
      },
    },
    { $unwind: '$entries' },
    { $match: { 'entries.studentId': { $in: ids } } },
    { $group: { _id: groupId, count: { $sum: 1 } } },
  ]);

  const result = new Map<string, AttendanceStats>();
  for (const row of rows) {
    const key = [String(row._id.student), row._id.month ?? '', row._id.subject ? String(row._id.subject) : ''].filter(Boolean).join('|');
    const stats = result.get(key) ?? emptyStats();
    stats[row._id.status as keyof Omit<AttendanceStats, 'total' | 'percentage'>] += row.count;
    result.set(key, stats);
  }
  for (const stats of result.values()) finalize(stats);
  return result;
};

export const statsFor = (map: Map<string, AttendanceStats>, key: string) => map.get(key) ?? finalize(emptyStats());
