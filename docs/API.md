# Payment Orchestrator — API

Documentación de la API pública del Payment Orchestrator, basada en el [Design Document](https://yummysuperapp.notion.site/Design-Document-3618380c875580518b3bf3280c0e626c).

---

## Autenticación

El servicio es interno: lo consumen otros microservicios. La autenticación es por API key en el header:

```http
X-Api-Key: your-api-key
```

No es necesario implementar lógica de autenticación ni autorización; asumir que el API key llega válido (supuesto SA-03).

---

## Endpoints

### Crear pago

Crea un pago de forma **síncrona** (RF-01).

```http
POST /payments/create/:orderId
```

#### Path parameters

| Parámetro  | Descripción                          |
|------------|--------------------------------------|
| `orderId`  | Identificador de negocio de la orden |

#### Headers

| Header       | Requerido | Descripción        |
|--------------|-----------|--------------------|
| `X-Api-Key`  | Sí        | API key del caller (usado como `merchantId` hacia el proveedor) |
| `Content-Type` | Sí      | `application/json` |

#### Request body

```json
{
  "paymentMethodToken": "string",
  "amount": 10000
}
```

| Campo                 | Tipo     | Descripción                                      |
|-----------------------|----------|--------------------------------------------------|
| `paymentMethodToken`  | `string` | Token opaco del método de pago (generado upstream) |
| `amount`              | `number` | Monto del pago en **centavos** (ej. `10000` = 100.00 USD) |

> El servicio **nunca** recibe PAN, CVV ni datos sensibles de tarjeta (RNF-01). Moneda fija: **USD**.

#### Response `200 OK`

```json
{
  "amount": 10000,
  "status": "PENDING",
  "reasonCode": "",
  "reason": "",
  "referenceNumber": 123456
}
```

| Campo              | Tipo     | Descripción |
|--------------------|----------|-------------|
| `amount`           | `number` | Monto procesado |
| `status`           | `string` | `PENDING` \| `APPROVED` \| `REJECTED` \| `ERROR` |
| `reasonCode`       | `string` | Código de razón (si aplica) |
| `reason`           | `string` | Descripción legible |
| `referenceNumber`  | `number` | Opcional — referencia del proveedor u orden (SA-06) |

---

### Consultar pago por orderId

Obtiene el estado de un pago asociado a una orden.

```http
GET /payments/:orderId
```

#### Path parameters

| Parámetro  | Descripción                          |
|------------|--------------------------------------|
| `orderId`  | Identificador de negocio de la orden |

#### Headers

| Header      | Requerido | Descripción        |
|-------------|-----------|--------------------|
| `X-Api-Key` | Sí        | API key del caller |

#### Response `200 OK`

```json
{
  "status": "APPROVED",
  "reasonCode": "",
  "reason": "",
  "retries": 0,
  "referenceNumber": 123456
}
```

| Campo             | Tipo     | Descripción |
|-------------------|----------|-------------|
| `status`          | `string` | `PENDING` \| `APPROVED` \| `REJECTED` \| `ERROR` |
| `reasonCode`      | `string` | Código de razón |
| `reason`          | `string` | Descripción legible |
| `retries`         | `number` | Cantidad de reintentos internos (RF-02) |
| `referenceNumber` | `number` | Opcional |

> Pagos en estado terminal (`APPROVED`, `REJECTED`, `ERROR`) pueden servirse desde caché Redis tras el primer GET (TTL 24 h). Pagos en curso (`PENDING`) se leen siempre de Postgres.

---

## Estados del pago

Flujo de estados internos:

```
CREATED → PENDING → APPROVED | REJECTED | ERROR
```

| Estado     | Terminal | Descripción |
|------------|----------|-------------|
| `CREATED`  | No       | Pago registrado, aún no enviado al proveedor |
| `PENDING`  | No       | En proceso o esperando resultado |
| `APPROVED` | Sí       | Pago aprobado |
| `REJECTED` | Sí       | Pago rechazado por el proveedor |
| `ERROR`    | Sí       | Error al procesar (proveedor o interno) |

---

## Idempotencia

- **Un request por cobro** — cada intento de cobro debe usar una clave de idempotencia distinta.
- **Múltiples pagos por orden** — una misma `orderId` puede tener varios intentos de pago.

| Escenario | Comportamiento esperado |
|-----------|-------------------------|
| Varias veces al botón de pagar (misma clave) | Devolver `PENDING` (o el mismo resultado en curso) en peticiones secundarias |
| Varias solicitudes por Postman (misma clave) | Sin cobro duplicado |
| Pago exitoso, cliente reintenta notificación | Devolver el estado final almacenado |

---

## Modelo de datos (referencia)

### Entidad: Order

| Campo              | Tipo       | Descripción |
|--------------------|------------|-------------|
| `id`               | string/uuid | PK interna |
| `merchantId`       | string     | Comercio |
| `amount`           | number     | Monto |
| `orderId`          | string     | ID de negocio |
| `status`           | string     | Estado del pago |
| `reasonCode`       | string     | Código de razón |
| `reason`           | string     | Descripción |
| `reference`        | string     | Referencia |
| `currency`         | string     | ISO 4217 (ej. `USD`) |
| `idempotencyValue` | string     | Clave de idempotencia |
| `retries`          | number     | Reintentos internos |
| `createdAt`        | datetime   | |
| `updatedAt`        | datetime   | |

---

## Supuestos de diseño

| ID    | Supuesto |
|-------|----------|
| SA-01 | `paymentMethodToken` ya fue generado upstream y llega válido |
| SA-02 | Vault (detokenización) es inmediato — no se implementa en este ejercicio |
| SA-03 | API key siempre válido |
| SA-04 | Moneda única por pago; sin tasa de cambio hacia el proveedor |
| SA-05 | Respuestas en un solo idioma |
| SA-06 | `referenceNumber` puede venir en la respuesta |

---

## Seguridad y observabilidad

### Seguridad

- No almacenar ni exponer datos sensibles de tarjeta.
- En errores: exponer al caller solo información mapeada (`reasonCode`, `reason`); detalles internos del proveedor quedan en logs/métricas.
- **No registrar** en logs: `paymentMethodToken`, `X-Api-Key`.

### Observabilidad

| Área     | Guía |
|----------|------|
| Métricas | Contadores por `reasonCode`; métricas operativas |
| Alertas  | Pico de % de rechazos en una ventana de tiempo |
| Logs     | Flujos completos sin datos sensibles |

---

## Requerimientos relacionados

| ID    | Descripción |
|-------|-------------|
| RF-01 | Crear pago síncrono |
| RF-02 | Reintentos internos ante fallos |
| RF-03 | Persistir transacciones para consolidado contable |
| RF-04 | Idempotencia por cobro; múltiples pagos por orden |
| RNF-01 | No almacenar datos sensibles de tarjeta |

Para el contrato con el Payment Provider simulado, ver [REFERENCIA-SERVICIOS-EXTERNOS.md](./REFERENCIA-SERVICIOS-EXTERNOS.md).
