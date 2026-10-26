# In2IT ERP - Deployment & Operations Guide

This guide covers running the application locally with SQLite, migrating data to PostgreSQL, and hosting the production stack on Microsoft Azure.

---

## 1. Local Development (SQLite)

### Backend Setup
1. Open a terminal in `backend/`:
   ```bash
   cd backend
   python -m venv venv
   # On Windows:
   .\venv\Scripts\activate
   # On Linux/macOS:
   source venv/bin/activate
   pip install -e .
   ```
2. Start the FastAPI development server:
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```
   *The database `in2it_erp.db` will be created automatically, and default seeds (roles, permissions, admin user, applications) will populate on first start.*
   - API Docs: `http://localhost:8000/docs`
   - Default Admin: `admin@in2it.com` / `admin123`

### Frontend Setup
1. Open a terminal in `frontend/`:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
2. Access the portal at `http://localhost:5173`.

---

## 2. Migrating from SQLite to PostgreSQL

When ready to graduate from SQLite to PostgreSQL:

### Step 1: Install PostgreSQL Driver
```bash
pip install asyncpg psycopg2-binary
```

### Step 2: Run Data Migration Script
Execute the included migration script to copy all tables, schema definitions, and records:
```bash
python infrastructure/azure/migrate-to-postgres.py \
  --sqlite sqlite:///./backend/in2it_erp.db \
  --postgres postgresql://user:password@localhost:5432/in2it_erp
```

### Step 3: Switch Database Connection
Update `DATABASE_URL` in `.env`:
```env
DATABASE_URL=postgresql+asyncpg://user:password@localhost:5432/in2it_erp
```

### Step 4: Run Alembic Migrations
```bash
cd backend
alembic upgrade head
```

---

## 3. Hosting on Microsoft Azure

### Option A: Automated Provisioning via Bicep (Recommended)

1. Sign in to Azure CLI:
   ```bash
   az login
   az account set --subscription "<YOUR_SUBSCRIPTION_ID>"
   ```

2. Execute the PowerShell provisioning script:
   ```powershell
   ./infrastructure/azure/deploy.ps1 -ResourceGroup "rg-in2it-erp-prod" -Location "eastus"
   ```

This script automatically provisions:
- **Azure App Service Plan (Linux)**
- **Azure Database for PostgreSQL Flexible Server** (with automated backups & firewall rule)
- **FastAPI Backend App Service**
- **React Frontend Web App**

---

### Option B: Azure Container Apps / Docker

To deploy using container images:
1. Build and push images to Azure Container Registry (ACR):
   ```bash
   az acr build --registry <MY_REGISTRY> --image in2it-backend:latest -f infrastructure/Dockerfile.backend backend/
   az acr build --registry <MY_REGISTRY> --image in2it-frontend:latest -f infrastructure/Dockerfile.frontend frontend/
   ```
2. Deploy to Azure Container Apps with environment variables matching `.env.example`.
