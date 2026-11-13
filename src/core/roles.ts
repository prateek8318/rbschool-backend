/**
 * Roles a person can hold inside an institution (via a Membership).
 * One user account can hold different roles in different institutions,
 * e.g. a teacher at one school who is also a parent at another.
 */
export const ROLES = ['owner', 'admin', 'accountant', 'teacher', 'staff', 'student', 'guardian'] as const;
export type Role = (typeof ROLES)[number];

/** Can manage everything inside the institution. */
export const MANAGEMENT: Role[] = ['owner', 'admin'];
/** Can see and record fee payments. */
export const FINANCE: Role[] = ['owner', 'admin', 'accountant'];
/** Teaching faculty plus management. */
export const ACADEMIC_STAFF: Role[] = ['owner', 'admin', 'teacher'];
/** Every employee of the institution. */
export const EMPLOYEES: Role[] = ['owner', 'admin', 'accountant', 'teacher', 'staff'];
/** Learners and their families. */
export const LEARNERS: Role[] = ['student', 'guardian'];
export const EVERYONE: Role[] = [...ROLES];

export const isManagement = (role: Role) => MANAGEMENT.includes(role);
export const isEmployee = (role: Role) => EMPLOYEES.includes(role);
