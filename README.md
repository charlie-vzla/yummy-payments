# Yummy Payments — Payment Orchestrator

Node.js + TypeScript payment orchestrator service with hexagonal architecture, Express, PostgreSQL (Prisma), and Redis.

## Prerequisites

- Docker & Docker Compose
- Node.js 20+ (for local development without Docker)

## Quick start (Docker)

```bash
cp .env.example .env
docker compose up --build
```

The API will be available at `http://localhost:3000`.

**pgAdmin** (database UI): `http://localhost:5050` — login `admin@admin.com` / `admin` (dev only).

To register the Postgres server in pgAdmin: **Add New Server** → **Connection** tab:

| Field | Value |
|-------|--------|
| Host | `postgres` |
| Port | `5432` |
| Maintenance database | `yummy_payments` |
| Username | `postgres` |
| Password | `postgres` |

Use host `postgres` (Docker service name), not `localhost`, when pgAdmin runs inside Compose.

- Health: `GET /health`
- Create payment: `POST /payments/create/:orderId`
- Get payment: `GET /payments/:orderId`

Migrations run automatically on startup via `prisma migrate deploy` and live in **`prisma/migrations/`**.

## Local development (without Docker)

1. Start PostgreSQL and Redis locally (or use `docker compose up postgres redis`).
2. Copy environment file and adjust URLs:

   ```bash
   cp .env.example .env
   ```

3. Install dependencies and run migrations:

   ```bash
   npm install
   npm run db:generate
   npm run db:migrate
   ```

4. Start the dev server:

   ```bash
   npm run dev
   ```

## Project structure (hexagonal)

```
src/
├── domain/
│   ├── models/          # Entities (Order, PaymentStatus)
│   └── ports/           # Outbound contracts (repositories, provider, idempotency)
├── application/
│   ├── dtos/            # Request/response types for use cases
│   └── services/        # PaymentService (create, get)
├── shared/
│   └── logging/         # LoggerPort + Pino (structured logs, redaction)
└── infrastructure/
    ├── http/            # Express (driving adapter)
    ├── persistence/     # Prisma (driven adapter)
    ├── cache/           # Redis idempotency store (driven adapter)
    └── providers/       # Mock payment provider (driven adapter)
```

## Mock payment provider

The mock provider ([`MockPaymentProvider`](src/infrastructure/providers/MockPaymentProvider.ts)) simulates an external gateway. Amounts are in **centavos** (see [Referencia — Servicios Externos](docs/REFERENCIA-SERVICIOS-EXTERNOS.md)).

| Amount (cents) | Provider `status` | `reasonCode` |
|----------------|-------------------|--------------|
| `<= 100000` | `APPROVED` | — |
| `> 100000` (except below) | `REJECTED` | `INSUFFICIENT_FUNDS` |
| `999900` | `ERROR` | `PROVIDER_INTERNAL_ERROR` |

`999900` takes priority over the `> 100000` rejection rule.

## API notes

- Authentication header: `X-Api-Key` (pass-through; no validation per design assumptions).
- Create payment: `POST /payments/create/:orderId` with body `paymentMethodToken` + `amount` (cents). `X-Api-Key` is used as `merchantId`.
- At most one payment per `(orderId, amount)` — enforced by DB unique constraint (full flow in a follow-up).

## Logging (Pino)

Structured JSON logs via [Pino](https://getpino.io/). Sensitive fields (`paymentMethodToken`, `X-Api-Key`) are **redacted** automatically.

| Variable | Default | Description |
|----------|---------|-------------|
| `LOG_LEVEL` | `info` | `trace`, `debug`, `info`, `warn`, `error` |
| `LOG_PRETTY` | `false` | `true` for human-readable output (local dev) |
| `LOG_DESTINATION` | `stdout` | `stdout` or `file` |
| `LOG_FILE` | `/var/log/yummy-payments/app.log` | Used when `LOG_DESTINATION=file` |

### Where logs go (no code change)

| Destination | Setup |
|-------------|--------|
| **stdout** (default) | JSON lines on container/process stdout |
| **AWS CloudWatch** | Ship stdout with CloudWatch agent / Fluent Bit (ECS, EKS, Lambda) |
| **Elastic / OpenSearch** | Ship stdout with Filebeat or Fluentd → Elastic |
| **Disk** | Set `LOG_DESTINATION=file` and mount a volume at `LOG_FILE` |

Payment flow events (`payment_create_started`, `payment_get_completed`, etc.) are logged from `PaymentService` with safe fields only (`orderId`, `amount`, `status`, `reasonCode`).

HTTP requests are logged with `pino-http` (`/health` excluded). Each request gets an `X-Request-Id` header.

> **Docker:** set `LOG_PRETTY=false` in `.env` (or override in `docker-compose.yml`). The production image does not include `pino-pretty` (it is a dev dependency).

## Testing concurrent creates (race / idempotency)

Postman does not fire truly parallel requests easily. Use the shell script or curl with background jobs.

### Script (recommended)

With the API running (`docker compose up` or `npm run dev`):

```bash
chmod +x scripts/race-create.sh
export API_KEY=your-api-key   # match .env
./scripts/race-create.sh race-manual-1 20
```

| Argument | Default | Description |
|----------|---------|-------------|
| 1 — `orderId` | `race-<timestamp>` | Same id for all parallel requests |
| 2 — concurrency | `20` | Number of parallel POSTs |

Optional env: `BASE` (default `http://localhost:3000`), `AMOUNT` (default `50000`).

**Expected:** mostly **200** (create or idempotent duplicate), sometimes **409** `PAYMENT_IN_PROGRESS`. Exactly **one** row in `orders` for that `(orderId, amount)` in pgAdmin.

### One-liner (curl only)

```bash
ORDER_ID="race-$(date +%s)"
API_KEY="your-api-key"

for i in $(seq 1 20); do
  curl -s -w "\nreq-$i HTTP %{http_code}\n" \
    -X POST "http://localhost:3000/payments/create/${ORDER_ID}" \
    -H "X-Api-Key: ${API_KEY}" \
    -H "Content-Type: application/json" \
    -d '{"paymentMethodToken":"tok_test","amount":50000}' &
done
wait
```

Watch app logs: `docker compose logs -f app`.

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start with hot reload |
| `npm run build` | Compile TypeScript |
| `npm start` | Run compiled app |
| `npm run db:migrate` | Create/apply migrations (dev) |
| `npm run db:deploy` | Apply migrations (production) |
| `npm run db:generate` | Generate Prisma client |
| `npm run lint` | Run ESLint |
| `npm test` | Run Jest unit tests |
| `npm run test:watch` | Run Jest in watch mode |
| `scripts/race-create.sh` | Parallel create requests (manual race / idempotency test) |

## Environment variables

See [`.env.example`](.env.example):

| Variable | Description |
|----------|-------------|
| `PORT` | HTTP port (default `3000`) |
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `API_KEY` | Placeholder API key |
| `PAYMENT_PROVIDER_MAX_RETRIES` | Retries after provider ERROR (default `3`) |
| `IDEMPOTENCY_LOCK_TTL_SECONDS` | Redis lock TTL during processing |
| `IDEMPOTENCY_RECORD_TTL_SECONDS` | Redis idempotency marker TTL |
| `LOG_LEVEL` | Pino log level |
| `LOG_PRETTY` | Pretty-print logs for local dev |
| `LOG_DESTINATION` | `stdout` or `file` |
| `LOG_FILE` | Log file path when using file destination |
