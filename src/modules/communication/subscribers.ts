import { Types } from 'mongoose';
import { events } from '../../core/events';
import { getInstitutionSettings } from '../institutions/institution.service';
import { Student } from '../people/people.models';
import { notify } from './notify';

/** Guardians (and the student's own login, if any) for a set of students. */
const familyUserIds = async (filter: Record<string, unknown>) => {
  const students = await Student.find({ ...filter, status: 'active' }).select('userId guardians.userId name').lean();
  const ids: Types.ObjectId[] = [];
  for (const student of students) {
    if (student.userId) ids.push(student.userId);
    for (const guardian of student.guardians) ids.push(guardian.userId);
  }
  return { ids, students };
};

export const registerSubscribers = () => {
  events.on('attendance.marked', async ({ institutionId, date, absentStudentIds }) => {
    const institution = await getInstitutionSettings(institutionId);
    if (!institution.settings.notifyGuardiansOnAbsence) return;
    const students = await Student.find({ _id: { $in: absentStudentIds }, institutionId })
      .select('name userId guardians.userId')
      .lean();
    for (const student of students) {
      await notify({
        institutionId,
        userIds: [...student.guardians.map((guardian) => guardian.userId), ...(student.userId ? [student.userId] : [])],
        title: 'Absent today',
        body: `${student.name} was marked absent on ${date}.`,
        category: 'attendance',
        data: { type: 'attendance', studentId: String(student._id), date },
      });
    }
  });

  events.on('exam.scheduled', async ({ institutionId, examId, examName, batchIds, startDate }) => {
    const { ids } = await familyUserIds({ institutionId, batchId: { $in: batchIds } });
    await notify({
      institutionId,
      userIds: ids,
      title: 'Exam scheduled',
      body: `${examName} starts on ${startDate}.`,
      category: 'exam',
      data: { type: 'exam', id: examId },
    });
  });

  events.on('exam.results_published', async ({ institutionId, examId, examName, batchIds }) => {
    const { ids } = await familyUserIds({ institutionId, batchId: { $in: batchIds } });
    await notify({
      institutionId,
      userIds: ids,
      title: 'Results published',
      body: `Results of ${examName} are now available.`,
      category: 'exam',
      data: { type: 'exam_result', id: examId },
    });
  });

  events.on('fee.payment_recorded', async ({ institutionId, studentId, invoiceId, amount }) => {
    const institution = await getInstitutionSettings(institutionId);
    const { ids, students } = await familyUserIds({ institutionId, _id: studentId });
    await notify({
      institutionId,
      userIds: ids,
      title: 'Payment received',
      body: `${institution.currency} ${amount} received for ${students[0]?.name ?? 'your ward'}. Thank you!`,
      category: 'fee',
      data: { type: 'invoice', id: invoiceId },
    });
  });

  events.on('fee.overdue', async ({ institutionId, studentIds }) => {
    const students = await Student.find({ _id: { $in: studentIds }, institutionId }).select('name userId guardians.userId').lean();
    for (const student of students) {
      await notify({
        institutionId,
        userIds: [...student.guardians.map((guardian) => guardian.userId), ...(student.userId ? [student.userId] : [])],
        title: 'Fee overdue',
        body: `A fee installment for ${student.name} is overdue. Please pay at the earliest.`,
        category: 'fee',
        data: { type: 'student_fees', studentId: String(student._id) },
      });
    }
  });

  events.on('leave.reviewed', async ({ institutionId, userId, status, fromDate, toDate }) => {
    await notify({
      institutionId,
      userIds: [userId],
      title: `Leave ${status}`,
      body: `Your leave request for ${fromDate}${fromDate === toDate ? '' : ` to ${toDate}`} was ${status}.`,
      category: 'leave',
    });
  });

  events.on('otp.requested', ({ phone, code }) => {
    // Plug an SMS provider (MSG91, Twilio...) in here.
    console.log(`[sms] OTP for ${phone}: ${code}`);
  });
};
