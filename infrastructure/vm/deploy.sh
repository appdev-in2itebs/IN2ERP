#!/usr/bin/env bash
# Runs on the VM, called by .github/workflows/deploy-azure-vm.yml over SSH.
# Reads the GHCR token on stdin. Backs up the database, migrates, then rolls out the new images.
#   IMAGE_PREFIX=ghcr.io/<owner>/in2erp IMAGE_TAG=<sha> GHCR_USER=<user> bash deploy.sh < token
# SKIP_PULL=1 deploys images already present on the VM (built locally); no token needed.
set -euo pipefail
cd "$(dirname "$0")"
: "${IMAGE_PREFIX:?}" "${IMAGE_TAG:?}"
export IMAGE_PREFIX IMAGE_TAG

if [ ! -f .env ]; then
  echo "[deploy] /opt/in2erp/.env is missing. Run setup-vm.sh on the VM first." >&2
  exit 1
fi

compose() { docker compose -f docker-compose.prod.yml --env-file .env "$@"; }

HTTP_PORT=$(grep -E '^HTTP_PORT=' .env | cut -d= -f2 || true)
HTTP_PORT=${HTTP_PORT:-8091}

if [ "${SKIP_PULL:-}" != "1" ]; then
  : "${GHCR_USER:?}"
  echo "[deploy] pulling images for $IMAGE_TAG"
  docker login ghcr.io -u "$GHCR_USER" --password-stdin >/dev/null
  trap 'docker logout ghcr.io >/dev/null 2>&1 || true' EXIT
  compose pull backend frontend
  docker logout ghcr.io >/dev/null
fi

echo "[deploy] backing up the database"
compose up -d --wait postgres
mkdir -p backups
compose exec -T postgres pg_dump -U erpuser -d in2it_erp -Fc > "backups/in2it_erp-$(date -u +%Y%m%dT%H%M%SZ)-${IMAGE_TAG:0:12}.dump"
ls -1t backups/*.dump 2>/dev/null | tail -n +15 | xargs -r rm -f   # keep the 14 most recent

echo "[deploy] applying migrations"
compose run --rm migrate

echo "[deploy] starting services"
compose up -d --remove-orphans

echo "[deploy] waiting for health"
for _ in $(seq 1 30); do
  if compose exec -T backend curl -fsS http://127.0.0.1:8000/health >/dev/null 2>&1 \
     && curl -fsS "http://127.0.0.1:$HTTP_PORT/health" >/dev/null 2>&1; then
    echo "$IMAGE_TAG" > .deployed-tag
    docker image prune -f --filter "label=org.opencontainers.image.source" >/dev/null
    echo "[deploy] $IMAGE_TAG is live"
    exit 0
  fi
  sleep 4
done

echo "[deploy] health check failed; recent backend logs:" >&2
compose logs --tail 80 backend >&2
exit 1
