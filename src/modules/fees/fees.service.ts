import { round } from '../../core/utils';
import { InvoiceDoc } from './fees.models';

/**
 * Re-derives every computed field of an invoice from its items, discount and
 * paid amount. Payments are spread over installments in due-date order.
 */
export const recalculateInvoice = (invoice: InvoiceDoc, today: string) => {
  const gross = invoice.items.reduce((sum, item) => sum + item.amount, 0);
  const discount = Math.min(invoice.discount?.amount ?? 0, gross);
  invoice.totalAmount = round(gross - discount);
  invoice.balance = round(Math.max(0, invoice.totalAmount - invoice.paidAmount));

  // Scale installments down if a discount made them exceed the total.
  const scheduled = invoice.installments.reduce((sum, item) => sum + item.amount, 0);
  if (scheduled > 0 && Math.abs(scheduled - invoice.totalAmount) > 0.01) {
    const factor = invoice.totalAmount / scheduled;
    let allocated = 0;
    invoice.installments.forEach((installment, index) => {
      const last = index === invoice.installments.length - 1;
      installment.amount = last ? round(invoice.totalAmount - allocated) : round(installment.amount * factor);
      allocated += installment.amount;
    });
  }

  let remaining = invoice.paidAmount;
  const ordered = [...invoice.installments].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  for (const installment of ordered) {
    const paid = Math.min(installment.amount, remaining);
    remaining = round(remaining - paid);
    installment.paidAmount = round(paid);
    if (paid >= installment.amount) installment.status = 'paid';
    else if (installment.dueDate < today) installment.status = 'overdue';
    else installment.status = paid > 0 ? 'partial' : 'pending';
  }

  const unpaid = ordered.filter((installment) => installment.status !== 'paid');
  invoice.nextDueDate = unpaid[0]?.dueDate;

  if (invoice.status === 'cancelled') return invoice;
  if (invoice.balance <= 0) invoice.status = 'paid';
  else if (unpaid.some((installment) => installment.status === 'overdue')) invoice.status = 'overdue';
  else invoice.status = invoice.paidAmount > 0 ? 'partial' : 'unpaid';
  return invoice;
};

/** Splits an amount into equal installments (last one absorbs rounding). */
export const splitInstallments = (total: number, dueDates: string[]) => {
  const each = round(total / dueDates.length);
  return dueDates.map((dueDate, index) => ({
    label: `Installment ${index + 1}`,
    dueDate,
    amount: index === dueDates.length - 1 ? round(total - each * (dueDates.length - 1)) : each,
  }));
};
