import cron from 'node-cron';
import { events } from '../../core/events';
import { todayIn } from '../../core/utils';
import { getInstitutionSettings } from '../institutions/institution.service';
import { Invoice } from './fees.models';
import { recalculateInvoice } from './fees.service';

/** Marks installments overdue and tells guardians. Safe to run any number of times. */
export const refreshOverdueInvoices = async () => {
  const candidates = await Invoice.find({
    status: { $in: ['unpaid', 'partial', 'overdue'] },
    nextDueDate: { $exists: true },
  });

  const newlyOverdue = new Map<string, string[]>();
  for (const invoice of candidates) {
    const institution = await getInstitutionSettings(invoice.institutionId).catch(() => null);
    if (!institution) continue;
    const before = invoice.status;
    recalculateInvoice(invoice, todayIn(institution.timezone));
    if (!invoice.isModified()) continue;
    await invoice.save();

    if (before !== 'overdue' && invoice.status === 'overdue' && institution.settings.sendFeeReminders) {
      const key = String(invoice.institutionId);
      newlyOverdue.set(key, [...(newlyOverdue.get(key) ?? []), String(invoice.studentId)]);
    }
  }

  for (const [institutionId, studentIds] of newlyOverdue) {
    events.emit('fee.overdue', { institutionId, studentIds: [...new Set(studentIds)] });
  }
  return { checked: candidates.length, newlyOverdue: [...newlyOverdue.values()].flat().length };
};

export const startFeeJobs = () => {
  // Every day at 06:00 server time.
  cron.schedule('0 6 * * *', () => {
    refreshOverdueInvoices()
      .then((result) => console.log('[jobs] overdue fees refreshed', result))
      .catch((error) => console.error('[jobs] overdue fee refresh failed', error));
  });
};
