import { Router, Request, Response, NextFunction } from 'express';
import { PaymentService } from '../../../application/services/PaymentService';
import { createPaymentBodySchema } from '../validation/payment.schemas';

export function createPaymentsRouter(paymentService: PaymentService): Router {
  const router = Router();

  router.post('/create', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = createPaymentBodySchema.parse(req.body);
      const orderId = body.orderId ?? req.header('X-Order-Id');

      if (!orderId) {
        res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'orderId is required in body or X-Order-Id header',
        });
        return;
      }

      const result = await paymentService.create({
        orderId,
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
