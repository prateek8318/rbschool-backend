export declare enum UserRole {
    ADMIN = "admin",
    TEACHER = "teacher",
    PARENT = "parent"
}
export declare enum AttendanceStatus {
    PRESENT = "present",
    ABSENT = "absent",
    HOLIDAY = "holiday"
}
export interface IUser {
    id?: string;
    schoolId: string;
    role: UserRole;
    name?: string;
    email?: string;
    phone?: string;
    isActive?: boolean;
    createdAt?: Date | string;
    updatedAt?: Date | string;
}
export interface IStudent {
    id?: string;
    schoolId: string;
    name: string;
    dob: Date | string;
    gender: string;
    photoUrl?: string;
    classId?: string | null;
    rollNumber: string;
    admissionNumber: string;
    parentUserId?: string | null;
    isActive?: boolean;
    createdAt?: Date | string;
    updatedAt?: Date | string;
}
export interface ITeacher extends IUser {
    userId?: string;
    subjects?: string[];
    assignedClassIds?: string[];
    experienceYears?: number;
}
export interface IClass {
    id?: string;
    schoolId: string;
    name: string;
    section: string;
    teacherId?: string | null;
    academicYear: string;
    subjects: string[];
    studentCount?: number;
}
export interface IAttendance {
    id?: string;
    schoolId: string;
    classId: string;
    studentId: string;
    date: Date | string;
    status: AttendanceStatus;
    markedBy: string;
    createdAt?: Date | string;
}
export interface IExam {
    id?: string;
    schoolId: string;
    classIds: string[];
    name: string;
    type: string;
    subjects: string[];
    startDate: Date | string;
    endDate: Date | string;
    maxMarks: number;
    status: string;
}
export interface IMarks {
    id?: string;
    schoolId: string;
    examId: string;
    studentId: string;
    classId: string;
    subject: string;
    marksObtained: number;
    maxMarks: number;
    grade: string;
    rank?: number;
    enteredBy: string;
}
export interface IFeeInstallment {
    quarter: string;
    amount: number;
    dueDate: Date | string;
    paidDate?: Date | string | null;
    status: "pending" | "paid" | "partial" | "overdue";
    paymentMode?: string;
    transactionId?: string;
}
export interface IFee {
    id?: string;
    schoolId: string;
    studentId: string;
    academicYear: string;
    totalAmount: number;
    paidAmount: number;
    pendingAmount: number;
    installments: IFeeInstallment[];
}
export interface IAnnouncement {
    id?: string;
    schoolId: string;
    title: string;
    message: string;
    targetRoles: UserRole[];
    createdBy: string;
    deliveredCount?: number;
    createdAt?: Date | string;
}
export interface ISchool {
    id?: string;
    name: string;
    address: string;
    board: string;
    phone: string;
    email: string;
    logoUrl?: string;
    academicYear: string;
    settings: {
        pushNotifications: boolean;
        smsAlerts: boolean;
        autoFeeReminders: boolean;
    };
    createdAt?: Date | string;
    updatedAt?: Date | string;
}
export interface JwtPayloadShape {
    userId: string;
    schoolId: string;
    role: UserRole;
}
