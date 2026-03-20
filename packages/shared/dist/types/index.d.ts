export type UserRole = 'admin' | 'teacher' | 'parent';
export type AttendanceStatus = 'present' | 'absent' | 'holiday' | 'half_day';
export type FeeStatus = 'paid' | 'pending' | 'overdue';
export type ExamType = 'unit' | 'midterm' | 'final';
export type ExamStatus = 'upcoming' | 'ongoing' | 'completed';
export type PaymentMode = 'cash' | 'online' | 'cheque';
export interface IPagination {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}
export interface IApiResponse<T> {
    success: boolean;
    message: string;
    data: T;
    meta?: IPagination;
}
export interface ITokenPayload {
    userId: string;
    schoolId: string;
    role: UserRole;
    iat: number;
    exp: number;
}
