#!/usr/bin/env bash
# Fire parallel POST /payments/create requests to exercise idempotency / lock races.
set -euo pipefail

ORDER_ID="${1:-race-$(date +%s)}"
CONCURRENCY="${2:-20}"
API_KEY="${API_KEY:-your-api-key}"
BASE="${BASE:-http://localhost:3000}"
AMOUNT="${AMOUNT:-50000}"

tmpdir=$(mktemp -d)
trap 'rm -rf "$tmpdir"' EXIT

echo "orderId=${ORDER_ID} concurrency=${CONCURRENCY} amount=${AMOUNT}"
echo "POST ${BASE}/payments/create/${ORDER_ID}"
echo "---"

for i in $(seq 1 "$CONCURRENCY"); do
  (
    code=$(curl -s -o "$tmpdir/$i.json" -w "%{http_code}" \
      -X POST "${BASE}/payments/create/${ORDER_ID}" \
      -H "X-Api-Key: ${API_KEY}" \
      -H "Content-Type: application/json" \
      -d "{\"paymentMethodToken\":\"tok_test\",\"amount\":${AMOUNT}}")
    echo "request ${i}: HTTP ${code}"
    cat "$tmpdir/$i.json" | jq -c . 2>/dev/null || cat "$tmpdir/$i.json"
    echo
    if [ "$code" != "200" ] && [ "$code" != "409" ]; then
      cat "$tmpdir/$i.json"
      echo
    fi
  ) &
done
wait


echo ""
echo "Expect mostly HTTP 200 (same payment) and sometimes 409 PAYMENT_IN_PROGRESS."
echo "Verify one row in Postgres:"
echo "  SELECT * FROM orders WHERE \"orderId\" = '${ORDER_ID}' AND amount = ${AMOUNT};"
