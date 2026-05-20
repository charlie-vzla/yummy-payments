export enum PaymentStatus {
  CREATED = 'CREATED',
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  ERROR = 'ERROR',
}

export const TERMINAL_PAYMENT_STATUSES: PaymentStatus[] = [
  PaymentStatus.APPROVED,
  PaymentStatus.REJECTED,
  PaymentStatus.ERROR,
];
