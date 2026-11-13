# RB School Backend (v2)

One backend for **schools, colleges, universities, coaching institutes and training centres**.
It is a **modular monolith**: one Node.js app and one MongoDB database, split into clear modules.
There is nothing to keep in sync between services and no internal HTTP calls.

## Quick start

```bash
npm install
npm run seed        # demo school + demo coaching institute (password: Demo@1234)
npm run dev         # http://localhost:8000/api/v1
```

| Script | What it does |
| --- | --- |
| `npm run dev` | Start with auto-reload |
| `npm run build` / `npm start` | Compile to `dist/` and run |
| `npm run typecheck` | TypeScript check |
| `npm run seed` | Demo data (`npm run seed -- --reset` recreates it) |
| `npm run create-super-admin -- <phone> <password> "<name>"` | Platform owner account |

Configuration lives in `.env` (see `src/config/env.ts` for every variable).

## Who can log in (invite-only)

| Who | How they get access | How they log in |
| --- | --- | --- |
| **Super admin** (you) | Created on startup from `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD` in `.env` | Email + password. Can open any institution as its owner |
| **Institution admin** | Super admin creates the institution and its admin (`POST /platform/institutions`) | Phone OTP or password |
| **Teachers / staff** | Institution admin adds them (`POST /staff`) | Phone OTP (or the temporary password) |
| **Parents** | Created when the admin adds a student with a guardian | Phone OTP |
| **Students** | Optional: the admin turns on "student login" | Phone/username + OTP or password |

- OTP is sent **only** to numbers that an admin has added and not blocked. Unknown numbers get a "contact your admin" error.
- A person's phone counts as **verified** after their first OTP login. The admin panel shows this.
- The admin can block or unblock any teacher (`/staff/:id/deactivate`) or parent (`/guardians/:userId/block`). Blocking takes effect on the very next request.
- Public self-registration is off (`ALLOW_PUBLIC_REGISTRATION=false`).

## How the data model fits every institution

| Concept | School | College | Coaching |
| --- | --- | --- | --- |
| **Institution** (`type`) | school | college / university | coaching |
| **AcademicSession** | 2026-27 | 2026-27 | Session 2026 |
| **Program** | Class 10 | B.Tech CSE | JEE 2027 |
| **Batch** | 10-A | Sem 3 – Div B | Morning Batch |
| **Subject** | Science | Data Structures | Physics |
| Attendance | daily | per period (lecture) | daily |

Each institution stores **terminology** (`settings.terminology`), so the apps show "Class/Section",
"Course/Class" or "Course/Batch" without any code changes. The grading scale, pass %,
working days and attendance mode can also be configured per institution.

### People and roles

- **User**: one login per person (phone, email or username), shared across institutions.
- **Membership**: what that person is inside an institution: `owner`, `admin`, `accountant`, `teacher`, `staff`, `student` or `guardian`.
  A parent at one school can be a teacher at another, and switches with `POST /auth/switch`.
- **Student**: the academic record. It links to guardians, and optionally to the student's own login.
- **Staff**: the employment profile of teachers, accountants and admins.

## Project structure

```
src/
  server.ts, app.ts, routes.ts      # bootstrap, middleware, route table
  config/env.ts                     # validated environment
  core/                             # shared: auth, roles, tenancy, validation, events, errors
  modules/
    auth/          users, memberships, sessions, OTP, login/refresh/switch
    institutions/  institution profile, settings, academic sessions
    academics/     programs, subjects, batches, timetable
    people/        students, guardians, staff, /me
    attendance/    registers, reports, holidays
    exams/         exams, marks entry, grading, results, report cards
    fees/          fee structures, invoices, payments, receipts, overdue job
    communication/ announcements, notifications, push tokens, event handlers
    leaves/        staff and student leave requests
    dashboard/     one role-aware home-screen endpoint
    platform/      super-admin view of all institutions
  scripts/         seed, create-super-admin
```

**Module rules**
- Every query is scoped by `institutionId` taken from the token, never from the request.
- `core/tenancy.ts` checks that every referenced id belongs to the same institution.
- Modules talk through **domain events** (`core/events.ts`): for example, attendance emits `attendance.marked` and communication notifies the parents.
  If a module ever becomes its own service, only the event bus needs to change.

## API conventions

- Base URL: `/api/v1`. Send `Authorization: Bearer <accessToken>` on every request except login, register and refresh.
- Success: `{ success: true, data, meta? }`. Paginated lists use `meta = { page, limit, total, totalPages }`.
- Error: `{ success: false, error: { code, message, details? } }`.
- Dates are `YYYY-MM-DD` strings, and times are `HH:mm`, in the institution's timezone.
- Access tokens last 15 minutes. Refresh tokens rotate on every `/auth/refresh` call; store the new one each time.

### App flow

1. `POST /auth/login` `{ identifier, password }` (or `/auth/otp/request` and `/auth/otp/verify`).
2. If `requiresMembershipSelection` is true, show an institution/role picker, then call `POST /auth/switch` `{ membershipId }`.
3. `GET /institution` returns the name, logo and terminology for the UI.
4. `GET /dashboard` returns the home screen data for the active role.

### Endpoints

| Area | Endpoints |
| --- | --- |
| Auth | `POST /auth/register-institution`, `/auth/login`, `/auth/otp/request`, `/auth/otp/verify`, `/auth/refresh`, `/auth/switch`, `/auth/logout`; `GET/PATCH /auth/me`; `PUT /auth/password` |
| Institution | `GET/PATCH /institution`, `PATCH /institution/settings`, `GET/POST /institution/sessions`, `PATCH /institution/sessions/:id`, `POST /institution/sessions/:id/activate` |
| Academics | `/academics/programs`, `/academics/subjects`, `/academics/batches` (+ `/:id`, `/:id/subjects`, `/:id/students`), `GET /academics/timetable`, `PUT /academics/timetable/batches/:id` |
| Students | `GET/POST /students`, `POST /students/bulk`, `GET /students/export`, `POST /students/promote`, `GET/PATCH /students/:id`, `POST /students/:id/guardians`, `DELETE /students/:id/guardians/:userId`, `POST /students/:id/login` |
| Staff | `GET/POST /staff`, `GET/PATCH /staff/:id`, `PUT /staff/:id/roles`, `POST /staff/:id/deactivate`, `POST /staff/:id/activate` |
| Me | `GET /me/profile`, `GET /me/children` |
| Attendance | `GET/PUT /attendance/sheet`, `GET /attendance/students/:id/summary`, `GET /attendance/students/:id/calendar`, `GET /attendance/report` (`format=csv`), `GET /attendance/low`, `GET /attendance/overview`, `/attendance/holidays` |
| Exams | `GET/POST /exams`, `GET/PATCH/DELETE /exams/:id`, `GET/PUT /exams/:id/marks`, `POST /exams/:id/publish`, `POST /exams/:id/unpublish`, `GET /exams/:id/results`, `GET /exams/results/students/:id` |
| Fees | `/fees/structures` (+ `/:id/assign`), `/fees/invoices` (+ `/export`, `/:id`, `/:id/cancel`, `/:id/payments`), `GET /fees/payments`, `POST /fees/payments/:id/reverse`, `GET /fees/payments/:id/receipt`, `GET /fees/students/:id`, `GET /fees/summary`, `GET /fees/overdue` |
| Communication | `GET/POST /announcements`, `PATCH/DELETE /announcements/:id`, `GET /notifications`, `GET /notifications/unread-count`, `POST /notifications/:id/read`, `POST /notifications/read-all`, `POST/DELETE /notifications/devices` |
| Leaves | `POST /leaves`, `GET /leaves/mine`, `GET /leaves`, `POST /leaves/:id/review`, `POST /leaves/:id/cancel`, `GET /leaves/on-leave` |
| Dashboard | `GET /dashboard` |
| Platform | `GET /platform/stats`, `GET /platform/institutions`, `GET /platform/institutions/:id`, `PATCH /platform/institutions/:id/status` |

### Who can do what (summary)

| | owner/admin | accountant | teacher | student | guardian |
| --- | --- | --- | --- | --- | --- |
| Setup (programs, batches, timetable, staff) | ✅ | | | | |
| Admissions | ✅ | | | | |
| Attendance | ✅ any batch | | ✅ own batches | own | children |
| Marks entry | ✅ | | ✅ own subject/batch | | |
| Results | ✅ | | own batches | published only | published only |
| Fees | ✅ | ✅ collect | | own | children |
| Announcements | ✅ anyone | read | own batches | read | read |
| Leave review | ✅ all | | students of the batches they coordinate | apply | apply for child |

## Not built yet (planned)

- Push delivery (`modules/communication/notify.ts` has a stub; device tokens are already stored)
- SMS provider for OTP (`modules/communication/subscribers.ts` currently logs the OTP)
- Online payment gateway (Razorpay or similar) that would feed `POST /fees/invoices/:id/payments`
- File uploads (photos, logos, attachments): currently stored as URLs
- Mobile apps (React Native + Expo recommended, so they can share TypeScript types)
