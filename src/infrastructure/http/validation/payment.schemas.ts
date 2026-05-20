import { z } from 'zod';

export const createPaymentBodySchema = z.object({
  paymentMethodToken: z.string().min(1),
  amount: z.number().int().positive(),
  orderId: z.string().min(1).optional(),
});

export type CreatePaymentBody = z.infer<typeof createPaymentBodySchema>;
