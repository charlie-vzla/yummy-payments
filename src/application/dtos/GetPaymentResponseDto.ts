export interface GetPaymentResponseDto {
  status: string;
  reasonCode: string;
  reason: string;
  retries: number;
  referenceNumber?: string;
}
