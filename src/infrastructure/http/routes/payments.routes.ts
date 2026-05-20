import { Router, Request, Response, NextFunction } from 'express';
import { PaymentService } from '../../../application/services/PaymentService';
import {
  createPaymentBodySchema,
  createPaymentParamsSchema,
} from '../validation/payment.schemas';

export function createPaymentsRouter(paymentService: PaymentService): Router {
  const router = Router();

  router.post('/create/:orderId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { orderId } = createPaymentParamsSchema.parse(req.params);
      const body = createPaymentBodySchema.parse(req.body);

      if (!req.apiKey) {
        res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'X-Api-Key header is required',
        });
        return;
      }

      const result = await paymentService.create({
        orderId,
        merchantId: req.apiKey,
        paymentMethodToken: body.paymentMethodToken,
        amount: body.amount,
      });

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  });

  router.get('/:orderId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orderId = req.params.orderId;
      if (!orderId || Array.isArray(orderId)) {
        res.status(400).json({ error: 'VALIDATION_ERROR', message: 'orderId is required' });
        return;
      }
      const result = await paymentService.get(orderId);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
