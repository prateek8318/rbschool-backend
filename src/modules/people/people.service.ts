import { Types } from 'mongoose';
import { TenantContext } from '../../core/auth';
import { badRequest, conflict, notFound } from '../../core/errors';
import { Role } from '../../core/roles';
import { assertOwned } from '../../core/tenancy';
import { Batch, Program } from '../academics/academics.models';
import { ensureMembership, Membership } from '../auth/membership.model';
import { findOrCreateUser } from '../auth/user.service';
import { getInstitutionSettings } from '../institutions/institution.service';
import { Staff, Student } from './people.models';

/** Login details to hand over to a newly created person (shown once). */
export interface IssuedCredential {
  name: string;
  role: Role;
  login: string;
  tempPassword: string;
}

export interface GuardianInput {
  name: string;
  phone: string;
  email?: string;
  relation?: string;
  isPrimary?: boolean;
}

export interface StudentInput {
  name: string;
  enrollmentNo: string;
  rollNo?: string;
  dob?: string;
  gender?: 'male' | 'female' | 'other';
  bloodGroup?: string;
  photoUrl?: string;
  email?: string;
  phone?: string;
  address?: string;
  programId?: string;
  batchId?: string;
  admissionDate?: string;
  guardians?: GuardianInput[];
  createLogin?: boolean;
  customFields?: Record<string, string>;
}

/** Resolves programId from the batch so the two never disagree. */
export const resolvePlacement = async (institutionId: string, programId?: string, batchId?: string) => {
  if (batchId) {
    const batch = await Batch.findOne({ _id: batchId, institutionId }).select('programId').lean();
    if (!batch) throw badRequest('Batch does not exist in this institution');
    return { programId: batch.programId, batchId: new Types.ObjectId(batchId) };
  }
  if (programId) await assertOwned(Program, institutionId, [programId], 'programs');
  return { programId: programId ? new Types.ObjectId(programId) : undefined, batchId: undefined };
};

export const linkGuardian = async (institutionId: string, input: GuardianInput) => {
  const { user, tempPassword } = await findOrCreateUser({ name: input.name, phone: input.phone, email: input.email });
  await ensureMembership(user._id, institutionId, 'guardian');
  const credential: IssuedCredential | undefined = tempPassword
    ? { name: user.name, role: 'guardian', login: input.phone, tempPassword }
    : undefined;
  return {
    guardian: {
      userId: user._id,
      name: input.name,
      phone: input.phone,
      relation: input.relation ?? 'guardian',
      isPrimary: Boolean(input.isPrimary),
    },
    credential,
  };
};

/** Gives the student their own login (phone/email if present, else a username). */
export const createStudentLogin = async (
  institutionId: string,
  student: { _id: Types.ObjectId; name: string; enrollmentNo: string; phone?: string | null; email?: string | null },
) => {
  const institution = await getInstitutionSettings(institutionId);
  const username = !student.phone && !student.email ? `${institution.code}.${student.enrollmentNo}`.toLowerCase() : undefined;
  const { user, tempPassword } = await findOrCreateUser({
    name: student.name,
    phone: student.phone,
    email: student.email,
    username,
  });
  await ensureMembership(user._id, institutionId, 'student');
  await Student.updateOne({ _id: student._id }, { userId: user._id });
  const credential: IssuedCredential | undefined = tempPassword
    ? { name: student.name, role: 'student', login: username ?? student.phone ?? student.email ?? '', tempPassword }
    : undefined;
  return { userId: user._id, credential };
};

export const createStudent = async (ctx: TenantContext, input: StudentInput) => {
  const { institutionId } = ctx;
  if (await Student.exists({ institutionId, enrollmentNo: input.enrollmentNo })) {
    throw conflict(`Enrollment number ${input.enrollmentNo} is already used`);
  }
  const placement = await resolvePlacement(institutionId, input.programId, input.batchId);
  const credentials: IssuedCredential[] = [];

  const guardians = [];
  for (const [index, guardianInput] of (input.guardians ?? []).entries()) {
    const { guardian, credential } = await linkGuardian(institutionId, {
      ...guardianInput,
      isPrimary: guardianInput.isPrimary ?? index === 0,
    });
    guardians.push(guardian);
    if (credential) credentials.push(credential);
  }

  const { guardians: _ignored, createLogin, ...fields } = input;
  const student = await Student.create({ ...fields, ...placement, institutionId, guardians });

  if (createLogin) {
    const { credential } = await createStudentLogin(institutionId, student);
    if (credential) credentials.push(credential);
  }

  return { student: await Student.findById(student._id).lean(), credentials };
};

// ---------------- Staff ----------------

export const STAFF_ROLES = ['admin', 'accountant', 'teacher', 'staff'] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export interface StaffInput {
  name: string;
  phone: string;
  email?: string;
  role: StaffRole;
  employeeCode?: string;
  designation?: string;
  department?: string;
  subjectIds?: string[];
  qualification?: string;
  experienceYears?: number;
  joiningDate?: string;
  photoUrl?: string;
}

export const createStaff = async (ctx: TenantContext, input: StaffInput) => {
  const { institutionId } = ctx;
  if (input.employeeCode && (await Staff.exists({ institutionId, employeeCode: input.employeeCode }))) {
    throw conflict(`Employee code ${input.employeeCode} is already used`);
  }

  const { user, tempPassword } = await findOrCreateUser({ name: input.name, phone: input.phone, email: input.email });
  if (await Staff.exists({ institutionId, userId: user._id })) {
    throw conflict('This person is already a staff member here. Edit their profile or roles instead.');
  }

  await ensureMembership(user._id, institutionId, input.role);
  const { role, ...profile } = input;
  const staff = await Staff.create({ ...profile, institutionId, userId: user._id });

  return {
    staff,
    role,
    credential: tempPassword ? ({ name: user.name, role, login: input.phone, tempPassword } satisfies IssuedCredential) : null,
  };
};

/** Suspends every employee role this person has in the institution. */
export const setStaffActive = async (institutionId: string, staffId: string, active: boolean) => {
  const staff = await Staff.findOne({ _id: staffId, institutionId });
  if (!staff) throw notFound('Staff member');
  staff.status = active ? 'active' : 'inactive';
  await staff.save();
  await Membership.updateMany(
    { institutionId, userId: staff.userId, role: { $in: STAFF_ROLES } },
    { status: active ? 'active' : 'suspended' },
  );
  return staff;
};

export const staffRolesFor = async (institutionId: string, userIds: Array<Types.ObjectId | string>) => {
  const memberships = await Membership.find({
    institutionId,
    userId: { $in: userIds },
    role: { $in: [...STAFF_ROLES, 'owner'] },
  })
    .select('userId role status')
    .lean();
  const map = new Map<string, Role[]>();
  for (const membership of memberships) {
    if (membership.status !== 'active') continue;
    const key = String(membership.userId);
    map.set(key, [...(map.get(key) ?? []), membership.role]);
  }
  return map;
};
