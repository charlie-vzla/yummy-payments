export interface CreatePaymentDto {
  orderId: string;
  paymentMethodToken: string;
  amount: number;
  currency?: string;
}
