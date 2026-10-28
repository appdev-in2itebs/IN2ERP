// In2IT ERP - Azure infrastructure (UNVALIDATED: not yet compiled or deployed; see docs/deployment.md)
//
// - PostgreSQL Flexible Server reachable only from the app's private subnet (no public access)
// - Key Vault (RBAC) holds the signing keys and database URL; the backend reads them through
//   Key Vault references using its system-assigned managed identity
// - Both apps run containers from an existing Azure Container Registry, pulled with managed identity
// - The frontend container (nginx) serves the SPA and proxies /api to the backend, so the
//   API is same-origin and the refresh-token cookie stays SameSite=Strict
// - HTTPS only, TLS 1.2+, FTP disabled, Application Insights + Log Analytics

@description('Short application name used in resource names')
param appName string = 'in2it-erp'
param environment string = 'prod'
param location string = resourceGroup().location

@description('Existing Azure Container Registry name holding the images')
param acrName string
@description('Backend image, e.g. in2erp-backend:2.0.0')
param backendImage string
@description('Frontend image, e.g. in2erp-frontend:2.0.0')
param frontendImage string

param dbAdminUser string = 'in2itadmin'
@secure()
param dbAdminPassword string
@secure()
@description('Random value, at least 32 characters')
param jwtSecretKey string
@secure()
@description('Random value, at least 32 characters')
param appSecretKey string

@description('Microsoft Entra configuration (non-secret identifiers)')
param entraTenantId string
param entraSpaClientId string
param entraApiClientId string
@description('JSON array of break-glass administrator emails, e.g. ["admin@contoso.com"]')
param breakGlassEmailsJson string = '[]'

param appServiceSku string = 'P0v3'

var suffix = uniqueString(resourceGroup().id)
var planName = '${appName}-${environment}-plan'
var backendName = '${appName}-api-${suffix}'
var frontendName = '${appName}-web-${suffix}'
var postgresName = '${appName}-psql-${suffix}'
var vaultName = take('${appName}-kv-${suffix}', 24)
var databaseName = 'in2it_erp'
var frontendOrigin = 'https://${frontendName}.azurewebsites.net'
var kvSecretsUserRole = '4633458b-17de-408a-b874-0445c86b69e6'
var acrPullRole = '7f951dff-4ed1-466d-b4a5-6ca7e7ba3b7b'

// ── Monitoring ──
resource logs 'Microsoft.OperationalInsights/workspaces@2022-10-01' = {
  name: '${appName}-${environment}-logs'
  location: location
  properties: {
    sku: { name: 'PerGB2018' }
    retentionInDays: 90
  }
}

resource insights 'Microsoft.Insights/components@2020-02-02' = {
  name: '${appName}-${environment}-ai'
  location: location
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logs.id
  }
}

// ── Network: app integration subnet + delegated PostgreSQL subnet ──
resource vnet 'Microsoft.Network/virtualNetworks@2023-05-01' = {
  name: '${appName}-${environment}-vnet'
  location: location
  properties: {
    addressSpace: { addressPrefixes: ['10.20.0.0/16'] }
    subnets: [
      {
        name: 'app'
        properties: {
          addressPrefix: '10.20.1.0/24'
          delegations: [{ name: 'web', properties: { serviceName: 'Microsoft.Web/serverFarms' } }]
        }
      }
      {
        name: 'postgres'
        properties: {
          addressPrefix: '10.20.2.0/24'
          delegations: [{ name: 'psql', properties: { serviceName: 'Microsoft.DBforPostgreSQL/flexibleServers' } }]
        }
      }
    ]
  }
}

resource postgresDns 'Microsoft.Network/privateDnsZones@2020-06-01' = {
  name: '${postgresName}.private.postgres.database.azure.com'
  location: 'global'
}

resource postgresDnsLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2020-06-01' = {
  parent: postgresDns
  name: 'vnet-link'
  location: 'global'
  properties: {
    registrationEnabled: false
    virtualNetwork: { id: vnet.id }
  }
}

// ── PostgreSQL (private access only) ──
resource postgres 'Microsoft.DBforPostgreSQL/flexibleServers@2023-06-01-preview' = {
  name: postgresName
  location: location
  sku: { name: 'Standard_B1ms', tier: 'Burstable' }
  properties: {
    version: '16'
    administratorLogin: dbAdminUser
    administratorLoginPassword: dbAdminPassword
    storage: { storageSizeGB: 32, autoGrow: 'Enabled' }
    backup: { backupRetentionDays: 14, geoRedundantBackup: 'Disabled' }
    highAvailability: { mode: 'Disabled' }
    network: {
      delegatedSubnetResourceId: vnet.properties.subnets[1].id
      privateDnsZoneArmResourceId: postgresDns.id
    }
  }
  dependsOn: [postgresDnsLink]
}

resource postgresDatabase 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2023-06-01-preview' = {
  parent: postgres
  name: databaseName
  properties: { charset: 'UTF8', collation: 'en_US.utf8' }
}

// ── Key Vault ──
resource vault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: vaultName
  location: location
  properties: {
    tenantId: subscription().tenantId
    sku: { family: 'A', name: 'standard' }
    enableRbacAuthorization: true
    enableSoftDelete: true
    enablePurgeProtection: true
  }
}

resource jwtSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: vault
  name: 'jwt-secret-key'
  properties: { value: jwtSecretKey }
}

resource appSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: vault
  name: 'app-secret-key'
  properties: { value: appSecretKey }
}

resource databaseUrlSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: vault
  name: 'database-url'
  properties: {
    value: 'postgresql+asyncpg://${dbAdminUser}:${dbAdminPassword}@${postgres.properties.fullyQualifiedDomainName}:5432/${databaseName}?ssl=require'
  }
}

resource acr 'Microsoft.ContainerRegistry/registries@2023-07-01' existing = {
  name: acrName
}

// ── App Service ──
resource plan 'Microsoft.Web/serverfarms@2023-01-01' = {
  name: planName
  location: location
  kind: 'linux'
  properties: { reserved: true }
  sku: { name: appServiceSku }
}

var siteBase = {
  httpsOnly: true
  virtualNetworkSubnetId: vnet.properties.subnets[0].id
}

resource backend 'Microsoft.Web/sites@2023-01-01' = {
  name: backendName
  location: location
  identity: { type: 'SystemAssigned' }
  properties: union(siteBase, {
    serverFarmId: plan.id
    keyVaultReferenceIdentity: 'SystemAssigned'
    siteConfig: {
      linuxFxVersion: 'DOCKER|${acr.properties.loginServer}/${backendImage}'
      acrUseManagedIdentityCreds: true
      vnetRouteAllEnabled: true
      minTlsVersion: '1.2'
      ftpsState: 'Disabled'
      http20Enabled: true
      healthCheckPath: '/health'
      appSettings: [
        { name: 'WEBSITES_PORT', value: '8000' }
        { name: 'APP_ENV', value: 'production' }
        { name: 'DEBUG', value: 'false' }
        { name: 'JWT_SECRET_KEY', value: '@Microsoft.KeyVault(SecretUri=${jwtSecret.properties.secretUri})' }
        { name: 'SECRET_KEY', value: '@Microsoft.KeyVault(SecretUri=${appSecret.properties.secretUri})' }
        { name: 'DATABASE_URL', value: '@Microsoft.KeyVault(SecretUri=${databaseUrlSecret.properties.secretUri})' }
        { name: 'CORS_ORIGINS', value: '["${frontendOrigin}"]' }
        { name: 'TRUST_PROXY_HEADERS', value: 'true' }
        { name: 'SEED_ON_STARTUP', value: 'false' }
        { name: 'ENTRA_TENANT_ID', value: entraTenantId }
        { name: 'ENTRA_SPA_CLIENT_ID', value: entraSpaClientId }
        { name: 'ENTRA_API_CLIENT_ID', value: entraApiClientId }
        { name: 'LOCAL_AUTH_MODE', value: 'break_glass_only' }
        { name: 'BREAK_GLASS_EMAILS', value: breakGlassEmailsJson }
        { name: 'APPLICATIONINSIGHTS_CONNECTION_STRING', value: insights.properties.ConnectionString }
      ]
    }
  })
}

resource frontend 'Microsoft.Web/sites@2023-01-01' = {
  name: frontendName
  location: location
  identity: { type: 'SystemAssigned' }
  properties: union(siteBase, {
    serverFarmId: plan.id
    siteConfig: {
      linuxFxVersion: 'DOCKER|${acr.properties.loginServer}/${frontendImage}'
      acrUseManagedIdentityCreds: true
      minTlsVersion: '1.2'
      ftpsState: 'Disabled'
      http20Enabled: true
      appSettings: [
        { name: 'WEBSITES_PORT', value: '8080' }
        { name: 'API_UPSTREAM', value: 'https://${backend.properties.defaultHostName}' }
        { name: 'API_HOST', value: backend.properties.defaultHostName }
        { name: 'APPLICATIONINSIGHTS_CONNECTION_STRING', value: insights.properties.ConnectionString }
      ]
    }
  })
}

// ── Role assignments: Key Vault secrets for the backend; image pulls for both apps ──
resource backendVaultAccess 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: vault
  name: guid(vault.id, backend.id, kvSecretsUserRole)
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', kvSecretsUserRole)
    principalId: backend.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

resource backendAcrPull 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: acr
  name: guid(acr.id, backend.id, acrPullRole)
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', acrPullRole)
    principalId: backend.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

resource frontendAcrPull 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: acr
  name: guid(acr.id, frontend.id, acrPullRole)
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', acrPullRole)
    principalId: frontend.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

output frontendUrl string = frontendOrigin
output backendUrl string = 'https://${backend.properties.defaultHostName}'
output keyVaultName string = vault.name
output postgresHost string = postgres.properties.fullyQualifiedDomainName
