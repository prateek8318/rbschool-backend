/**
 * Demo data: one school and one coaching institute with staff, students,
 * guardians, timetable, attendance, an exam with results and fees.
 *
 *   npm run seed            -> creates demo data (skips if it already exists)
 *   npm run seed -- --reset -> deletes the demo institutions first
 *   npm run seed -- --remove -> only deletes the demo data (keeps real institutions)
 *
 * Every demo account uses the password: Demo@1234
 */
import mongoose from 'mongoose';
import { connectDB, disconnectDB } from '../core/db';
import { TenantContext } from '../core/auth';
import { Batch, Program, Subject, TimetableSlot } from '../modules/academics/academics.models';
import { AttendanceSheet } from '../modules/attendance/attendance.models';
import { ensureMembership } from '../modules/auth/membership.model';
import { hashPassword, User } from '../modules/auth/user.model';
import { Exam, ExamResult } from '../modules/exams/exams.models';
import { computeResult, assignRanks } from '../modules/exams/grading';
import { FeeStructure, Invoice, Payment } from '../modules/fees/fees.models';
import { nextSequence } from '../core/counter';
import { recalculateInvoice } from '../modules/fees/fees.service';
import { AcademicSession, defaultSessionWindow } from '../modules/institutions/academic-session.model';
import { DEFAULT_GRADING_SCALE, DEFAULT_TERMINOLOGY, defaultAttendanceMode, Institution, InstitutionType } from '../modules/institutions/institution.model';
import { Student } from '../modules/people/people.models';
import { createStaff, createStudent } from '../modules/people/people.service';

const PASSWORD = 'Demo@1234';
const DEMO_CODES = ['demo-school', 'demo-coaching'];

const firstNames = ['Aarav', 'Vivaan', 'Aditya', 'Ananya', 'Diya', 'Ishaan', 'Kavya', 'Rohan', 'Saanvi', 'Arjun', 'Meera', 'Kabir', 'Riya', 'Aryan', 'Navya', 'Dev'];
const lastNames = ['Sharma', 'Verma', 'Gupta', 'Singh', 'Patel', 'Yadav', 'Mishra', 'Joshi'];

const setPassword = async (phones: string[]) => {
  await User.updateMany({ phone: { $in: phones } }, { passwordHash: await hashPassword(PASSWORD), mustChangePassword: false });
};

const pastWeekdays = (count: number) => {
  const dates: string[] = [];
  const day = new Date();
  while (dates.length < count) {
    day.setDate(day.getDate() - 1);
    if (day.getDay() !== 0) dates.push(day.toISOString().slice(0, 10));
  }
  return dates.reverse();
};

const createInstitution = async (code: string, name: string, type: InstitutionType, ownerPhone: string) => {
  const owner = await User.create({ name: `${name} Owner`, phone: ownerPhone, passwordHash: await hashPassword(PASSWORD) });
  const institution = await Institution.create({
    name,
    code,
    type,
    affiliation: type === 'school' ? 'CBSE' : 'Self',
    address: { city: 'Lucknow', state: 'Uttar Pradesh' },
    settings: { terminology: DEFAULT_TERMINOLOGY[type], attendanceMode: defaultAttendanceMode(type), gradingScale: DEFAULT_GRADING_SCALE },
    createdBy: owner._id,
  });
  const membership = await ensureMembership(owner._id, institution._id, 'owner');
  const session = await AcademicSession.create({ institutionId: institution._id, ...defaultSessionWindow(4), isCurrent: true });
  const ctx: TenantContext = { userId: String(owner._id), institutionId: String(institution._id), role: 'owner', membershipId: String(membership._id) };
  return { institution, session, ctx };
};

const seedSchool = async () => {
  const { institution, session, ctx } = await createInstitution('demo-school', 'Demo Public School', 'school', '9000000001');
  const institutionId = institution._id;

  const subjects = await Subject.insertMany(
    ['English', 'Hindi', 'Mathematics', 'Science', 'Social Science'].map((subject) => ({ institutionId, name: subject })),
  );

  const teachers: Array<{ userId: unknown; phone?: string | null }> = [];
  for (const [index, subject] of subjects.entries()) {
    const { staff } = await createStaff(ctx, {
      name: `${['Neha', 'Rakesh', 'Sunita', 'Amit', 'Pooja'][index]} ${lastNames[index]}`,
      phone: `90000001${String(index).padStart(2, '0')}`,
      role: 'teacher',
      designation: 'TGT',
      department: subject.name,
      subjectIds: [String(subject._id)],
      employeeCode: `EMP${100 + index}`,
    });
    teachers.push(staff);
  }
  await createStaff(ctx, { name: 'Ramesh Accounts', phone: '9000000190', role: 'accountant', designation: 'Accountant' });

  const programs = await Program.insertMany(
    [9, 10].map((level) => ({ institutionId, name: `Class ${level}`, level })),
  );

  const batches = [];
  for (const program of programs) {
    for (const section of ['A', 'B']) {
      batches.push(
        await Batch.create({
          institutionId,
          sessionId: session._id,
          programId: program._id,
          name: `${program.name.replace('Class ', '')}-${section}`,
          coordinatorId: teachers[batches.length % teachers.length].userId,
          subjects: subjects.map((subject, index) => ({ subjectId: subject._id, teacherId: teachers[index].userId })),
        }),
      );
    }
  }

  // Timetable: 5 periods Mon-Sat, rotated per batch so teachers never clash.
  const times = [['08:00', '08:45'], ['08:45', '09:30'], ['09:45', '10:30'], ['10:30', '11:15'], ['11:30', '12:15']];
  const slots = [];
  for (const [batchIndex, batch] of batches.entries()) {
    for (let day = 1; day <= 6; day += 1) {
      for (const [period, [startTime, endTime]] of times.entries()) {
        const subjectIndex = (period + batchIndex + day) % subjects.length;
        slots.push({ institutionId, batchId: batch._id, dayOfWeek: day, startTime, endTime, subjectId: subjects[subjectIndex]._id, teacherId: teachers[subjectIndex].userId });
      }
    }
  }
  // Remove accidental teacher clashes (same teacher, day, time in two batches).
  const seen = new Set<string>();
  await TimetableSlot.insertMany(
    slots.filter((slot) => {
      const key = `${slot.teacherId}|${slot.dayOfWeek}|${slot.startTime}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }),
  );

  // Students with guardians. Guardian phone 98xxxxxxxx; first student also gets a login.
  let counter = 0;
  const guardianPhones: string[] = [];
  for (const batch of batches) {
    for (let index = 0; index < 8; index += 1) {
      counter += 1;
      const first = firstNames[counter % firstNames.length];
      const last = lastNames[counter % lastNames.length];
      const guardianPhone = `98${String(counter).padStart(8, '0')}`;
      guardianPhones.push(guardianPhone);
      await createStudent(ctx, {
        name: `${first} ${last}`,
        enrollmentNo: `ADM${2026}${String(counter).padStart(3, '0')}`,
        rollNo: String(index + 1),
        gender: counter % 2 ? 'male' : 'female',
        dob: `${2010 + (counter % 3)}-0${(counter % 9) + 1}-15`,
        batchId: String(batch._id),
        guardians: [{ name: `Mr. ${last}`, phone: guardianPhone, relation: 'father' }],
        createLogin: counter === 1,
      });
    }
  }

  // Attendance for the last 15 working days.
  const students = await Student.find({ institutionId }).lean();
  const dates = pastWeekdays(15);
  const sheets = [];
  for (const batch of batches) {
    const batchStudents = students.filter((student) => String(student.batchId) === String(batch._id));
    for (const date of dates) {
      const entries = batchStudents.map((student, index) => ({
        studentId: student._id,
        status: (index + date.charCodeAt(9)) % 11 === 0 ? 'absent' : (index + date.charCodeAt(8)) % 17 === 0 ? 'late' : 'present',
      }));
      const counts = { present: 0, absent: 0, late: 0, leave: 0, excused: 0 };
      for (const entry of entries) counts[entry.status as 'present'] += 1;
      sheets.push({ institutionId, batchId: batch._id, date, period: 'day', takenBy: batch.coordinatorId, entries, counts });
    }
  }
  await AttendanceSheet.insertMany(sheets);

  // A published unit test.
  const examDate = dates[5];
  const exam = await Exam.create({
    institutionId,
    sessionId: session._id,
    name: 'Unit Test 1',
    type: 'unit_test',
    batchIds: batches.map((batch) => batch._id),
    papers: subjects.map((subject) => ({ subjectId: subject._id, date: examDate, maxMarks: 50 })),
    status: 'published',
    resultsPublishedAt: new Date(),
    createdBy: ctx.userId,
  });
  const settings = { gradingScale: DEFAULT_GRADING_SCALE, passPercentage: 33 };
  for (const batch of batches) {
    const results = students
      .filter((student) => String(student.batchId) === String(batch._id))
      .map((student, index) => {
        const scores = subjects.map((subject, s) => ({ subjectId: subject._id, marks: 15 + ((index * 7 + s * 5) % 36), isAbsent: false, grade: undefined as string | undefined }));
        const computed = computeResult(exam.papers, scores, settings);
        return { institutionId, examId: exam._id, studentId: student._id, batchId: batch._id, scores, ...computed, rank: 0 };
      });
    for (const { row, rank } of assignRanks(results)) row.rank = rank;
    await ExamResult.insertMany(results);
  }

  // Upcoming exam
  const future = new Date();
  future.setDate(future.getDate() + 10);
  await Exam.create({
    institutionId,
    sessionId: session._id,
    name: 'Half Yearly Examination',
    type: 'midterm',
    batchIds: batches.map((batch) => batch._id),
    papers: subjects.map((subject, index) => ({
      subjectId: subject._id,
      date: new Date(future.getTime() + index * 86_400_000).toISOString().slice(0, 10),
      startTime: '09:00',
      maxMarks: 80,
    })),
    createdBy: ctx.userId,
  });

  // Fees: annual structure with 4 installments, some paid.
  const window = defaultSessionWindow(4);
  const year = Number(window.startDate.slice(0, 4));
  const installments = [
    { label: 'Quarter 1', dueDate: `${year}-04-10`, amount: 9000 },
    { label: 'Quarter 2', dueDate: `${year}-07-10`, amount: 9000 },
    { label: 'Quarter 3', dueDate: `${year}-10-10`, amount: 9000 },
    { label: 'Quarter 4', dueDate: `${year + 1}-01-10`, amount: 9000 },
  ];
  const structure = await FeeStructure.create({
    institutionId,
    sessionId: session._id,
    name: `Annual Fee ${session.name}`,
    programIds: programs.map((program) => program._id),
    components: [{ name: 'Tuition', amount: 30000 }, { name: 'Activities', amount: 3600 }, { name: 'Lab & Library', amount: 2400 }],
    installments,
    totalAmount: 36000,
  });
  // Every paid amount is backed by a real Payment (with a receipt), paid on
  // the installment's due date, so dashboards and reports always agree.
  const today = new Date().toISOString().slice(0, 10);
  const modes = ['cash', 'upi', 'bank_transfer'] as const;
  for (const [index, student] of students.entries()) {
    const invoice = new Invoice({
      institutionId,
      sessionId: session._id,
      studentId: student._id,
      structureId: structure._id,
      title: structure.name,
      items: structure.components,
      installments: installments.map((item) => ({ ...item, paidAmount: 0 })),
      totalAmount: 36000,
      balance: 36000,
      paidAmount: 0,
    });
    const installmentsPaid = index % 4 === 0 ? 0 : index % 4 === 1 ? 1 : 2;
    for (const installment of installments.slice(0, installmentsPaid)) {
      if (installment.dueDate > today) break;
      const sequence = await nextSequence(`receipt:${institutionId}:${installment.dueDate.slice(0, 4)}`);
      await Payment.create({
        institutionId,
        invoiceId: invoice._id,
        studentId: student._id,
        amount: installment.amount,
        mode: modes[index % modes.length],
        paidAt: installment.dueDate,
        receiptNo: `DEMO-S-${installment.dueDate.slice(0, 4)}-${String(sequence).padStart(5, '0')}`,
        receivedBy: ctx.userId,
      });
      invoice.paidAmount += installment.amount;
    }
    await recalculateInvoice(invoice, today).save();
  }

  await setPassword(['9000000001', ...teachers.map((teacher) => teacher.phone!), '9000000190', ...guardianPhones]);
  const studentLogin = await User.findOne({ username: /^demo-school\./ }).lean();
  if (studentLogin) await User.updateOne({ _id: studentLogin._id }, { passwordHash: await hashPassword(PASSWORD), mustChangePassword: false });

  return {
    owner: '9000000001',
    teacher: teachers[0].phone,
    accountant: '9000000190',
    guardian: guardianPhones[0],
    student: studentLogin?.username,
  };
};

const seedCoaching = async () => {
  const { institution, session, ctx } = await createInstitution('demo-coaching', 'Demo Coaching Classes', 'coaching', '9000000002');
  const institutionId = institution._id;
  const subjects = await Subject.insertMany(['Physics', 'Chemistry', 'Mathematics'].map((name) => ({ institutionId, name })));
  const teachers: Array<{ userId: unknown; phone?: string | null }> = [];
  for (const [index, subject] of subjects.entries()) {
    const { staff } = await createStaff(ctx, {
      name: `${['Vikas', 'Shalini', 'Manoj'][index]} Sir`,
      phone: `90000002${String(index).padStart(2, '0')}`,
      role: 'teacher',
      subjectIds: [String(subject._id)],
    });
    teachers.push(staff);
  }
  const program = await Program.create({ institutionId, name: 'JEE Main + Advanced 2027', duration: '2 years' });
  const batch = await Batch.create({
    institutionId,
    sessionId: session._id,
    programId: program._id,
    name: 'Morning Batch',
    coordinatorId: teachers[0].userId,
    subjects: subjects.map((subject, index) => ({ subjectId: subject._id, teacherId: teachers[index].userId })),
  });
  const guardianPhones: string[] = [];
  for (let index = 0; index < 6; index += 1) {
    const phone = `97${String(index + 1).padStart(8, '0')}`;
    guardianPhones.push(phone);
    await createStudent(ctx, {
      name: `${firstNames[index + 3]} ${lastNames[index + 1]}`,
      enrollmentNo: `JEE27-${String(index + 1).padStart(3, '0')}`,
      batchId: String(batch._id),
      phone: `96${String(index + 1).padStart(8, '0')}`,
      guardians: [{ name: `Parent of ${firstNames[index + 3]}`, phone, relation: 'mother' }],
      createLogin: true,
    });
  }
  // Same person as a school guardian: proves one account can belong to two institutions.
  const sharedGuardian = '9800000001';
  await createStudent(ctx, {
    name: 'Aarav Verma (Coaching)',
    enrollmentNo: 'JEE27-100',
    batchId: String(batch._id),
    guardians: [{ name: 'Mr. Verma', phone: sharedGuardian, relation: 'father' }],
  });

  await setPassword(['9000000002', ...teachers.map((teacher) => teacher.phone!), ...guardianPhones, ...Array.from({ length: 6 }, (_, i) => `96${String(i + 1).padStart(8, '0')}`)]);
  return { owner: '9000000002', teacher: teachers[0].phone, guardian: guardianPhones[0], student: '9600000001', sharedGuardian };
};

const reset = async () => {
  const institutions = await Institution.find({ code: { $in: DEMO_CODES } }).select('_id').lean();
  const ids = institutions.map((institution) => institution._id);
  if (!ids.length) return;
  const collections = await mongoose.connection.db!.collections();
  for (const collection of collections) {
    if (['institutions', 'users', 'counters', 'sessions', 'otps', 'devicetokens'].includes(collection.collectionName)) continue;
    await collection.deleteMany({ institutionId: { $in: ids } });
  }
  await Institution.deleteMany({ _id: { $in: ids } });
  // Remove demo users that now belong nowhere.
  const demoUsers = await User.find({ $or: [{ phone: /^9[0-8]\d{8}$/ }, { username: /^demo-/ }], isPlatformAdmin: { $ne: true } }).select('_id').lean();
  const stillMember = new Set(
    (await mongoose.connection.db!.collection('memberships').distinct('userId', { userId: { $in: demoUsers.map((u) => u._id) } })).map(String),
  );
  await User.deleteMany({ _id: { $in: demoUsers.filter((user) => !stillMember.has(String(user._id))).map((user) => user._id) } });
  console.log('Demo data removed.');
};

const main = async () => {
  await connectDB();
  await Promise.all(mongoose.modelNames().map((name) => mongoose.model(name).syncIndexes()));
  if (process.argv.includes('--reset') || process.argv.includes('--remove')) await reset();
  if (process.argv.includes('--remove')) return;

  if (await Institution.exists({ code: { $in: DEMO_CODES } })) {
    console.log('Demo data already exists. Run `npm run seed -- --reset` to recreate it.');
    return;
  }
  const school = await seedSchool();
  const coaching = await seedCoaching();
  console.log('\nDemo data ready. Password for every account:', PASSWORD);
  console.table({
    'School owner/admin': { login: school.owner },
    'School teacher': { login: school.teacher },
    'School accountant': { login: school.accountant },
    'School parent': { login: school.guardian },
    'School student': { login: school.student },
    'Coaching owner': { login: coaching.owner },
    'Coaching teacher': { login: coaching.teacher },
    'Coaching parent': { login: coaching.guardian },
    'Coaching student': { login: coaching.student },
    'Parent in BOTH institutions': { login: coaching.sharedGuardian },
  });
};

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => disconnectDB());

