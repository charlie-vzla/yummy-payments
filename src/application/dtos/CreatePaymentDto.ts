export interface CreatePaymentDto {
  orderId: string;
  merchantId: string;
  paymentMethodToken: string;
  amount: number;
}
