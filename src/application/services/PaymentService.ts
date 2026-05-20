import { CreatePaymentDto } from '../dtos/CreatePaymentDto';
import { GetPaymentResponseDto } from '../dtos/GetPaymentResponseDto';
import { PaymentResponseDto } from '../dtos/PaymentResponseDto';
import { OrderRepositoryPort } from '../../domain/ports/OrderRepositoryPort';
import { PaymentProviderPort } from '../../domain/ports/PaymentProviderPort';
import { IdempotencyStorePort } from '../../domain/ports/IdempotencyStorePort';
import { LoggerPort } from '../../shared/logging/LoggerPort';
import { NotFoundError, NotImplementedError } from '../../shared/errors/AppError';
import { Order } from '../../domain/models/Order';
import { PaymentStatus } from '../../domain/models/PaymentStatus';

export class PaymentService {
  private readonly log: LoggerPort;

  constructor(
    private readonly orderRepository: OrderRepositoryPort,
    paymentProvider: PaymentProviderPort,
    idempotencyStore: IdempotencyStorePort,
    logger: LoggerPort,
  ) {
    void paymentProvider;
    void idempotencyStore;
    this.log = logger.child({ component: 'PaymentService' });
  }

  async create(input: CreatePaymentDto): Promise<PaymentResponseDto> {
    const idempotencyValue = `${input.orderId}:${input.amount}`;
    this.log.info(
      {
        event: 'payment_create_started',
        orderId: input.orderId,
        amount: input.amount,
        idempotencyValue,
      },
      'payment_create_started',
    );

    throw new NotImplementedError(
      'Payment creation will be implemented in a follow-up (idempotency + provider flow)',
    );
  }

  async get(orderId: string): Promise<GetPaymentResponseDto> {
    this.log.info({ event: 'payment_get_started', orderId }, 'payment_get_started');

    const order = await this.orderRepository.findByOrderId(orderId);
    if (!order) {
      this.log.info({ event: 'payment_get_not_found', orderId }, 'payment_get_not_found');
      throw new NotFoundError(`No payment found for orderId: ${orderId}`);
    }

    const response = this.toGetPaymentResponse(order);
    this.log.info(
      {
        event: 'payment_get_completed',
        orderId,
        status: response.status,
        retries: response.retries,
      },
      'payment_get_completed',
    );

    return response;
  }

  private toGetPaymentResponse(order: Order): GetPaymentResponseDto {
    const status =
      order.status === PaymentStatus.FAILED ? PaymentStatus.ERROR : order.status;

    const response: GetPaymentResponseDto = {
      status,
      reasonCode: order.reasonCode ?? '',
      reason: order.reason ?? '',
      retries: order.retries,
    };

    if (order.reference) {
      const referenceNumber = Number(order.reference);
      if (!Number.isNaN(referenceNumber)) {
        response.referenceNumber = referenceNumber;
      }
    }

    return response;
  }
}
