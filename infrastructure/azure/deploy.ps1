# In2IT ERP - Azure Deployment Script (PowerShell)
param(
    [string]$ResourceGroup = "rg-in2it-erp-prod",
    [string]$Location = "eastus",
    [string]$DbAdminUser = "in2itadmin",
    [string]$DbAdminPassword = ""
)

$ErrorActionPreference = "Stop"

Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "  In2IT ERP - Azure Cloud Provisioning Tool  " -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan

if (-not $DbAdminPassword) {
    $DbAdminPassword = Read-Host "Enter PostgreSQL Administrator Password" -AsSecureString
    $BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($DbAdminPassword)
    $DbAdminPassword = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
}

# 1. Ensure Resource Group exists
Write-Host "`n1. Verifying Azure Resource Group: $ResourceGroup..." -ForegroundColor Yellow
az group create --name $ResourceGroup --location $Location --output none

# 2. Deploy Bicep template
Write-Host "2. Deploying Azure Infrastructure via Bicep..." -ForegroundColor Yellow
$deployResult = az deployment group create `
    --resource-group $ResourceGroup `
    --template-file ./infrastructure/azure/azure-deploy.bicep `
    --parameters dbAdminUser=$DbAdminUser dbAdminPassword=$DbAdminPassword `
    --output json | ConvertFrom-Json

$backendUrl = $deployResult.properties.outputs.backendUrl.value
$frontendUrl = $deployResult.properties.outputs.frontendUrl.value
$postgresHost = $deployResult.properties.outputs.postgresHost.value

Write-Host "`n Deployment Successful!" -ForegroundColor Green
Write-Host "   Backend API URL:  $backendUrl"
Write-Host "   Frontend Web URL: $frontendUrl"
Write-Host "   PostgreSQL Host:  $postgresHost"
Write-Host "`nNext Step: Run migration script to move local SQLite records to Azure PostgreSQL:"
Write-Host "   python infrastructure/azure/migrate-to-postgres.py --postgres postgresql://${DbAdminUser}:${DbAdminPassword}@${postgresHost}:5432/in2it_erp"
