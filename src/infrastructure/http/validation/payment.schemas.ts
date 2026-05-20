import { z } from 'zod';

export const createPaymentParamsSchema = z.object({
  orderId: z.string().min(1),
});

export const createPaymentBodySchema = z.object({
  paymentMethodToken: z.string().min(1),
  amount: z.number().int().positive(),
});

export type CreatePaymentParams = z.infer<typeof createPaymentParamsSchema>;
export type CreatePaymentBody = z.infer<typeof createPaymentBodySchema>;
