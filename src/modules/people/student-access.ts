import { Types } from 'mongoose';
import { TenantContext } from '../../core/auth';
import { forbidden, notFound } from '../../core/errors';
import { isEmployee } from '../../core/roles';
import { Student, StudentAttrs } from './people.models';

/**
 * Who may see a student's data:
 * - any employee of the institution
 * - the student themself
 * - the student's linked guardians
 */
export const assertCanViewStudent = async (ctx: TenantContext, studentId: string): Promise<StudentAttrs> => {
  const student = await Student.findOne({ _id: studentId, institutionId: ctx.institutionId }).lean<StudentAttrs>();
  if (!student) throw notFound('Student');

  if (isEmployee(ctx.role)) return student;
  if (ctx.role === 'student' && String(student.userId ?? '') === ctx.userId) return student;
  if (ctx.role === 'guardian' && student.guardians.some((guardian) => String(guardian.userId) === ctx.userId)) {
    return student;
  }
  throw forbidden('You cannot view this student');
};

/** Student records the current learner/guardian is allowed to see. */
export const myStudents = async (ctx: TenantContext) => {
  if (ctx.role === 'student') {
    return Student.find({ institutionId: ctx.institutionId, userId: ctx.userId }).lean<StudentAttrs[]>();
  }
  if (ctx.role === 'guardian') {
    return Student.find({ institutionId: ctx.institutionId, 'guardians.userId': ctx.userId, status: 'active' }).lean<
      StudentAttrs[]
    >();
  }
  return [];
};

export const studentNameMap = async (institutionId: string, ids: Array<string | Types.ObjectId>) => {
  const students = await Student.find({ institutionId, _id: { $in: ids } })
    .select('name enrollmentNo rollNo batchId photoUrl')
    .lean();
  return new Map(students.map((student) => [String(student._id), student]));
};
