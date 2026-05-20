# Yummy Payments — Payment Orchestrator

Node.js + TypeScript payment orchestrator service with hexagonal architecture, Express, PostgreSQL (Prisma), and Redis.

## Documentation

- [API](docs/API.md)
- [Referencia — Servicios Externos](docs/REFERENCIA-SERVICIOS-EXTERNOS.md)

## Prerequisites

- Docker & Docker Compose
- Node.js 20+ (for local development without Docker)

## Quick start (Docker)

```bash
cp .env.example .env
docker compose up --build
```

The API will be available at `http://localhost:3000`.

- Health: `GET /health`
- Create payment: `POST /payments/create` (stub — returns 501 until implemented)
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

## API notes

- Authentication header: `X-Api-Key` (pass-through; no validation per design assumptions).
- Create payment requires `orderId` in the JSON body or `X-Order-Id` header (in addition to `paymentMethodToken` and `amount`).
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

## Environment variables

See [`.env.example`](.env.example):

| Variable | Description |
|----------|-------------|
| `PORT` | HTTP port (default `3000`) |
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `API_KEY` | Placeholder API key |
| `MERCHANT_ID` | Default merchant id for provider calls |
| `LOG_LEVEL` | Pino log level |
| `LOG_PRETTY` | Pretty-print logs for local dev |
| `LOG_DESTINATION` | `stdout` or `file` |
| `LOG_FILE` | Log file path when using file destination |
