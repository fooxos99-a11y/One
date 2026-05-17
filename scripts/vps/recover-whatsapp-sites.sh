#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

SITE1_ENV="$ROOT_DIR/deploy/vps/sites/site-1/site.env"
SITE2_ENV="$ROOT_DIR/deploy/vps/sites/site-2/site.env"

require_env_file() {
  local env_file="$1"
  if [ ! -f "$env_file" ]; then
    echo "Missing environment file: $env_file"
    exit 1
  fi
}

restart_or_start_pm2() {
  local process_name="$1"
  shift

  if pm2 describe "$process_name" >/dev/null 2>&1; then
    pm2 restart "$process_name" --update-env
    return
  fi

  pm2 start "$@"
}

require_env_file "$SITE1_ENV"
require_env_file "$SITE2_ENV"

cd "$ROOT_DIR"

restart_or_start_pm2 \
  "habib-site1-app" \
  ./scripts/vps/run-site.sh --name habib-site1-app --interpreter /bin/bash -- app "$SITE1_ENV"

restart_or_start_pm2 \
  "habib-site1-worker" \
  ./scripts/vps/run-site.sh --name habib-site1-worker --interpreter /bin/bash -- worker "$SITE1_ENV"

restart_or_start_pm2 \
  "habib-site2-app" \
  ./scripts/vps/run-site.sh --name habib-site2-app --interpreter /bin/bash -- app "$SITE2_ENV"

restart_or_start_pm2 \
  "habib-site2-worker" \
  ./scripts/vps/run-site.sh --name habib-site2-worker --interpreter /bin/bash -- worker "$SITE2_ENV"

pm2 save
pm2 ls

echo
echo "Recent site-1 worker logs:"
pm2 logs habib-site1-worker --lines 30 --nostream || true

echo
echo "Recent site-2 worker logs:"
pm2 logs habib-site2-worker --lines 30 --nostream || true