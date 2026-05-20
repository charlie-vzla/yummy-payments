import { Prisma } from '@prisma/client';
import { PaymentService } from './PaymentService';
import { OrderRepositoryPort } from '../../domain/ports/OrderRepositoryPort';
import { PaymentProviderPort } from '../../domain/ports/PaymentProviderPort';
import { IdempotencyStorePort } from '../../domain/ports/IdempotencyStorePort';
import { noopLogger } from '../../shared/logging/noopLogger';
import { Order } from '../../domain/models/Order';
import { PaymentStatus } from '../../domain/models/PaymentStatus';
import { buildIdempotencyKey } from '../utils/idempotencyKey';

const baseInput = {
  orderId: 'order-1',
  merchantId: 'merchant-api-key',
  paymentMethodToken: 'tok_test',
  amount: 50_000,
};

const idempotencyValue = buildIdempotencyKey(baseInput.orderId, baseInput.amount);

function buildOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'order-uuid-1',
    merchantId: baseInput.merchantId,
    amount: baseInput.amount,
    orderId: baseInput.orderId,
    status: PaymentStatus.CREATED,
    reasonCode: null,
    reason: null,
    reference: null,
    providerPaymentId: null,
    currency: 'USD',
    idempotencyValue,
    retries: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function createMocks() {
  const orderRepository: jest.Mocked<OrderRepositoryPort> = {
    findByOrderId: jest.fn(),
    findByOrderIdAndAmount: jest.fn(),
    findByIdempotencyValue: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  };

  const paymentProvider: jest.Mocked<PaymentProviderPort> = {
    charge: jest.fn(),
  };

  const idempotencyStore: jest.Mocked<IdempotencyStorePort> = {
    exists: jest.fn(),
    register: jest.fn(),
    tryAcquire: jest.fn(),
    release: jest.fn(),
  };

  return { orderRepository, paymentProvider, idempotencyStore };
}

describe('PaymentService.create', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns APPROVED for amount 50000', async () => {
    const { orderRepository, paymentProvider, idempotencyStore } = createMocks();
    const created = buildOrder();

    orderRepository.findByIdempotencyValue.mockResolvedValue(null);
    orderRepository.findByOrderIdAndAmount.mockResolvedValue(null);
    idempotencyStore.exists.mockResolvedValue(false);
    idempotencyStore.tryAcquire.mockResolvedValue(true);
    orderRepository.create.mockResolvedValue(created);
    orderRepository.update.mockImplementation(async (order) => order);
    paymentProvider.charge.mockResolvedValue({
      providerPaymentId: 'pp_1',
      status: 'APPROVED',
      reasonCode: null,
    });

    const service = new PaymentService(
      orderRepository,
      paymentProvider,
      idempotencyStore,
      noopLogger,
    );

    const result = await service.create(baseInput);

    expect(result.status).toBe('APPROVED');
    expect(result.amount).toBe(50_000);
    expect(paymentProvider.charge).toHaveBeenCalledTimes(1);
    expect(orderRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ status: PaymentStatus.CREATED }),
    );
  });

  it('returns REJECTED for amount 100001', async () => {
    const { orderRepository, paymentProvider, idempotencyStore } = createMocks();
    const input = { ...baseInput, amount: 100_001 };
    const created = buildOrder({ amount: 100_001 });

    orderRepository.findByIdempotencyValue.mockResolvedValue(null);
    orderRepository.findByOrderIdAndAmount.mockResolvedValue(null);
    idempotencyStore.exists.mockResolvedValue(false);
    idempotencyStore.tryAcquire.mockResolvedValue(true);
    orderRepository.create.mockResolvedValue(created);
    orderRepository.update.mockImplementation(async (order) => order);
    paymentProvider.charge.mockResolvedValue({
      providerPaymentId: 'pp_2',
      status: 'REJECTED',
      reasonCode: 'INSUFFICIENT_FUNDS',
    });

    const service = new PaymentService(
      orderRepository,
      paymentProvider,
      idempotencyStore,
      noopLogger,
    );

    const result = await service.create(input);

    expect(result.status).toBe('REJECTED');
    expect(result.reasonCode).toBe('INSUFFICIENT_FUNDS');
    expect(result.reason).toBe('Insufficient funds');
  });

  it('retries on provider ERROR and ends with ERROR after max retries', async () => {
    const { orderRepository, paymentProvider, idempotencyStore } = createMocks();
    const input = { ...baseInput, amount: 999_900 };
    const created = buildOrder({ amount: 999_900 });

    orderRepository.findByIdempotencyValue.mockResolvedValue(null);
    orderRepository.findByOrderIdAndAmount.mockResolvedValue(null);
    idempotencyStore.exists.mockResolvedValue(false);
    idempotencyStore.tryAcquire.mockResolvedValue(true);
    orderRepository.create.mockResolvedValue(created);
    orderRepository.update.mockImplementation(async (order) => order);
    paymentProvider.charge.mockResolvedValue({
      providerPaymentId: 'pp_err',
      status: 'ERROR',
      reasonCode: 'PROVIDER_INTERNAL_ERROR',
    });

    const service = new PaymentService(
      orderRepository,
      paymentProvider,
      idempotencyStore,
      noopLogger,
    );

    const result = await service.create(input);

    expect(result.status).toBe('ERROR');
    expect(result.reasonCode).toBe('PROVIDER_INTERNAL_ERROR');
    expect(paymentProvider.charge).toHaveBeenCalledTimes(4);
  });

  it('returns existing order on duplicate without calling provider again', async () => {
    const { orderRepository, paymentProvider, idempotencyStore } = createMocks();
    const existing = buildOrder({ status: PaymentStatus.APPROVED });

    orderRepository.findByIdempotencyValue.mockResolvedValue(existing);
    orderRepository.findByOrderIdAndAmount.mockResolvedValue(existing);

    const service = new PaymentService(
      orderRepository,
      paymentProvider,
      idempotencyStore,
      noopLogger,
    );

    const result = await service.create(baseInput);

    expect(result.status).toBe('APPROVED');
    expect(paymentProvider.charge).not.toHaveBeenCalled();
    expect(idempotencyStore.tryAcquire).not.toHaveBeenCalled();
  });

  it('loads from postgres when redis marker exists', async () => {
    const { orderRepository, paymentProvider, idempotencyStore } = createMocks();
    const existing = buildOrder({ status: PaymentStatus.PENDING });

    orderRepository.findByIdempotencyValue
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(existing);
    orderRepository.findByOrderIdAndAmount.mockResolvedValue(null);
    idempotencyStore.exists.mockResolvedValue(true);

    const service = new PaymentService(
      orderRepository,
      paymentProvider,
      idempotencyStore,
      noopLogger,
    );

    const result = await service.create(baseInput);

    expect(result.status).toBe('PENDING');
    expect(orderRepository.findByIdempotencyValue).toHaveBeenCalledWith(idempotencyValue);
    expect(paymentProvider.charge).not.toHaveBeenCalled();
  });

  it('throws PAYMENT_IN_PROGRESS when lock not acquired and no order exists', async () => {
    const { orderRepository, paymentProvider, idempotencyStore } = createMocks();

    orderRepository.findByIdempotencyValue.mockResolvedValue(null);
    orderRepository.findByOrderIdAndAmount.mockResolvedValue(null);
    idempotencyStore.exists.mockResolvedValue(false);
    idempotencyStore.tryAcquire.mockResolvedValue(false);

    const service = new PaymentService(
      orderRepository,
      paymentProvider,
      idempotencyStore,
      noopLogger,
    );

    await expect(service.create(baseInput)).rejects.toMatchObject({
      statusCode: 409,
      code: 'PAYMENT_IN_PROGRESS',
    });
    expect(paymentProvider.charge).not.toHaveBeenCalled();
    expect(orderRepository.create).not.toHaveBeenCalled();
  });

  it('returns existing order on prisma unique violation', async () => {
    const { orderRepository, paymentProvider, idempotencyStore } = createMocks();
    const existing = buildOrder({ status: PaymentStatus.APPROVED });
    const prismaError = new Prisma.PrismaClientKnownRequestError('Unique constraint', {
      code: 'P2002',
      clientVersion: '6.0.0',
    });

    orderRepository.findByIdempotencyValue.mockResolvedValue(null);
    orderRepository.findByOrderIdAndAmount
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(existing);
    idempotencyStore.exists.mockResolvedValue(false);
    idempotencyStore.tryAcquire.mockResolvedValue(true);
    orderRepository.create.mockRejectedValue(prismaError);

    const service = new PaymentService(
      orderRepository,
      paymentProvider,
      idempotencyStore,
      noopLogger,
    );

    const result = await service.create(baseInput);

    expect(result.status).toBe('APPROVED');
    expect(paymentProvider.charge).not.toHaveBeenCalled();
  });
});
