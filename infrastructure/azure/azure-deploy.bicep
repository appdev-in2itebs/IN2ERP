@description('In2IT ERP Azure Infrastructure Deployment (Bicep)')
param appName string = 'in2it-erp'
param environment string = 'prod'
param location string = resourceGroup().location

@description('PostgreSQL Flexible Server Administrator Login')
param dbAdminUser string = 'in2itadmin'

@secure()
@description('PostgreSQL Flexible Server Administrator Password')
param dbAdminPassword string

@description('App Service SKU')
param sku string = 'B1'

var uniqueSuffix = uniqueString(resourceGroup().id)
var appServicePlanName = '${appName}-${environment}-plan'
var backendAppName = '${appName}-api-${uniqueSuffix}'
var frontendAppName = '${appName}-web-${uniqueSuffix}'
var postgresServerName = '${appName}-psql-${uniqueSuffix}'
var databaseName = 'in2it_erp'

// 1. App Service Plan (Linux)
resource appServicePlan 'Microsoft.Web/serverfarms@2022-09-01' = {
  name: appServicePlanName
  location: location
  kind: 'linux'
  properties: {
    reserved: true
  }
  sku: {
    name: sku
    tier: 'Basic'
  }
}

// 2. Azure Database for PostgreSQL Flexible Server
resource postgresServer 'Microsoft.DBforPostgreSQL/flexibleServers@2023-03-01-preview' = {
  name: postgresServerName
  location: location
  sku: {
    name: 'Standard_B1ms'
    tier: 'Burstable'
  }
  properties: {
    version: '16'
    administratorLogin: dbAdminUser
    administratorLoginPassword: dbAdminPassword
    storage: {
      storageSizeGB: 32
    }
    backup: {
      backupRetentionDays: 7
      geoRedundantBackup: 'Disabled'
    }
    highAvailability: {
      mode: 'Disabled'
    }
  }
}

// Allow Azure services to access PostgreSQL
resource postgresFirewallRule 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2023-03-01-preview' = {
  parent: postgresServer
  name: 'AllowAzureServices'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

// Create In2IT ERP Database
resource postgresDatabase 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2023-03-01-preview' = {
  parent: postgresServer
  name: databaseName
  properties: {
    charset: 'UTF8'
    collation: 'en_US.utf8'
  }
}

// 3. Backend App Service (FastAPI)
resource backendApp 'Microsoft.Web/sites@2022-09-01' = {
  name: backendAppName
  location: location
  properties: {
    serverFarmId: appServicePlan.id
    siteConfig: {
      linuxFxVersion: 'PYTHON|3.11'
      appCommandLine: 'uvicorn app.main:app --host 0.0.0.0 --port 8000'
      appSettings: [
        {
          name: 'APP_NAME'
          value: 'In2IT-ERP'
        }
        {
          name: 'APP_ENV'
          value: 'production'
        }
        {
          name: 'DEBUG'
          value: 'false'
        }
        {
          name: 'DATABASE_URL'
          value: 'postgresql+asyncpg://${dbAdminUser}:${dbAdminPassword}@${postgresServer.properties.fullyQualifiedDomainName}:5432/${databaseName}'
        }
        {
          name: 'CORS_ORIGINS'
          value: '["https://${frontendAppName}.azurewebsites.net"]'
        }
      ]
    }
  }
}

// 4. Frontend App Service (Static / Node)
resource frontendApp 'Microsoft.Web/sites@2022-09-01' = {
  name: frontendAppName
  location: location
  properties: {
    serverFarmId: appServicePlan.id
    siteConfig: {
      linuxFxVersion: 'NODE|20-lts'
      appCommandLine: 'npx serve -s dist -l 80'
    }
  }
}

output backendUrl string = 'https://${backendApp.properties.defaultHostName}'
output frontendUrl string = 'https://${frontendApp.properties.defaultHostName}'
output postgresHost string = postgresServer.properties.fullyQualifiedDomainName
