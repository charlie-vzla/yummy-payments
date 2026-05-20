export interface IdempotencyStorePort {
  exists(key: string): Promise<boolean>;
  register(key: string, ttlSeconds: number): Promise<void>;
  tryAcquire(key: string, ttlSeconds: number): Promise<boolean>;
  release(key: string): Promise<void>;
}
