import { EventEmitter } from 'events';

/**
 * In-process domain events. Modules publish facts ("attendance was marked");
 * other modules (mainly communication) react to them. Handlers run after the
 * response is sent and never break the request that emitted the event.
 *
 * If a module is ever split into its own service, swap this for a real
 * broker (Redis streams, RabbitMQ...) without touching the publishers.
 */
export interface DomainEvents {
  'attendance.marked': {
    institutionId: string;
    batchId: string;
    date: string;
    absentStudentIds: string[];
  };
  'exam.scheduled': {
    institutionId: string;
    examId: string;
    examName: string;
    batchIds: string[];
    startDate: string;
  };
  'exam.results_published': {
    institutionId: string;
    examId: string;
    examName: string;
    batchIds: string[];
  };
  'fee.payment_recorded': {
    institutionId: string;
    studentId: string;
    invoiceId: string;
    amount: number;
  };
  'fee.overdue': {
    institutionId: string;
    studentIds: string[];
  };
  'leave.reviewed': {
    institutionId: string;
    userId: string;
    status: 'approved' | 'rejected';
    fromDate: string;
    toDate: string;
  };
  'otp.requested': {
    phone: string;
    code: string;
  };
}

type Handler<K extends keyof DomainEvents> = (payload: DomainEvents[K]) => Promise<void> | void;

const emitter = new EventEmitter();
emitter.setMaxListeners(50);

export const events = {
  emit<K extends keyof DomainEvents>(name: K, payload: DomainEvents[K]) {
    emitter.emit(name, payload);
  },
  on<K extends keyof DomainEvents>(name: K, handler: Handler<K>) {
    emitter.on(name, (payload: DomainEvents[K]) => {
      Promise.resolve()
        .then(() => handler(payload))
        .catch((error) => console.error(`[events] handler for "${name}" failed:`, error));
    });
  },
};
