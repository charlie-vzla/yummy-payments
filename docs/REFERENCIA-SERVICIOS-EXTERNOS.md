# Referencia — Servicios Externos

Documentación de integraciones y servicios externos del Payment Orchestrator, basada en [Referencia — Servicios Externos](https://yummysuperapp.notion.site/Referencia-Servicios-Externos-3618380c875580febb41c52f0fcfbba8).

Para la API pública del orquestador, ver [API.md](./API.md).

---

## Payment Orchestrator Service

Servicio interno consumido por otros microservicios. Orquesta el flujo de pago entre tokenización upstream, vault (conceptual) y el proveedor de pagos.

### Autenticación

```http
X-Api-Key: your-api-key
```

- No implementar lógica de autenticación ni autorización.
- Asumir que el API key llega válido.

---

## Flujo general

```
Merchant / upstream
    │  (tokenización — fuera de scope)
    ▼
paymentMethodToken
    │
    ▼
Payment Orchestrator  ──►  Vault (conceptual, no implementar)
    │
    ▼
Payment Provider Adapter  ──►  Payment Provider (MOCK en este ejercicio)
    │
    ▼
Persistencia + respuesta al caller
```

---

## Servicios externos involucrados

### 1. Tokenización (upstream — fuera de scope)

El **merchant** es responsable de tokenizar la tarjeta antes de llamar al Payment Orchestrator. Ese proceso ocurre fuera de este servicio.

**Lo que recibe el orquestador:**

| Campo                | Descripción |
|----------------------|-------------|
| `paymentMethodToken` | Identificador opaco del método de pago del cliente |

El servicio **nunca** recibe ni almacena PAN, CVV ni datos sensibles de tarjeta.

---

### 2. Vault (conceptual — no implementar)

Entre el Payment Orchestrator y el Payment Provider existe un **vault** (similar a [VGS](https://www.verygoodsecurity.com/)):

- Recibe el `paymentMethodToken`
- Detokeniza de forma segura
- Reenvía datos al proveedor

El Payment Orchestrator **nunca** manipula datos de tarjeta en texto plano.

**Para este ejercicio:** el vault no se implementa ni se mockea. El adapter del proveedor puede asumir que llama directamente al proveedor.

---

### 3. Payment Provider (mockear)

Pasarela de pago externa. Es **PCI compliant**: sus respuestas no contienen datos sensibles de tarjeta.

En este proyecto se implementa un **proveedor simulado** con reglas determinísticas por monto.

#### Request al Payment Provider

```json
{
  "merchantId": "merchant-123",
  "amount": 50000,
  "currency": "USD",
  "paymentMethodToken": "tok_abc123",
  "externalReference": "order-ref-456",
  "idempotencyReference": "idem-789"
}
```

| Campo                  | Tipo     | Descripción |
|------------------------|----------|-------------|
| `merchantId`           | `string` | Identificador del comercio |
| `amount`               | `number` | Monto en **centavos** (unidad mínima de la moneda) |
| `currency`             | `string` | Código ISO 4217 (`USD`, `EUR`, etc.) |
| `paymentMethodToken`   | `string` | Token opaco del método de pago |
| `externalReference`    | `string` | Referencia interna del comercio |
| `idempotencyReference` | `string` | Referencia de idempotencia del orquestador hacia el proveedor |

#### Response del Payment Provider

```json
{
  "providerPaymentId": "pp_12345",
  "status": "APPROVED",
  "reasonCode": null
}
```

| Campo               | Tipo     | Descripción |
|---------------------|----------|-------------|
| `providerPaymentId` | `string` | ID único de la transacción en el proveedor |
| `status`            | `string` | `APPROVED` \| `REJECTED` \| `ERROR` |
| `reasonCode`        | `string` \| `null` | Presente en `REJECTED` y `ERROR` |

---

## Reglas del mock (obligatorio)

Los montos están en **centavos**. Ejemplo: `100000` = `1000.00` en la moneda usada.

| Condición           | `status`   | `reasonCode`                |
|---------------------|------------|-----------------------------|
| `amount <= 100000`  | `APPROVED` | `null`                      |
| `amount > 100000`   | `REJECTED` | `INSUFFICIENT_FUNDS`        |
| `amount == 999900`  | `ERROR`    | `PROVIDER_INTERNAL_ERROR`   |

> La regla `amount == 999900` tiene prioridad sobre `amount > 100000` cuando ambas aplicarían.

### Ejemplos

| Monto (centavos) | Resultado  | reasonCode                |
|------------------|------------|---------------------------|
| `50000`          | `APPROVED` | —                         |
| `100000`         | `APPROVED` | —                         |
| `100001`         | `REJECTED` | `INSUFFICIENT_FUNDS`      |
| `999900`         | `ERROR`    | `PROVIDER_INTERNAL_ERROR` |

---

## Comportamiento del adapter ante cada status

| Status del proveedor | Acción del orquestador |
|----------------------|------------------------|
| `APPROVED`           | Actualizar pago a `APPROVED`; guardar `providerPaymentId` |
| `REJECTED`           | Actualizar pago a `REJECTED`; guardar `reasonCode` |
| `ERROR`              | Actualizar pago a `FAILED` (interno); guardar `reasonCode`; exponer `ERROR` en la API pública |

---

## Fuera de alcance

| Tema | Notas |
|------|-------|
| Tokenización real | Responsabilidad del merchant / upstream |
| Vault / VGS | Solo conceptual en producción |
| Proveedor real | Usar mock con reglas de esta doc |
| Timeout del proveedor | No obligatorio; si se implementa, documentar la decisión en el README |

---

## Entregables obligatorios (referencia cruzada)

- Endpoint de creación de pago
- Endpoint de consulta de pago
- Idempotencia
- **Proveedor simulado** (este documento)
- Persistencia
- Tests
- Docker Compose
- README
