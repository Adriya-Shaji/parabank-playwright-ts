#!/usr/bin/env bash

set -u

BASE_URL="${PARABANK_URL:-http://localhost:8080/parabank}"
MAX_ATTEMPTS=30
SLEEP_SECONDS=5

initialize_status=""

for i in $(seq 1 "$MAX_ATTEMPTS"); do
  initialize_status=$(curl -s -o /dev/null -w "%{http_code}" -m 10 \
    -X POST \
    "$BASE_URL/services/bank/initializeDB" || true)

  echo "Initialize attempt $i: HTTP $initialize_status"

  if [ "$initialize_status" = "204" ]; then
    echo "Database initialization succeeded"
    break
  fi

  sleep "$SLEEP_SECONDS"
done

if [ "$initialize_status" != "204" ]; then
  echo "ERROR: ParaBank database did not initialize after $MAX_ATTEMPTS attempts"
  exit 1
fi

login_status=""

for i in $(seq 1 "$MAX_ATTEMPTS"); do
  login_status=$(curl -s -o /dev/null -w "%{http_code}" -m 10 \
    "$BASE_URL/services/bank/login/john/demo" || true)

  echo "Login probe attempt $i: HTTP $login_status"

  if [ "$login_status" = "200" ]; then
    echo "ParaBank is ready"
    exit 0
  fi

  sleep "$SLEEP_SECONDS"
done

echo "ERROR: seeded login did not become ready after $MAX_ATTEMPTS attempts"
exit 1
