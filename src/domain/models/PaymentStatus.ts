export enum PaymentStatus {
  CREATED = 'CREATED',
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  ERROR = 'ERROR',
  FAILED = 'FAILED',
}

export const TERMINAL_PAYMENT_STATUSES: PaymentStatus[] = [
  PaymentStatus.APPROVED,
  PaymentStatus.REJECTED,
  PaymentStatus.ERROR,
];
