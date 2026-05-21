import { GetPaymentResponseDto } from '../dtos/GetPaymentResponseDto';

export interface PaymentReadCachePort {
  get(orderId: string): Promise<GetPaymentResponseDto | null>;
  set(orderId: string, value: GetPaymentResponseDto): Promise<void>;
}
