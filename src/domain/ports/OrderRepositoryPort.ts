import { Order } from '../models/Order';

export interface OrderRepositoryPort {
  findByOrderId(orderId: string): Promise<Order | null>;
  findByOrderIdAndAmount(orderId: string, amount: number): Promise<Order | null>;
  findByIdempotencyValue(idempotencyValue: string): Promise<Order | null>;
  create(order: Omit<Order, 'id' | 'createdAt' | 'updatedAt'>): Promise<Order>;
  update(order: Order): Promise<Order>;
}
