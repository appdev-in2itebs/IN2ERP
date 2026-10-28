# In2IT ERP - Azure provisioning (PowerShell)
#
# Previews by default (what-if). Pass -Apply to deploy. Never prints secrets.
# Prerequisites: az login; an Azure Container Registry with the two images pushed;
# Entra app registrations created (docs/entra-setup.md).
param(
    [Parameter(Mandatory)] [string]$ResourceGroup,
    [Parameter(Mandatory)] [string]$Location,
    [Parameter(Mandatory)] [string]$AcrName,
    [Parameter(Mandatory)] [string]$BackendImage,
    [Parameter(Mandatory)] [string]$FrontendImage,
    [Parameter(Mandatory)] [string]$EntraTenantId,
    [Parameter(Mandatory)] [string]$EntraSpaClientId,
    [Parameter(Mandatory)] [string]$EntraApiClientId,
    [string]$BreakGlassEmailsJson = '[]',
    [switch]$Apply
)

$ErrorActionPreference = "Stop"

function New-RandomSecret {
    $bytes = New-Object byte[] 48
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    [Convert]::ToBase64String($bytes)
}

$securePassword = Read-Host "PostgreSQL administrator password" -AsSecureString
$dbPassword = [System.Net.NetworkCredential]::new('', $securePassword).Password

$params = @(
    "acrName=$AcrName", "backendImage=$BackendImage", "frontendImage=$FrontendImage",
    "dbAdminPassword=$dbPassword", "jwtSecretKey=$(New-RandomSecret)", "appSecretKey=$(New-RandomSecret)",
    "entraTenantId=$EntraTenantId", "entraSpaClientId=$EntraSpaClientId",
    "entraApiClientId=$EntraApiClientId", "breakGlassEmailsJson=$BreakGlassEmailsJson"
)

az group create --name $ResourceGroup --location $Location --output none

if (-not $Apply) {
    Write-Host "Previewing changes (what-if). Re-run with -Apply to deploy." -ForegroundColor Yellow
    az deployment group what-if --resource-group $ResourceGroup `
        --template-file ./infrastructure/azure/azure-deploy.bicep --parameters $params
    return
}

az deployment group create --resource-group $ResourceGroup `
    --template-file ./infrastructure/azure/azure-deploy.bicep --parameters $params `
    --query "properties.outputs" --output json

Write-Host "Next: run 'alembic upgrade head' against the new database from inside the VNet." -ForegroundColor Cyan
Write-Host "See docs/deployment.md."
