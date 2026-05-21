import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { env } from '../../config/env';
import { Order } from '../../domain/models/Order';
import { PaymentStatus } from '../../domain/models/PaymentStatus';
import { IdempotencyStorePort } from '../../domain/ports/IdempotencyStorePort';
import { PaymentReadCachePort } from '../ports/PaymentReadCachePort';
import { OrderRepositoryPort } from '../../domain/ports/OrderRepositoryPort';
import {
  PaymentProviderPort,
  ProviderChargeResponse,
} from '../../domain/ports/PaymentProviderPort';
import { AppError, NotFoundError } from '../../shared/errors/AppError';
import { LoggerPort } from '../../shared/logging/LoggerPort';
import { CreatePaymentDto } from '../dtos/CreatePaymentDto';
import { GetPaymentResponseDto } from '../dtos/GetPaymentResponseDto';
import { PaymentResponseDto } from '../dtos/PaymentResponseDto';
import { buildIdempotencyKey } from '../utils/idempotencyKey';

const DEFAULT_CURRENCY = 'USD';

export class PaymentService {
  private readonly log: LoggerPort;

  private readonly reasonMessages: Record<string, string> = {
    INSUFFICIENT_FUNDS: 'Insufficient funds',
    PROVIDER_INTERNAL_ERROR: 'Payment could not be processed. Please try again.',
  }

  constructor(
    private readonly orderRepository: OrderRepositoryPort,
    private readonly paymentProvider: PaymentProviderPort,
    private readonly idempotencyStore: IdempotencyStorePort,
    private readonly paymentReadCache: PaymentReadCachePort,
    logger: LoggerPort,
  ) {
    this.log = logger.child({ component: 'PaymentService' });
  }

  async create(input: CreatePaymentDto): Promise<PaymentResponseDto> {
    const { orderId, amount, merchantId } = input;

    if (amount > Number(env.maxAmount)) {
      throw new AppError(400, `Amount is invalid pass amount less that max ${env.maxAmount}`, "PAYMENT_DENIED")
    }

    let order: Order | null = null;
    const idempotencyValue = buildIdempotencyKey(orderId, amount);

    this.log.info(
      {
        event: 'payment_create_started',
        orderId,
        amount,
        idempotencyValue,
      },
      'payment_create_started',
    );

    const existing = await this.resolveExistingPayment(
      orderId,
      amount,
      idempotencyValue,
    );

    if (existing) {
      this.logDuplicate(orderId, amount, existing);
      return this.toPaymentResponse(existing);
    }

    const acquired = await this.idempotencyStore.tryAcquire(
      idempotencyValue,
      env.idempotencyLockTtlSeconds,
    );

    if (!acquired) {
      const duplicate = await this.resolveExistingPayment(
        orderId,
        amount,
        idempotencyValue,
      );

      if (!duplicate) {
        throw new AppError(
          409,
          'Payment request is already in progress',
          'PAYMENT_IN_PROGRESS',
        );
      }

      return this.toPaymentResponse(duplicate);
    }

    try {
      try {
        order = await this.orderRepository.create({
          merchantId,
          amount,
          orderId,
          status: PaymentStatus.CREATED,
          reasonCode: null,
          reason: null,
          reference: null,
          providerPaymentId: null,
          currency: DEFAULT_CURRENCY,
          idempotencyValue,
          retries: 0,
        });
      } catch (error) {
        if (isPrismaUniqueViolation(error)) {
          const duplicate = await this.resolveExistingPayment(
            input.orderId,
            input.amount,
            idempotencyValue,
          );

          if (duplicate) {
            return this.toPaymentResponse(duplicate);
          }
        }

        throw new AppError(
          409,
          'Payment request is already in progress',
          'PAYMENT_IN_PROGRESS',
        );
      }

      await this.idempotencyStore.register(idempotencyValue, env.idempotencyRecordTtlSeconds);

      order.status = PaymentStatus.PENDING;
      order = await this.orderRepository.update(order);

      order = await this.chargeWithRetries(order, input);

      this.log.info(
        {
          event: 'payment_create_completed',
          orderId,
          status: order.status,
          retries: order.retries,
        },
        'payment_create_completed',
      );

      return this.toPaymentResponse(order);
    } finally {
      await this.idempotencyStore.release(idempotencyValue);
    }
  }

  async get(orderId: string): Promise<GetPaymentResponseDto> {
    this.log.info({ event: 'payment_get_started', orderId }, 'payment_get_started');

    const cached = await this.paymentReadCache.get(orderId);
    if (cached) {
      this.log.info(
        { event: 'payment_get_cache_hit', orderId, status: cached.status },
        'payment_get_cache_hit',
      );
      return cached;
    }

    const order = await this.orderRepository.findByOrderId(orderId);
    if (!order) {
      this.log.info({ event: 'payment_get_not_found', orderId }, 'payment_get_not_found');
      throw new NotFoundError(`No payment found for orderId: ${orderId}`);
    }

    const response = this.toGetPaymentResponse(order);

    if (this.isTerminalStatus(order.status)) {
      await this.paymentReadCache.set(orderId, response);
      this.log.info(
        { event: 'payment_get_cache_populated', orderId, status: response.status },
        'payment_get_cache_populated',
      );
    }

    this.log.info(
      {
        event: 'payment_get_cache_miss',
        orderId,
        status: response.status,
        retries: response.retries,
      },
      'payment_get_cache_miss',
    );

    return response;
  }

  private async resolveExistingPayment(
    orderId: string,
    amount: number,
    idempotencyValue: string,
  ): Promise<Order | null> {
    const fromDb = await this.findExistingOrder(orderId, amount, idempotencyValue);
    if (fromDb) {
      return fromDb;
    }

    const redisExists = await this.idempotencyStore.exists(idempotencyValue);
    if (!redisExists) {
      return null;
    }

    return this.findExistingOrder(orderId, amount, idempotencyValue);
  }

  private logDuplicate(orderId: string, amount: number, order: Order): void {
    this.log.info(
      {
        event: 'payment_create_duplicate',
        orderId,
        amount,
        status: order.status,
      },
      'payment_create_duplicate',
    );
  }

  private async findExistingOrder(
    orderId: string,
    amount: number,
    idempotencyValue: string,
  ): Promise<Order | null> {
    return (
      (await this.orderRepository.findByIdempotencyValue(idempotencyValue)) ??
      (await this.orderRepository.findByOrderIdAndAmount(orderId, amount))
    );
  }

  private async chargeWithRetries(order: Order, input: CreatePaymentDto): Promise<Order> {
    const { merchantId, amount, paymentMethodToken, orderId } = input;

    const chargeRequest = {
      merchantId,
      amount,
      currency: DEFAULT_CURRENCY,
      paymentMethodToken,
      externalReference: orderId,
      idempotencyReference: order.idempotencyValue,
    };

    let providerResult = await this.paymentProvider.charge(chargeRequest);

    this.log.info(
      {
        event: 'payment_provider_called',
        orderId: input.orderId,
        providerStatus: providerResult.status,
        reasonCode: providerResult.reasonCode,
      },
      'payment_provider_called',
    );

    while (
      providerResult.status === 'ERROR' &&
      order.retries < env.paymentProviderMaxRetries
    ) {
      order.retries += 1;
      order = await this.orderRepository.update(order);

      providerResult = await this.paymentProvider.charge(chargeRequest);

      this.log.info(
        {
          event: 'payment_provider_called',
          orderId: input.orderId,
          providerStatus: providerResult.status,
          reasonCode: providerResult.reasonCode,
          retries: order.retries,
        },
        'payment_provider_called',
      );
    }

    return this.applyProviderResult(order, providerResult);
  }

  private async applyProviderResult(
    order: Order,
    providerResult: ProviderChargeResponse,
  ): Promise<Order> {
    if (providerResult.status === 'APPROVED') {
      order.status = PaymentStatus.APPROVED;
      order.providerPaymentId = providerResult.providerPaymentId;
      order.reasonCode = null;
      order.reason = '';
    } else if (providerResult.status === 'REJECTED') {
      order.status = PaymentStatus.REJECTED;
      order.reasonCode = providerResult.reasonCode;
      order.reason = this.mapReasonMessage(providerResult.reasonCode);
    } else {
      order.status = PaymentStatus.ERROR;
      order.reasonCode = providerResult.reasonCode;
      order.reason = this.mapReasonMessage(providerResult.reasonCode);
    }

    return this.orderRepository.update(order);
  }

  private isTerminalStatus(status: PaymentStatus): boolean {
    return (
      status === PaymentStatus.APPROVED ||
      status === PaymentStatus.REJECTED ||
      status === PaymentStatus.ERROR
    );
  }

  private mapReasonMessage(reasonCode: string | null): string {
    if (!reasonCode) {
      return '';
    }
    return this.reasonMessages[reasonCode] ?? reasonCode;
  }

  private toApiPaymentStatus(status: PaymentStatus): string {
    if (status === PaymentStatus.CREATED || status === PaymentStatus.PENDING) {
      return PaymentStatus.PENDING;
    }
    return status;
  }

  private toPaymentResponse(order: Order): PaymentResponseDto {
    const response: PaymentResponseDto = {
      amount: order.amount,
      status: this.toApiPaymentStatus(order.status),
      reasonCode: order.reasonCode ?? '',
      reason: order.reason ?? '',
      referenceNumber: order.id
    };

    return response;
  }

  private toGetPaymentResponse(order: Order): GetPaymentResponseDto {
    const response: GetPaymentResponseDto = {
      status: this.toApiPaymentStatus(order.status),
      reasonCode: order.reasonCode ?? '',
      reason: order.reason ?? '',
      retries: order.retries,
      referenceNumber: order.id,
    };

    return response;
  }
}

function isPrismaUniqueViolation(error: unknown): boolean {
  return error instanceof PrismaClientKnownRequestError && error.code === 'P2002';
}
