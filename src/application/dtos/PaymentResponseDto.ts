export interface PaymentResponseDto {
  amount: number;
  status: string;
  reasonCode: string;
  reason: string;
  referenceNumber?: number;
}
