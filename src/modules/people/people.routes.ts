import { Router } from 'express';
import { z } from 'zod';
import { requireRole, tenant } from '../../core/auth';
import { badRequest, conflict, forbidden, notFound } from '../../core/errors';
import { created, ok, sendCsv } from '../../core/http';
import { EMPLOYEES, LEARNERS, MANAGEMENT } from '../../core/roles';
import { assertOwned } from '../../core/tenancy';
import { pageMeta, searchRegex } from '../../core/utils';
import { dateString, idParam, objectId, pagination, params, phone, query, validate } from '../../core/validate';
import { Batch, Subject } from '../academics/academics.models';
import { Membership } from '../auth/membership.model';
import { User } from '../auth/user.model';
import { Staff, STUDENT_STATUSES, Student } from './people.models';
import {
  createStaff,
  createStudent,
  createStudentLogin,
  IssuedCredential,
  linkGuardian,
  resolvePlacement,
  setStaffActive,
  STAFF_ROLES,
  staffRolesFor,
} from './people.service';
import { assertCanViewStudent, myStudents } from './student-access';

// ============================ Students ============================

export const studentsRouter = Router();

const guardianBody = z.object({
  name: z.string().trim().min(2).max(100),
  phone,
  email: z.string().email().optional(),
  relation: z.string().trim().max(30).optional(),
  isPrimary: z.boolean().optional(),
});

const studentFields = {
  name: z.string().trim().min(2).max(100),
  enrollmentNo: z.string().trim().min(1).max(40),
  rollNo: z.string().trim().max(20).optional(),
  dob: dateString.optional(),
  gender: z.enum(['male', 'female', 'other']).optional(),
  bloodGroup: z.string().max(5).optional(),
  photoUrl: z.string().url().optional(),
  email: z.string().email().optional(),
  phone: phone.optional(),
  address: z.string().max(300).optional(),
  programId: objectId.optional(),
  batchId: objectId.optional(),
  admissionDate: dateString.optional(),
  customFields: z.record(z.string().max(200)).optional(),
};

const createStudentBody = z.object({
  ...studentFields,
  guardians: z.array(guardianBody).max(4).optional(),
  createLogin: z.boolean().optional(),
});

const listQuery = pagination.extend({
  batchId: objectId.optional(),
  programId: objectId.optional(),
  status: z.enum(STUDENT_STATUSES).default('active'),
});

const buildStudentFilter = (institutionId: string, q: z.infer<typeof listQuery>) => {
  const filter: Record<string, unknown> = { institutionId, status: q.status };
  if (q.batchId) filter.batchId = q.batchId;
  if (q.programId) filter.programId = q.programId;
  if (q.search) {
    const regex = searchRegex(q.search);
    filter.$or = [{ name: regex }, { enrollmentNo: regex }, { rollNo: regex }, { phone: regex }, { 'guardians.phone': regex }];
  }
  return filter;
};

studentsRouter.get('/', requireRole(...EMPLOYEES), validate({ query: listQuery }), async (req, res) => {
  const { institutionId } = tenant(req);
  const q = query<z.infer<typeof listQuery>>(req);
  const filter = buildStudentFilter(institutionId, q);
  const [items, total] = await Promise.all([
    Student.find(filter)
      .populate('batchId', 'name')
      .populate('programId', 'name')
      .sort({ name: 1 })
      .skip((q.page - 1) * q.limit)
      .limit(q.limit)
      .lean(),
    Student.countDocuments(filter),
  ]);
  ok(res, items, pageMeta(q.page, q.limit, total));
});

studentsRouter.get('/export', requireRole(...MANAGEMENT), validate({ query: listQuery.omit({ page: true, limit: true }) }), async (req, res) => {
  const { institutionId } = tenant(req);
  const q = query<z.infer<typeof listQuery>>(req);
  const students = await Student.find(buildStudentFilter(institutionId, q))
    .populate<{ batchId: { name: string } | null }>('batchId', 'name')
    .populate<{ programId: { name: string } | null }>('programId', 'name')
    .sort({ name: 1 })
    .lean();
  sendCsv(res, 'students.csv', [
    ['Name', 'Enrollment No', 'Roll No', 'Program', 'Batch', 'Gender', 'DOB', 'Phone', 'Guardian', 'Guardian Phone', 'Status'],
    ...students.map((student) => {
      const guardian = student.guardians.find((item) => item.isPrimary) ?? student.guardians[0];
      return [
        student.name,
        student.enrollmentNo,
        student.rollNo,
        student.programId?.name,
        student.batchId?.name,
        student.gender,
        student.dob,
        student.phone,
        guardian?.name,
        guardian?.phone,
        student.status,
      ];
    }),
  ]);
});

/** Admission. Creates guardian accounts (and optionally a student login). */
studentsRouter.post('/', requireRole(...MANAGEMENT), validate({ body: createStudentBody }), async (req, res) => {
  created(res, await createStudent(tenant(req), req.body), 'Student added');
});

/** Bulk admission, e.g. from a spreadsheet. Each row succeeds or fails on its own. */
studentsRouter.post(
  '/bulk',
  requireRole(...MANAGEMENT),
  validate({ body: z.object({ students: z.array(createStudentBody).min(1).max(500) }) }),
  async (req, res) => {
    const ctx = tenant(req);
    const results: Array<{ row: number; enrollmentNo: string; ok: boolean; studentId?: string; error?: string }> = [];
    const credentials: IssuedCredential[] = [];
    for (const [index, row] of (req.body.students as z.infer<typeof createStudentBody>[]).entries()) {
      try {
        const result = await createStudent(ctx, row);
        credentials.push(...result.credentials);
        results.push({ row: index + 1, enrollmentNo: row.enrollmentNo, ok: true, studentId: String(result.student?._id) });
      } catch (error) {
        results.push({ row: index + 1, enrollmentNo: row.enrollmentNo, ok: false, error: (error as Error).message });
      }
    }
    created(res, {
      created: results.filter((item) => item.ok).length,
      failed: results.filter((item) => !item.ok).length,
      results,
      credentials,
    });
  },
);

/**
 * Move students to a new batch, usually at the start of a new session.
 * Students not selected can optionally be marked as alumni (final year).
 */
studentsRouter.post(
  '/promote',
  requireRole(...MANAGEMENT),
  validate({
    body: z
      .object({
        fromBatchId: objectId,
        toBatchId: objectId.optional(),
        studentIds: z.array(objectId).optional(),
        markAsAlumni: z.boolean().default(false),
      })
      .refine((body) => body.toBatchId || body.markAsAlumni, { message: 'Provide toBatchId or set markAsAlumni' }),
  }),
  async (req, res) => {
    const { institutionId } = tenant(req);
    const { fromBatchId, toBatchId, studentIds, markAsAlumni } = req.body;
    await assertOwned(Batch, institutionId, [fromBatchId, toBatchId], 'batches');

    const filter: Record<string, unknown> = { institutionId, batchId: fromBatchId, status: 'active' };
    if (studentIds?.length) filter._id = { $in: studentIds };

    if (markAsAlumni) {
      const result = await Student.updateMany(filter, { status: 'alumni' });
      return ok(res, { updated: result.modifiedCount });
    }
    const placement = await resolvePlacement(institutionId, undefined, toBatchId);
    const result = await Student.updateMany(filter, placement);
    return ok(res, { updated: result.modifiedCount });
  },
);

studentsRouter.get('/:id', requireRole(...EMPLOYEES, ...LEARNERS), validate({ params: idParam }), async (req, res) => {
  const ctx = tenant(req);
  await assertCanViewStudent(ctx, params<{ id: string }>(req).id);
  const student = await Student.findById(params<{ id: string }>(req).id)
    .populate('batchId', 'name coordinatorId')
    .populate('programId', 'name code')
    .lean();
  ok(res, student);
});

studentsRouter.patch(
  '/:id',
  requireRole(...MANAGEMENT),
  validate({
    params: idParam,
    body: z.object({ ...studentFields, status: z.enum(STUDENT_STATUSES) }).partial(),
  }),
  async (req, res) => {
    const { institutionId } = tenant(req);
    const { id } = params<{ id: string }>(req);
    const body = { ...req.body };

    if (body.enrollmentNo && (await Student.exists({ institutionId, enrollmentNo: body.enrollmentNo, _id: { $ne: id } }))) {
      throw conflict(`Enrollment number ${body.enrollmentNo} is already used`);
    }
    if (body.batchId || body.programId) Object.assign(body, await resolvePlacement(institutionId, body.programId, body.batchId));

    const student = await Student.findOneAndUpdate({ _id: id, institutionId }, body, { new: true, runValidators: true });
    if (!student) throw notFound('Student');

    // A student who leaves loses app access.
    if (student.userId && body.status) {
      await Membership.updateOne(
        { institutionId, userId: student.userId, role: 'student' },
        { status: body.status === 'active' ? 'active' : 'suspended' },
      );
    }
    ok(res, student);
  },
);

studentsRouter.post(
  '/:id/guardians',
  requireRole(...MANAGEMENT),
  validate({ params: idParam, body: guardianBody }),
  async (req, res) => {
    const { institutionId } = tenant(req);
    const student = await Student.findOne({ _id: params<{ id: string }>(req).id, institutionId });
    if (!student) throw notFound('Student');

    const { guardian, credential } = await linkGuardian(institutionId, req.body);
    if (student.guardians.some((item) => String(item.userId) === String(guardian.userId))) {
      throw conflict('This guardian is already linked');
    }
    if (guardian.isPrimary) student.guardians.forEach((item) => (item.isPrimary = false));
    if (!student.guardians.length) guardian.isPrimary = true;
    student.guardians.push(guardian);
    await student.save();
    created(res, { student, credential: credential ?? null });
  },
);

studentsRouter.delete(
  '/:id/guardians/:userId',
  requireRole(...MANAGEMENT),
  validate({ params: z.object({ id: objectId, userId: objectId }) }),
  async (req, res) => {
    const { institutionId } = tenant(req);
    const { id, userId } = params<{ id: string; userId: string }>(req);
    const student = await Student.findOneAndUpdate(
      { _id: id, institutionId },
      { $pull: { guardians: { userId } } },
      { new: true },
    );
    if (!student) throw notFound('Student');

    // Revoke guardian access if they no longer have any child here.
    if (!(await Student.exists({ institutionId, 'guardians.userId': userId }))) {
      await Membership.updateOne({ institutionId, userId, role: 'guardian' }, { status: 'suspended' });
    }
    ok(res, student);
  },
);

/** Give an existing student their own app login. */
studentsRouter.post('/:id/login', requireRole(...MANAGEMENT), validate({ params: idParam }), async (req, res) => {
  const { institutionId } = tenant(req);
  const student = await Student.findOne({ _id: params<{ id: string }>(req).id, institutionId }).lean();
  if (!student) throw notFound('Student');
  if (student.userId) throw conflict('Student already has a login');
  const { credential } = await createStudentLogin(institutionId, student);
  created(res, { credential: credential ?? null }, credential ? undefined : 'Linked to the existing account with this phone/email');
});

// ============================ Staff ============================

export const staffRouter = Router();

const staffFields = {
  name: z.string().trim().min(2).max(100),
  email: z.string().email().optional(),
  employeeCode: z.string().trim().max(30).optional(),
  designation: z.string().trim().max(60).optional(),
  department: z.string().trim().max(60).optional(),
  subjectIds: z.array(objectId).optional(),
  qualification: z.string().max(200).optional(),
  experienceYears: z.number().min(0).max(70).optional(),
  joiningDate: dateString.optional(),
  photoUrl: z.string().url().optional(),
};

staffRouter.get(
  '/',
  requireRole(...EMPLOYEES),
  validate({
    query: pagination.extend({
      role: z.enum(STAFF_ROLES).optional(),
      status: z.enum(['active', 'inactive']).default('active'),
      department: z.string().optional(),
    }),
  }),
  async (req, res) => {
    const { institutionId } = tenant(req);
    const q = query<{ page: number; limit: number; search?: string; role?: string; status: string; department?: string }>(req);
    const filter: Record<string, unknown> = { institutionId, status: q.status };
    if (q.department) filter.department = q.department;
    if (q.search) {
      const regex = searchRegex(q.search);
      filter.$or = [{ name: regex }, { phone: regex }, { email: regex }, { employeeCode: regex }];
    }
    if (q.role) {
      filter.userId = { $in: await Membership.distinct('userId', { institutionId, role: q.role, status: 'active' }) };
    }

    const [items, total] = await Promise.all([
      Staff.find(filter).populate('subjectIds', 'name').sort({ name: 1 }).skip((q.page - 1) * q.limit).limit(q.limit).lean(),
      Staff.countDocuments(filter),
    ]);
    const [roles, access] = await Promise.all([
      staffRolesFor(institutionId, items.map((item) => item.userId)),
      accessInfo(items.map((item) => item.userId)),
    ]);
    ok(
      res,
      items.map((item) => ({ ...item, roles: roles.get(String(item.userId)) ?? [], access: access.get(String(item.userId)) ?? null })),
      pageMeta(q.page, q.limit, total),
    );
  },
);

staffRouter.post(
  '/',
  requireRole(...MANAGEMENT),
  validate({ body: z.object({ ...staffFields, phone, role: z.enum(STAFF_ROLES) }) }),
  async (req, res) => {
    const ctx = tenant(req);
    if (req.body.role === 'admin' && ctx.role !== 'owner') throw forbidden('Only the owner can add admins');
    await assertOwned(Subject, ctx.institutionId, req.body.subjectIds ?? [], 'subjects');
    created(res, await createStaff(ctx, req.body), 'Staff member added');
  },
);

staffRouter.get('/:id', requireRole(...EMPLOYEES), validate({ params: idParam }), async (req, res) => {
  const { institutionId } = tenant(req);
  const staff = await Staff.findOne({ _id: params<{ id: string }>(req).id, institutionId }).populate('subjectIds', 'name code').lean();
  if (!staff) throw notFound('Staff member');

  const [roles, batches] = await Promise.all([
    staffRolesFor(institutionId, [staff.userId]),
    Batch.find({ institutionId, isActive: true, $or: [{ coordinatorId: staff.userId }, { 'subjects.teacherId': staff.userId }] })
      .select('name programId coordinatorId subjects')
      .populate('programId', 'name')
      .populate('subjects.subjectId', 'name')
      .lean(),
  ]);
  ok(res, { ...staff, roles: roles.get(String(staff.userId)) ?? [], batches });
});

staffRouter.patch(
  '/:id',
  requireRole(...MANAGEMENT),
  validate({ params: idParam, body: z.object(staffFields).partial() }),
  async (req, res) => {
    const { institutionId } = tenant(req);
    const { id } = params<{ id: string }>(req);
    await assertOwned(Subject, institutionId, req.body.subjectIds ?? [], 'subjects');
    if (req.body.employeeCode && (await Staff.exists({ institutionId, employeeCode: req.body.employeeCode, _id: { $ne: id } }))) {
      throw conflict(`Employee code ${req.body.employeeCode} is already used`);
    }
    const staff = await Staff.findOneAndUpdate({ _id: id, institutionId }, req.body, { new: true, runValidators: true });
    if (!staff) throw notFound('Staff member');
    ok(res, staff);
  },
);

/** Change which roles a staff member holds (e.g. make a teacher an admin too). */
staffRouter.put(
  '/:id/roles',
  requireRole(...MANAGEMENT),
  validate({ params: idParam, body: z.object({ roles: z.array(z.enum(STAFF_ROLES)).min(1) }) }),
  async (req, res) => {
    const ctx = tenant(req);
    const staff = await Staff.findOne({ _id: params<{ id: string }>(req).id, institutionId: ctx.institutionId });
    if (!staff) throw notFound('Staff member');

    const current = (await staffRolesFor(ctx.institutionId, [staff.userId])).get(String(staff.userId)) ?? [];
    const wanted: string[] = req.body.roles;
    if (current.includes('owner')) throw badRequest("The owner's roles cannot be changed");
    if (ctx.role !== 'owner' && (wanted.includes('admin') || current.includes('admin'))) {
      throw forbidden('Only the owner can grant or remove admin access');
    }

    for (const role of STAFF_ROLES) {
      await Membership.updateOne(
        { institutionId: ctx.institutionId, userId: staff.userId, role },
        { status: wanted.includes(role) ? 'active' : 'suspended' },
        { upsert: wanted.includes(role) },
      );
    }
    ok(res, { roles: (await staffRolesFor(ctx.institutionId, [staff.userId])).get(String(staff.userId)) ?? [] });
  },
);

staffRouter.post('/:id/deactivate', requireRole(...MANAGEMENT), validate({ params: idParam }), async (req, res) => {
  const ctx = tenant(req);
  const staff = await Staff.findOne({ _id: params<{ id: string }>(req).id, institutionId: ctx.institutionId }).lean();
  if (!staff) throw notFound('Staff member');
  if (String(staff.userId) === ctx.userId) throw badRequest('You cannot deactivate yourself');
  const roles = (await staffRolesFor(ctx.institutionId, [staff.userId])).get(String(staff.userId)) ?? [];
  if (roles.includes('admin') && ctx.role !== 'owner') throw forbidden('Only the owner can deactivate an admin');
  ok(res, await setStaffActive(ctx.institutionId, String(staff._id), false));
});

staffRouter.post('/:id/activate', requireRole(...MANAGEMENT), validate({ params: idParam }), async (req, res) => {
  ok(res, await setStaffActive(tenant(req).institutionId, params<{ id: string }>(req).id, true));
});

// ============================ Guardians (parents) ============================

/** Login status shown in the admin panel: has the person verified their phone / logged in? */
const accessInfo = async (userIds: unknown[]) => {
  const users = await User.find({ _id: { $in: userIds } }).select('phone phoneVerifiedAt lastLoginAt isActive').lean();
  return new Map(
    users.map((user) => [
      String(user._id),
      { phoneVerified: Boolean(user.phoneVerifiedAt), phoneVerifiedAt: user.phoneVerifiedAt ?? null, lastLoginAt: user.lastLoginAt ?? null },
    ]),
  );
};

export const guardiansRouter = Router();

/** Parents/guardians of this institution with their children and access status. */
guardiansRouter.get(
  '/',
  requireRole(...MANAGEMENT),
  validate({ query: pagination.extend({ status: z.enum(['active', 'suspended']).optional(), batchId: objectId.optional() }) }),
  async (req, res) => {
    const { institutionId } = tenant(req);
    const q = query<{ page: number; limit: number; search?: string; status?: string; batchId?: string }>(req);

    const membershipFilter: Record<string, unknown> = { institutionId, role: 'guardian' };
    if (q.status) membershipFilter.status = q.status;
    let userIds = await Membership.distinct('userId', membershipFilter);

    if (q.batchId) {
      const linked = await Student.distinct('guardians.userId', { institutionId, batchId: q.batchId, status: 'active' });
      const set = new Set(linked.map(String));
      userIds = userIds.filter((id) => set.has(String(id)));
    }

    const userFilter: Record<string, unknown> = { _id: { $in: userIds } };
    if (q.search) {
      const regex = searchRegex(q.search);
      userFilter.$or = [{ name: regex }, { phone: regex }, { email: regex }];
    }
    const [users, total] = await Promise.all([
      User.find(userFilter).select('name phone email phoneVerifiedAt lastLoginAt').sort({ name: 1 }).skip((q.page - 1) * q.limit).limit(q.limit).lean(),
      User.countDocuments(userFilter),
    ]);

    const ids = users.map((user) => user._id);
    const [memberships, children] = await Promise.all([
      Membership.find({ institutionId, role: 'guardian', userId: { $in: ids } }).select('userId status').lean(),
      Student.find({ institutionId, 'guardians.userId': { $in: ids } })
        .select('name enrollmentNo batchId guardians status')
        .populate('batchId', 'name')
        .lean(),
    ]);
    const statusMap = new Map(memberships.map((membership) => [String(membership.userId), membership.status]));

    ok(
      res,
      users.map((user) => ({
        userId: user._id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        status: statusMap.get(String(user._id)) ?? 'suspended',
        phoneVerified: Boolean(user.phoneVerifiedAt),
        lastLoginAt: user.lastLoginAt ?? null,
        children: children
          .filter((student) => student.guardians.some((guardian) => String(guardian.userId) === String(user._id)))
          .map((student) => ({
            _id: student._id,
            name: student.name,
            enrollmentNo: student.enrollmentNo,
            batch: student.batchId,
            status: student.status,
            relation: student.guardians.find((guardian) => String(guardian.userId) === String(user._id))?.relation,
          })),
      })),
      pageMeta(q.page, q.limit, total),
    );
  },
);

/** Block or allow a parent's app access in this institution. */
guardiansRouter.post(
  '/:userId/:action',
  requireRole(...MANAGEMENT),
  validate({ params: z.object({ userId: objectId, action: z.enum(['block', 'unblock']) }) }),
  async (req, res) => {
    const { institutionId } = tenant(req);
    const { userId, action } = params<{ userId: string; action: 'block' | 'unblock' }>(req);
    const membership = await Membership.findOneAndUpdate(
      { institutionId, userId, role: 'guardian' },
      { status: action === 'block' ? 'suspended' : 'active' },
      { new: true },
    );
    if (!membership) throw notFound('Parent');
    ok(res, { userId, status: membership.status }, undefined, action === 'block' ? 'Parent access blocked' : 'Parent access restored');
  },
);

// ============================ Me ============================

export const meRouter = Router();

/** Profile for the active role: staff profile, own student record, or children. */
meRouter.get('/profile', requireRole(...EMPLOYEES, ...LEARNERS), async (req, res) => {
  const ctx = tenant(req);
  if (ctx.role === 'student' || ctx.role === 'guardian') {
    const students = await Student.find({ _id: { $in: (await myStudents(ctx)).map((student) => student._id) } })
      .populate('batchId', 'name coordinatorId')
      .populate('programId', 'name')
      .lean();
    return ok(res, { role: ctx.role, students });
  }
  const staff = await Staff.findOne({ institutionId: ctx.institutionId, userId: ctx.userId }).populate('subjectIds', 'name').lean();
  return ok(res, { role: ctx.role, staff });
});

/** Guardian's children (or a student's own record) — the app's child switcher. */
meRouter.get('/children', requireRole(...LEARNERS), async (req, res) => {
  const ctx = tenant(req);
  const students = await Student.find({ _id: { $in: (await myStudents(ctx)).map((student) => student._id) } })
    .select('name enrollmentNo rollNo photoUrl batchId programId')
    .populate('batchId', 'name')
    .populate('programId', 'name')
    .lean();
  ok(res, students);
});
