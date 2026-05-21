import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { PaymentService } from './PaymentService';
import { OrderRepositoryPort } from '../../domain/ports/OrderRepositoryPort';
import { PaymentProviderPort } from '../../domain/ports/PaymentProviderPort';
import { IdempotencyStorePort } from '../../domain/ports/IdempotencyStorePort';
import { PaymentReadCachePort } from '../ports/PaymentReadCachePort';
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

  const paymentReadCache: jest.Mocked<PaymentReadCachePort> = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
  };

  return { orderRepository, paymentProvider, idempotencyStore, paymentReadCache };
}

function createService(
  orderRepository: jest.Mocked<OrderRepositoryPort>,
  paymentProvider: jest.Mocked<PaymentProviderPort>,
  idempotencyStore: jest.Mocked<IdempotencyStorePort>,
  paymentReadCache: jest.Mocked<PaymentReadCachePort>,
): PaymentService {
  return new PaymentService(
    orderRepository,
    paymentProvider,
    idempotencyStore,
    paymentReadCache,
    noopLogger,
  );
}

describe('PaymentService.create', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns APPROVED for amount 50000', async () => {
    const { orderRepository, paymentProvider, idempotencyStore, paymentReadCache } = createMocks();
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

    const service = createService(
      orderRepository,
      paymentProvider,
      idempotencyStore,
      paymentReadCache,
    );

    const result = await service.create(baseInput);

    expect(result.status).toBe('APPROVED');
    expect(result.amount).toBe(50_000);
    expect(result.referenceNumber).toBe(created.id);
    expect(paymentProvider.charge).toHaveBeenCalledTimes(1);
    expect(paymentReadCache.set).not.toHaveBeenCalled();
    expect(orderRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ status: PaymentStatus.CREATED }),
    );
  });

  it('returns REJECTED for amount 100001', async () => {
    const { orderRepository, paymentProvider, idempotencyStore, paymentReadCache } = createMocks();
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

    const service = createService(
      orderRepository,
      paymentProvider,
      idempotencyStore,
      paymentReadCache,
    );

    const result = await service.create(input);

    expect(result.status).toBe('REJECTED');
    expect(result.reasonCode).toBe('INSUFFICIENT_FUNDS');
    expect(result.reason).toBe('Insufficient funds');
  });

  it('retries on provider ERROR and ends with ERROR after max retries', async () => {
    const { orderRepository, paymentProvider, idempotencyStore, paymentReadCache } = createMocks();
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

    const service = createService(
      orderRepository,
      paymentProvider,
      idempotencyStore,
      paymentReadCache,
    );

    const result = await service.create(input);

    expect(result.status).toBe('ERROR');
    expect(result.reasonCode).toBe('PROVIDER_INTERNAL_ERROR');
    expect(paymentProvider.charge).toHaveBeenCalledTimes(4);
  });

  it('returns existing order on duplicate without calling provider again', async () => {
    const { orderRepository, paymentProvider, idempotencyStore, paymentReadCache } = createMocks();
    const existing = buildOrder({ status: PaymentStatus.APPROVED });

    orderRepository.findByIdempotencyValue.mockResolvedValue(existing);
    orderRepository.findByOrderIdAndAmount.mockResolvedValue(existing);

    const service = createService(
      orderRepository,
      paymentProvider,
      idempotencyStore,
      paymentReadCache,
    );

    const result = await service.create(baseInput);

    expect(result.status).toBe('APPROVED');
    expect(paymentProvider.charge).not.toHaveBeenCalled();
    expect(idempotencyStore.tryAcquire).not.toHaveBeenCalled();
  });

  it('loads from postgres when redis marker exists', async () => {
    const { orderRepository, paymentProvider, idempotencyStore, paymentReadCache } = createMocks();
    const existing = buildOrder({ status: PaymentStatus.PENDING });

    orderRepository.findByIdempotencyValue
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(existing);
    orderRepository.findByOrderIdAndAmount.mockResolvedValue(null);
    idempotencyStore.exists.mockResolvedValue(true);

    const service = createService(
      orderRepository,
      paymentProvider,
      idempotencyStore,
      paymentReadCache,
    );

    const result = await service.create(baseInput);

    expect(result.status).toBe('PENDING');
    expect(orderRepository.findByIdempotencyValue).toHaveBeenCalledWith(idempotencyValue);
    expect(paymentProvider.charge).not.toHaveBeenCalled();
  });

  it('throws PAYMENT_IN_PROGRESS when lock not acquired and no order exists', async () => {
    const { orderRepository, paymentProvider, idempotencyStore, paymentReadCache } = createMocks();

    orderRepository.findByIdempotencyValue.mockResolvedValue(null);
    orderRepository.findByOrderIdAndAmount.mockResolvedValue(null);
    idempotencyStore.exists.mockResolvedValue(false);
    idempotencyStore.tryAcquire.mockResolvedValue(false);

    const service = createService(
      orderRepository,
      paymentProvider,
      idempotencyStore,
      paymentReadCache,
    );

    await expect(service.create(baseInput)).rejects.toMatchObject({
      statusCode: 409,
      code: 'PAYMENT_IN_PROGRESS',
    });
    expect(paymentProvider.charge).not.toHaveBeenCalled();
    expect(orderRepository.create).not.toHaveBeenCalled();
  });

  it('returns existing order on prisma unique violation', async () => {
    const { orderRepository, paymentProvider, idempotencyStore, paymentReadCache } = createMocks();
    const existing = buildOrder({ status: PaymentStatus.APPROVED });
    const prismaError = new PrismaClientKnownRequestError('Unique constraint', {
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

    const service = createService(
      orderRepository,
      paymentProvider,
      idempotencyStore,
      paymentReadCache,
    );

    const result = await service.create(baseInput);

    expect(result.status).toBe('APPROVED');
    expect(paymentProvider.charge).not.toHaveBeenCalled();
  });
});

describe('PaymentService.get', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns cached response on cache hit without querying the database', async () => {
    const { orderRepository, paymentProvider, idempotencyStore, paymentReadCache } = createMocks();
    const cached = {
      status: 'APPROVED',
      reasonCode: '',
      reason: '',
      retries: 0,
      referenceNumber: 'order-uuid-1',
    };

    paymentReadCache.get.mockResolvedValue(cached);

    const service = createService(
      orderRepository,
      paymentProvider,
      idempotencyStore,
      paymentReadCache,
    );

    const result = await service.get(baseInput.orderId);

    expect(result).toEqual(cached);
    expect(orderRepository.findByOrderId).not.toHaveBeenCalled();
    expect(paymentReadCache.set).not.toHaveBeenCalled();
  });

  it('loads from database on cache miss for PENDING and does not set cache', async () => {
    const { orderRepository, paymentProvider, idempotencyStore, paymentReadCache } = createMocks();
    const pending = buildOrder({ status: PaymentStatus.PENDING });

    paymentReadCache.get.mockResolvedValue(null);
    orderRepository.findByOrderId.mockResolvedValue(pending);

    const service = createService(
      orderRepository,
      paymentProvider,
      idempotencyStore,
      paymentReadCache,
    );

    const result = await service.get(baseInput.orderId);

    expect(result.status).toBe('PENDING');
    expect(result.retries).toBe(0);
    expect(orderRepository.findByOrderId).toHaveBeenCalledWith(baseInput.orderId);
    expect(paymentReadCache.set).not.toHaveBeenCalled();
  });

  it('loads from database on cache miss for APPROVED and populates cache', async () => {
    const { orderRepository, paymentProvider, idempotencyStore, paymentReadCache } = createMocks();
    const approved = buildOrder({
      status: PaymentStatus.APPROVED,
      reason: '',
    });

    paymentReadCache.get.mockResolvedValue(null);
    orderRepository.findByOrderId.mockResolvedValue(approved);

    const service = createService(
      orderRepository,
      paymentProvider,
      idempotencyStore,
      paymentReadCache,
    );

    const result = await service.get(baseInput.orderId);

    expect(result.status).toBe('APPROVED');
    expect(paymentReadCache.set).toHaveBeenCalledWith(baseInput.orderId, {
      status: 'APPROVED',
      reasonCode: '',
      reason: '',
      retries: 0,
      referenceNumber: 'order-uuid-1',
    });
  });

  it('throws NotFoundError when order does not exist', async () => {
    const { orderRepository, paymentProvider, idempotencyStore, paymentReadCache } = createMocks();

    paymentReadCache.get.mockResolvedValue(null);
    orderRepository.findByOrderId.mockResolvedValue(null);

    const service = createService(
      orderRepository,
      paymentProvider,
      idempotencyStore,
      paymentReadCache,
    );

    await expect(service.get('missing-order')).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(paymentReadCache.set).not.toHaveBeenCalled();
  });
});
