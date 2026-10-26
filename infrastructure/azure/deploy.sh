#!/bin/bash
# In2IT ERP - Azure Cloud Provisioning Script (Bash / Azure Cloud Shell)
set -euo pipefail

RESOURCE_GROUP="${1:-rg-in2it-erp-prod}"
LOCATION="${2:-eastus}"
DB_ADMIN_USER="${3:-in2itadmin}"

echo "============================================="
echo "  In2IT ERP - Azure Cloud Provisioning Tool  "
echo "============================================="

if [ -z "${DB_ADMIN_PASSWORD:-}" ]; then
  read -s -p "Enter PostgreSQL Administrator Password: " DB_ADMIN_PASSWORD
  echo ""
fi

# 1. Create Resource Group
echo "1. Creating Resource Group: ${RESOURCE_GROUP}..."
az group create --name "${RESOURCE_GROUP}" --location "${LOCATION}" --output none

# 2. Deploy Bicep template
echo "2. Deploying Bicep Template..."
DEPLOY_OUTPUT=$(az deployment group create \
  --resource-group "${RESOURCE_GROUP}" \
  --template-file ./infrastructure/azure/azure-deploy.bicep \
  --parameters dbAdminUser="${DB_ADMIN_USER}" dbAdminPassword="${DB_ADMIN_PASSWORD}" \
  --output json)

BACKEND_URL=$(echo "${DEPLOY_OUTPUT}" | jq -r '.properties.outputs.backendUrl.value')
FRONTEND_URL=$(echo "${DEPLOY_OUTPUT}" | jq -r '.properties.outputs.frontendUrl.value')
POSTGRES_HOST=$(echo "${DEPLOY_OUTPUT}" | jq -r '.properties.outputs.postgresHost.value')

echo ""
echo "✅ Provisioning Complete!"
echo "   Backend URL:  ${BACKEND_URL}"
echo "   Frontend URL: ${FRONTEND_URL}"
echo "   Postgres DB:  ${POSTGRES_HOST}"
echo ""
echo "Next step: Run data migration from local SQLite to Azure PostgreSQL:"
echo "   python infrastructure/azure/migrate-to-postgres.py --postgres postgresql://${DB_ADMIN_USER}:${DB_ADMIN_PASSWORD}@${POSTGRES_HOST}:5432/in2it_erp"
