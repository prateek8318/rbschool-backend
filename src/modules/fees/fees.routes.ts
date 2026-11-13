import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { oid, requireRole, tenant } from '../../core/auth';
import { nextSequence } from '../../core/counter';
import { badRequest, notFound } from '../../core/errors';
import { events } from '../../core/events';
import { created, ok, sendCsv } from '../../core/http';
import { EMPLOYEES, FINANCE, LEARNERS, MANAGEMENT } from '../../core/roles';
import { assertOwned } from '../../core/tenancy';
import { pageMeta, round, searchRegex, todayIn } from '../../core/utils';
import { dateString, idParam, objectId, pagination, params, query, validate } from '../../core/validate';
import { Batch, Program } from '../academics/academics.models';
import { getCurrentSession } from '../institutions/academic-session.model';
import { getInstitutionSettings } from '../institutions/institution.service';
import { Student } from '../people/people.models';
import { assertCanViewStudent } from '../people/student-access';
import { FeeStructure, Invoice, INVOICE_STATUSES, Payment, PAYMENT_MODES } from './fees.models';
import { recalculateInvoice } from './fees.service';

const router = Router();

const lineItems = z.array(z.object({ name: z.string().trim().min(1).max(80), amount: z.number().min(0) })).min(1).max(50);
const installmentsBody = z
  .array(z.object({ label: z.string().trim().min(1).max(40), dueDate: dateString, amount: z.number().min(0) }))
  .min(1)
  .max(24);

const sum = (items: Array<{ amount: number }>) => round(items.reduce((total, item) => total + item.amount, 0));

const assertInstallmentsMatch = (items: Array<{ amount: number }>, installments: Array<{ amount: number }>, discount = 0) => {
  const total = round(sum(items) - discount);
  if (Math.abs(sum(installments) - total) > 0.01) {
    throw badRequest(`Installments add up to ${sum(installments)} but the total is ${total}`);
  }
};

// ======================= Fee structures =======================

const structureBody = z.object({
  name: z.string().trim().min(2).max(100),
  programIds: z.array(objectId).optional(),
  components: lineItems,
  installments: installmentsBody,
});

router.get('/structures', requireRole(...FINANCE), validate({ query: z.object({ sessionId: objectId.optional() }) }), async (req, res) => {
  const { institutionId } = tenant(req);
  const sessionId = query<{ sessionId?: string }>(req).sessionId ?? (await getCurrentSession(institutionId))._id;
  ok(res, await FeeStructure.find({ institutionId, sessionId }).populate('programIds', 'name').sort({ name: 1 }).lean());
});

router.post('/structures', requireRole(...MANAGEMENT), validate({ body: structureBody }), async (req, res) => {
  const { institutionId } = tenant(req);
  await assertOwned(Program, institutionId, req.body.programIds ?? [], 'programs');
  assertInstallmentsMatch(req.body.components, req.body.installments);
  const session = await getCurrentSession(institutionId);
  created(
    res,
    await FeeStructure.create({ ...req.body, institutionId, sessionId: session._id, totalAmount: sum(req.body.components) }),
  );
});

router.patch(
  '/structures/:id',
  requireRole(...MANAGEMENT),
  validate({ params: idParam, body: structureBody.partial().extend({ isActive: z.boolean().optional() }) }),
  async (req, res) => {
    const { institutionId } = tenant(req);
    await assertOwned(Program, institutionId, req.body.programIds ?? [], 'programs');
    const structure = await FeeStructure.findOne({ _id: params<{ id: string }>(req).id, institutionId });
    if (!structure) throw notFound('Fee structure');
    structure.set(req.body);
    assertInstallmentsMatch(structure.components, structure.installments);
    structure.totalAmount = sum(structure.components);
    await structure.save();
    // Existing invoices are not changed; edit them individually if needed.
    ok(res, structure);
  },
);

/**
 * Bill students using a structure. Pick students by batch, by id, or every
 * active student of the structure's programs. Already-billed students are skipped.
 */
router.post(
  '/structures/:id/assign',
  requireRole(...MANAGEMENT),
  validate({
    params: idParam,
    body: z.object({ batchIds: z.array(objectId).optional(), studentIds: z.array(objectId).optional() }),
  }),
  async (req, res) => {
    const ctx = tenant(req);
    const structure = await FeeStructure.findOne({ _id: params<{ id: string }>(req).id, institutionId: ctx.institutionId }).lean();
    if (!structure) throw notFound('Fee structure');
    const { batchIds, studentIds } = req.body as { batchIds?: string[]; studentIds?: string[] };
    await assertOwned(Batch, ctx.institutionId, batchIds ?? [], 'batches');

    const filter: Record<string, unknown> = { institutionId: ctx.institutionId, status: 'active' };
    if (studentIds?.length) filter._id = { $in: studentIds };
    else if (batchIds?.length) filter.batchId = { $in: batchIds };
    else if (structure.programIds.length) filter.programId = { $in: structure.programIds };
    else throw badRequest('Choose batchIds or studentIds (this structure is not linked to any program)');

    const students = await Student.find(filter).select('_id').lean();
    const alreadyBilled = new Set(
      (await Invoice.find({ structureId: structure._id, status: { $ne: 'cancelled' } }).select('studentId').lean()).map((invoice) =>
        String(invoice.studentId),
      ),
    );
    const toBill = students.filter((student) => !alreadyBilled.has(String(student._id)));
    const today = todayIn((await getInstitutionSettings(ctx.institutionId)).timezone);

    const invoices = toBill.map((student) =>
      recalculateInvoice(
        new Invoice({
          institutionId: ctx.institutionId,
          sessionId: structure.sessionId,
          studentId: student._id,
          structureId: structure._id,
          title: structure.name,
          items: structure.components,
          installments: structure.installments.map((installment) => ({ ...installment, paidAmount: 0 })),
          totalAmount: structure.totalAmount,
          balance: structure.totalAmount,
          createdBy: ctx.userId,
        }),
        today,
      ),
    );
    if (invoices.length) await Invoice.insertMany(invoices);
    created(res, { created: invoices.length, skipped: students.length - invoices.length });
  },
);

// ======================= Invoices =======================

const invoiceListQuery = pagination.extend({
  status: z.enum(INVOICE_STATUSES).optional(),
  batchId: objectId.optional(),
  studentId: objectId.optional(),
  sessionId: objectId.optional(),
});

const buildInvoiceFilter = async (institutionId: string, q: z.infer<typeof invoiceListQuery>) => {
  const filter: Record<string, unknown> = {
    institutionId,
    sessionId: q.sessionId ?? (await getCurrentSession(institutionId))._id,
  };
  if (q.status) filter.status = q.status;
  if (q.studentId) filter.studentId = q.studentId;
  if (q.batchId || q.search) {
    const studentFilter: Record<string, unknown> = { institutionId };
    if (q.batchId) studentFilter.batchId = q.batchId;
    if (q.search) {
      const regex = searchRegex(q.search);
      studentFilter.$or = [{ name: regex }, { enrollmentNo: regex }];
    }
    const ids = (await Student.find(studentFilter).select('_id').lean()).map((student) => student._id);
    filter.studentId = q.studentId ? { $in: ids.filter((id) => String(id) === q.studentId) } : { $in: ids };
  }
  return filter;
};

router.get('/invoices', requireRole(...FINANCE), validate({ query: invoiceListQuery }), async (req, res) => {
  const { institutionId } = tenant(req);
  const q = query<z.infer<typeof invoiceListQuery>>(req);
  const filter = await buildInvoiceFilter(institutionId, q);
  const [items, total] = await Promise.all([
    Invoice.find(filter)
      .populate({ path: 'studentId', select: 'name enrollmentNo rollNo batchId', populate: { path: 'batchId', select: 'name' } })
      .sort({ nextDueDate: 1, createdAt: -1 })
      .skip((q.page - 1) * q.limit)
      .limit(q.limit)
      .lean(),
    Invoice.countDocuments(filter),
  ]);
  ok(res, items, pageMeta(q.page, q.limit, total));
});

router.get('/invoices/export', requireRole(...FINANCE), validate({ query: invoiceListQuery.omit({ page: true, limit: true }) }), async (req, res) => {
  const { institutionId } = tenant(req);
  const filter = await buildInvoiceFilter(institutionId, query<z.infer<typeof invoiceListQuery>>(req));
  const invoices = await Invoice.find(filter)
    .populate<{ studentId: { name: string; enrollmentNo: string; batchId?: { name: string } } }>({
      path: 'studentId',
      select: 'name enrollmentNo batchId',
      populate: { path: 'batchId', select: 'name' },
    })
    .sort({ createdAt: -1 })
    .lean();
  sendCsv(res, 'fees.csv', [
    ['Student', 'Enrollment No', 'Batch', 'Invoice', 'Total', 'Discount', 'Paid', 'Balance', 'Status', 'Next Due'],
    ...invoices.map((invoice) => [
      invoice.studentId?.name,
      invoice.studentId?.enrollmentNo,
      invoice.studentId?.batchId?.name,
      invoice.title,
      invoice.totalAmount,
      invoice.discount?.amount ?? 0,
      invoice.paidAmount,
      invoice.balance,
      invoice.status,
      invoice.nextDueDate,
    ]),
  ]);
});

/** One-off invoice for a student (e.g. transport, exam fee, fine). */
router.post(
  '/invoices',
  requireRole(...FINANCE),
  validate({
    body: z.object({
      studentId: objectId,
      title: z.string().trim().min(2).max(100),
      items: lineItems,
      installments: installmentsBody.optional(),
      dueDate: dateString.optional(),
    }).refine((body) => body.installments || body.dueDate, { message: 'Provide installments or a dueDate' }),
  }),
  async (req, res) => {
    const ctx = tenant(req);
    const student = await Student.findOne({ _id: req.body.studentId, institutionId: ctx.institutionId }).lean();
    if (!student) throw notFound('Student');
    const total = sum(req.body.items);
    const installments = req.body.installments ?? [{ label: 'Full payment', dueDate: req.body.dueDate, amount: total }];
    assertInstallmentsMatch(req.body.items, installments);

    const institution = await getInstitutionSettings(ctx.institutionId);
    const invoice = recalculateInvoice(
      new Invoice({
        institutionId: ctx.institutionId,
        sessionId: (await getCurrentSession(ctx.institutionId))._id,
        studentId: student._id,
        title: req.body.title,
        items: req.body.items,
        installments,
        totalAmount: total,
        balance: total,
        createdBy: ctx.userId,
      }),
      todayIn(institution.timezone),
    );
    await invoice.save();
    created(res, invoice);
  },
);

router.get('/invoices/:id', requireRole(...FINANCE, ...LEARNERS), validate({ params: idParam }), async (req, res) => {
  const ctx = tenant(req);
  const invoice = await Invoice.findOne({ _id: params<{ id: string }>(req).id, institutionId: ctx.institutionId })
    .populate('studentId', 'name enrollmentNo rollNo')
    .lean();
  if (!invoice) throw notFound('Invoice');
  await assertCanViewStudent(ctx, String((invoice.studentId as unknown as { _id: unknown })._id));
  const payments = await Payment.find({ invoiceId: invoice._id }).sort({ paidAt: -1 }).lean();
  ok(res, { ...invoice, payments });
});

/** Apply a discount / scholarship or correct line items. */
router.patch(
  '/invoices/:id',
  requireRole(...MANAGEMENT),
  validate({
    params: idParam,
    body: z.object({
      title: z.string().trim().min(2).max(100).optional(),
      items: lineItems.optional(),
      discount: z.object({ amount: z.number().min(0), reason: z.string().max(200).optional() }).optional(),
      installments: installmentsBody.optional(),
    }),
  }),
  async (req, res) => {
    const { institutionId } = tenant(req);
    const invoice = await Invoice.findOne({ _id: params<{ id: string }>(req).id, institutionId });
    if (!invoice) throw notFound('Invoice');
    if (invoice.status === 'cancelled') throw badRequest('Invoice is cancelled');
    invoice.set(req.body);
    if (req.body.installments) assertInstallmentsMatch(invoice.items, invoice.installments, invoice.discount?.amount ?? 0);
    if (sum(invoice.items) - (invoice.discount?.amount ?? 0) < invoice.paidAmount) {
      throw badRequest('Total cannot be less than the amount already paid');
    }
    recalculateInvoice(invoice, todayIn((await getInstitutionSettings(institutionId)).timezone));
    await invoice.save();
    ok(res, invoice);
  },
);

router.post(
  '/invoices/:id/cancel',
  requireRole(...MANAGEMENT),
  validate({ params: idParam }),
  async (req, res) => {
    const { institutionId } = tenant(req);
    const invoice = await Invoice.findOne({ _id: params<{ id: string }>(req).id, institutionId });
    if (!invoice) throw notFound('Invoice');
    if (invoice.paidAmount > 0) throw badRequest('Reverse the payments before cancelling this invoice');
    invoice.status = 'cancelled';
    await invoice.save();
    ok(res, invoice);
  },
);

// ======================= Payments =======================

router.post(
  '/invoices/:id/payments',
  requireRole(...FINANCE),
  validate({
    params: idParam,
    body: z.object({
      amount: z.number().positive(),
      mode: z.enum(PAYMENT_MODES),
      reference: z.string().trim().max(100).optional(),
      paidAt: dateString.optional(),
      note: z.string().max(300).optional(),
    }),
  }),
  async (req, res) => {
    const ctx = tenant(req);
    const institution = await getInstitutionSettings(ctx.institutionId);
    const today = todayIn(institution.timezone);
    let paymentId: unknown;

    await mongoose.connection.transaction(async (tx) => {
      const invoice = await Invoice.findOne({ _id: params<{ id: string }>(req).id, institutionId: ctx.institutionId }).session(tx);
      if (!invoice) throw notFound('Invoice');
      if (invoice.status === 'cancelled') throw badRequest('Invoice is cancelled');
      if (req.body.amount > invoice.balance + 0.001) throw badRequest(`Amount is more than the balance (${invoice.balance})`);

      const paidAt = req.body.paidAt ?? today;
      const sequence = await nextSequence(`receipt:${ctx.institutionId}:${paidAt.slice(0, 4)}`, tx);
      const receiptNo = `${institution.code.toUpperCase().slice(0, 6)}-${paidAt.slice(0, 4)}-${String(sequence).padStart(5, '0')}`;

      const [payment] = await Payment.create(
        [{ ...req.body, paidAt, receiptNo, institutionId: ctx.institutionId, invoiceId: invoice._id, studentId: invoice.studentId, receivedBy: ctx.userId }],
        { session: tx },
      );
      paymentId = payment._id;

      invoice.paidAmount = round(invoice.paidAmount + req.body.amount);
      recalculateInvoice(invoice, today);
      await invoice.save({ session: tx });
    });

    const payment = await Payment.findById(paymentId).lean();
    events.emit('fee.payment_recorded', {
      institutionId: ctx.institutionId,
      studentId: String(payment!.studentId),
      invoiceId: String(payment!.invoiceId),
      amount: payment!.amount,
    });
    created(res, payment, 'Payment recorded');
  },
);

router.post(
  '/payments/:id/reverse',
  requireRole(...MANAGEMENT),
  validate({ params: idParam, body: z.object({ reason: z.string().trim().min(3).max(200) }) }),
  async (req, res) => {
    const ctx = tenant(req);
    const today = todayIn((await getInstitutionSettings(ctx.institutionId)).timezone);
    await mongoose.connection.transaction(async (tx) => {
      const payment = await Payment.findOne({ _id: params<{ id: string }>(req).id, institutionId: ctx.institutionId }).session(tx);
      if (!payment) throw notFound('Payment');
      if (payment.status === 'reversed') throw badRequest('Payment is already reversed');
      payment.set({ status: 'reversed', reversedBy: ctx.userId, reversalReason: req.body.reason });
      await payment.save({ session: tx });

      const invoice = await Invoice.findById(payment.invoiceId).session(tx);
      if (invoice) {
        invoice.paidAmount = round(Math.max(0, invoice.paidAmount - payment.amount));
        if (invoice.status === 'paid') invoice.status = 'partial';
        recalculateInvoice(invoice, today);
        await invoice.save({ session: tx });
      }
    });
    ok(res, await Payment.findById(params<{ id: string }>(req).id).lean(), undefined, 'Payment reversed');
  },
);

/** Collection register. */
router.get(
  '/payments',
  requireRole(...FINANCE),
  validate({
    query: pagination.extend({ from: dateString.optional(), to: dateString.optional(), mode: z.enum(PAYMENT_MODES).optional() }),
  }),
  async (req, res) => {
    const { institutionId } = tenant(req);
    const q = query<{ page: number; limit: number; from?: string; to?: string; mode?: string }>(req);
    const filter: Record<string, unknown> = { institutionId, status: 'success' };
    if (q.mode) filter.mode = q.mode;
    if (q.from || q.to) filter.paidAt = { ...(q.from ? { $gte: q.from } : {}), ...(q.to ? { $lte: q.to } : {}) };

    const [items, total, totals] = await Promise.all([
      Payment.find(filter)
        .populate('studentId', 'name enrollmentNo')
        .populate('receivedBy', 'name')
        .sort({ paidAt: -1, createdAt: -1 })
        .skip((q.page - 1) * q.limit)
        .limit(q.limit)
        .lean(),
      Payment.countDocuments(filter),
      Payment.aggregate<{ _id: null; amount: number }>([
        { $match: { ...filter, institutionId: oid(institutionId) } },
        { $group: { _id: null, amount: { $sum: '$amount' } } },
      ]),
    ]);
    ok(res, items, { ...pageMeta(q.page, q.limit, total), totalAmount: round(totals[0]?.amount ?? 0) });
  },
);

/** Everything a receipt needs; the app renders / prints / shares it. */
router.get('/payments/:id/receipt', requireRole(...FINANCE, ...LEARNERS), validate({ params: idParam }), async (req, res) => {
  const ctx = tenant(req);
  const payment = await Payment.findOne({ _id: params<{ id: string }>(req).id, institutionId: ctx.institutionId })
    .populate('receivedBy', 'name')
    .lean();
  if (!payment) throw notFound('Payment');
  const student = await assertCanViewStudent(ctx, String(payment.studentId));
  const [invoice, institution] = await Promise.all([
    Invoice.findById(payment.invoiceId).select('title totalAmount paidAmount balance').lean(),
    getInstitutionSettings(ctx.institutionId),
  ]);
  ok(res, {
    receiptNo: payment.receiptNo,
    institution: { name: institution.name, currency: institution.currency },
    student: { name: student.name, enrollmentNo: student.enrollmentNo, rollNo: student.rollNo },
    invoice,
    payment,
  });
});

// ======================= Student view & reports =======================

/** All invoices and payments of one student (student/guardian app "Fees" tab). */
router.get('/students/:id', requireRole(...EMPLOYEES, ...LEARNERS), validate({ params: idParam }), async (req, res) => {
  const ctx = tenant(req);
  const { id } = params<{ id: string }>(req);
  await assertCanViewStudent(ctx, id);
  const [invoices, payments] = await Promise.all([
    Invoice.find({ institutionId: ctx.institutionId, studentId: id, status: { $ne: 'cancelled' } }).sort({ createdAt: -1 }).lean(),
    Payment.find({ institutionId: ctx.institutionId, studentId: id, status: 'success' }).sort({ paidAt: -1 }).lean(),
  ]);
  ok(res, {
    totals: {
      total: round(invoices.reduce((total, invoice) => total + invoice.totalAmount, 0)),
      paid: round(invoices.reduce((total, invoice) => total + invoice.paidAmount, 0)),
      balance: round(invoices.reduce((total, invoice) => total + invoice.balance, 0)),
      overdue: invoices.some((invoice) => invoice.status === 'overdue'),
      nextDueDate: invoices.map((invoice) => invoice.nextDueDate).filter(Boolean).sort()[0] ?? null,
    },
    invoices,
    payments,
  });
});

router.get('/summary', requireRole(...FINANCE), validate({ query: z.object({ sessionId: objectId.optional() }) }), async (req, res) => {
  const { institutionId } = tenant(req);
  const sessionId = oid(query<{ sessionId?: string }>(req).sessionId ?? String((await getCurrentSession(institutionId))._id));
  const institutionOid = oid(institutionId);

  const [invoiceTotals, byStatus, monthly, byMode] = await Promise.all([
    Invoice.aggregate([
      { $match: { institutionId: institutionOid, sessionId, status: { $ne: 'cancelled' } } },
      {
        $group: {
          _id: null,
          billed: { $sum: '$totalAmount' },
          collected: { $sum: '$paidAmount' },
          outstanding: { $sum: '$balance' },
          discounts: { $sum: '$discount.amount' },
        },
      },
    ]),
    Invoice.aggregate([
      { $match: { institutionId: institutionOid, sessionId } },
      { $group: { _id: '$status', count: { $sum: 1 }, balance: { $sum: '$balance' } } },
    ]),
    Payment.aggregate([
      { $match: { institutionId: institutionOid, status: 'success' } },
      { $lookup: { from: 'invoices', localField: 'invoiceId', foreignField: '_id', as: 'invoice' } },
      { $match: { 'invoice.sessionId': sessionId } },
      { $group: { _id: { $substrBytes: ['$paidAt', 0, 7] }, amount: { $sum: '$amount' }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    Payment.aggregate([
      { $match: { institutionId: institutionOid, status: 'success' } },
      { $lookup: { from: 'invoices', localField: 'invoiceId', foreignField: '_id', as: 'invoice' } },
      { $match: { 'invoice.sessionId': sessionId } },
      { $group: { _id: '$mode', amount: { $sum: '$amount' } } },
    ]),
  ]);

  const totals = invoiceTotals[0] ?? { billed: 0, collected: 0, outstanding: 0, discounts: 0 };
  ok(res, {
    billed: round(totals.billed),
    collected: round(totals.collected),
    outstanding: round(totals.outstanding),
    discounts: round(totals.discounts),
    collectionRate: totals.billed ? round((totals.collected / totals.billed) * 100) : 0,
    byStatus: Object.fromEntries(byStatus.map((row) => [row._id, { count: row.count, balance: round(row.balance) }])),
    monthly: monthly.map((row) => ({ month: row._id, amount: round(row.amount), count: row.count })),
    byMode: Object.fromEntries(byMode.map((row) => [row._id, round(row.amount)])),
  });
});

/** Defaulters list with guardian contact for follow-up calls. */
router.get('/overdue', requireRole(...FINANCE), validate({ query: z.object({ batchId: objectId.optional() }) }), async (req, res) => {
  const { institutionId } = tenant(req);
  const { batchId } = query<{ batchId?: string }>(req);
  const filter: Record<string, unknown> = { institutionId, status: 'overdue' };
  if (batchId) {
    filter.studentId = { $in: (await Student.find({ institutionId, batchId }).select('_id').lean()).map((student) => student._id) };
  }
  const invoices = await Invoice.find(filter)
    .populate({
      path: 'studentId',
      select: 'name enrollmentNo rollNo batchId guardians',
      populate: { path: 'batchId', select: 'name' },
    })
    .sort({ nextDueDate: 1 })
    .lean();
  ok(
    res,
    invoices.map((invoice) => ({
      ...invoice,
      overdueAmount: round(
        invoice.installments
          .filter((installment) => installment.status === 'overdue')
          .reduce((total, installment) => total + installment.amount - installment.paidAmount, 0),
      ),
    })),
  );
});

export default router;
