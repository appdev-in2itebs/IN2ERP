#!/bin/bash
# In2IT ERP - Azure provisioning (Bash / Azure Cloud Shell)
#
# Previews by default (what-if). Pass --apply to deploy. Never prints secrets.
# Prerequisites: az login; an Azure Container Registry with the two images pushed;
# Entra app registrations created (docs/entra-setup.md).
#
#   export ACR_NAME=... BACKEND_IMAGE=in2erp-backend:2.0.0 FRONTEND_IMAGE=in2erp-frontend:2.0.0
#   export ENTRA_TENANT_ID=... ENTRA_SPA_CLIENT_ID=... ENTRA_API_CLIENT_ID=...
#   export BREAK_GLASS_EMAILS='["breakglass@contoso.com"]'
#   ./infrastructure/azure/deploy.sh rg-in2it-erp-prod centralindia [--apply]
set -euo pipefail

RESOURCE_GROUP="${1:?resource group}"
LOCATION="${2:?location}"
MODE="${3:-}"

: "${ACR_NAME:?}" "${BACKEND_IMAGE:?}" "${FRONTEND_IMAGE:?}"
: "${ENTRA_TENANT_ID:?}" "${ENTRA_SPA_CLIENT_ID:?}" "${ENTRA_API_CLIENT_ID:?}"

if [ -z "${DB_ADMIN_PASSWORD:-}" ]; then
  read -r -s -p "PostgreSQL administrator password: " DB_ADMIN_PASSWORD; echo
fi
# Signing keys are generated here and stored only in Key Vault.
JWT_SECRET_KEY="${JWT_SECRET_KEY:-$(openssl rand -base64 48)}"
APP_SECRET_KEY="${APP_SECRET_KEY:-$(openssl rand -base64 48)}"

PARAMS=(
  acrName="$ACR_NAME" backendImage="$BACKEND_IMAGE" frontendImage="$FRONTEND_IMAGE"
  dbAdminPassword="$DB_ADMIN_PASSWORD" jwtSecretKey="$JWT_SECRET_KEY" appSecretKey="$APP_SECRET_KEY"
  entraTenantId="$ENTRA_TENANT_ID" entraSpaClientId="$ENTRA_SPA_CLIENT_ID"
  entraApiClientId="$ENTRA_API_CLIENT_ID" breakGlassEmailsJson="${BREAK_GLASS_EMAILS:-[]}"
)

az group create --name "$RESOURCE_GROUP" --location "$LOCATION" --output none

if [ "$MODE" != "--apply" ]; then
  echo "Previewing changes (what-if). Re-run with --apply to deploy."
  az deployment group what-if --resource-group "$RESOURCE_GROUP" \
    --template-file ./infrastructure/azure/azure-deploy.bicep --parameters "${PARAMS[@]}"
  exit 0
fi

az deployment group create --resource-group "$RESOURCE_GROUP" \
  --template-file ./infrastructure/azure/azure-deploy.bicep --parameters "${PARAMS[@]}" \
  --query "properties.outputs" --output json

echo "Next: run 'alembic upgrade head' against the new database from inside the VNet"
echo "(e.g. an App Service SSH session on the backend). See docs/deployment.md."
