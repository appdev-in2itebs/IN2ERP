# In2IT ERP — Enterprise Resource Planning Platform

[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?style=flat&logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.104+-009688?style=flat&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-18.3+-61DAFB?style=flat&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6+-3178C6?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-5.4+-646CFF?style=flat&logo=vite&logoColor=white)](https://vitejs.dev/)
[![SQLite](https://img.shields.io/badge/Database-SQLite%20(Dev)-003B57?style=flat&logo=sqlite&logoColor=white)](https://sqlite.org/)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL%20(Prod)-4169E1?style=flat&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Azure](https://img.shields.io/badge/Hosting-Microsoft%20Azure-0078D4?style=flat&logo=microsoftazure&logoColor=white)](https://azure.microsoft.com/)

An enterprise-grade, modular Resource Planning platform engineered with **FastAPI**, **React (TypeScript)**, dynamic **Role-Based Access Control (RBAC) with per-user permission overrides**, application lifecycle management, and compliance audit trailing.

Designed for rapid local development with **SQLite**, zero-friction migration to **PostgreSQL**, and cloud deployment on **Microsoft Azure**.

---

## 📂 Project Structure

```
in2it-erp/
├── frontend/                     # React + TypeScript + Vite SPA
│   ├── src/
│   │   ├── assets/              # Static media & assets
│   │   ├── components/          # Reusable UI (Sidebar, Navbar, Modals, Badges, etc.)
│   │   ├── layouts/             # AppLayout, AuthLayout
│   │   ├── views/               # Module pages
│   │   │   ├── auth/            # Login & Register views
│   │   │   ├── dashboard/       # Overview KPI metrics & apps launcher
│   │   │   ├── applications/    # ERP business modules catalog & editor
│   │   │   ├── employees/       # Staff directory & role grant drawer
│   │   │   ├── roles/           # RBAC permission matrix & per-user overrides
│   │   │   ├── assignments/     # Employee-to-application access governance
│   │   │   └── audit/           # Immutable compliance event trail
│   │   ├── router/              # Route definitions & permission guards
│   │   ├── stores/              # Auth & Notification contexts
│   │   ├── services/            # Typed API clients & service layers
│   │   ├── composables/         # Custom hooks (useAuth, useNotification)
│   │   ├── types/               # TypeScript interfaces & models
│   │   ├── index.css            # Enterprise Vanilla CSS design system
│   │   └── main.tsx             # Application entry point
│   ├── package.json
│   └── vite.config.ts
├── backend/                      # FastAPI Python Application
│   ├── app/
│   │   ├── api/v1/              # REST API controllers & dependencies
│   │   ├── core/                # Configuration, JWT security, password hashing
│   │   ├── db/                  # Async database engine & seed fixtures
│   │   ├── models/              # SQLAlchemy 2.0 ORM models
│   │   ├── schemas/             # Pydantic v2 schemas
│   │   ├── repositories/        # Data access layers
│   │   ├── services/            # Core business logic services
│   │   └── main.py              # Application factory & lifespan hooks
│   ├── alembic/                 # Database migrations (SQLite batch & PostgreSQL)
│   ├── tests/                   # Pytest test suite
│   ├── alembic.ini
│   └── pyproject.toml
├── infrastructure/               # DevOps & Cloud Provisioning
│   ├── azure/                   # Bicep IaC template & SQLite-to-Postgres migrator
│   ├── Dockerfile.backend       # Multi-stage production Python container
│   ├── Dockerfile.frontend      # Multi-stage production Nginx container
│   ├── docker-compose.yml       # Local multi-container stack
│   └── nginx.conf               # SPA routing & reverse proxy
├── docs/                         # Architecture & Integration Guides
│   ├── architecture.md          # Architectural blueprints & RBAC algorithms
│   ├── entra-setup.md           # Microsoft Entra ID (Azure AD) SSO setup guide
│   ├── application-integration.md # Internal ERP module onboarding guide
│   └── deployment.md            # Local run, PostgreSQL migration & Azure hosting
├── .env.example                 # Environment configuration template
├── .env                         # Local development settings (SQLite default)
└── README.md
```

---

## ⚡ Quick Start (Local Development)

### 1. Prerequisites
- **Python 3.11+**
- **Node.js 18+** & **npm**

### 2. Backend Setup (FastAPI + SQLite)
```bash
# Navigate to backend directory
cd backend

# Create & activate virtual environment
python -m venv venv
.\venv\Scripts\activate   # Windows
# source venv/bin/activate # Linux / macOS

# Install dependencies
pip install -e .

# Run dev server
uvicorn app.main:app --reload --port 8000
```
- Interactive API Documentation: [http://localhost:8000/docs](http://localhost:8000/docs)
- The SQLite database `in2it_erp.db` will be initialized and seeded automatically.

### 🔑 Default Credentials
| Email | Password | Role |
| :--- | :--- | :--- |
| `admin@in2it.com` | `admin123` | **Super Admin** |

---

### 3. Frontend Setup (React + Vite)
```bash
# In a new terminal window:
cd frontend

# Install packages
npm install

# Start Vite dev server
npm run dev
```
- Access the Portal: [http://localhost:5173](http://localhost:5173)

---

## 🛡️ Security & RBAC Model

In2IT ERP incorporates a hybrid security layer:
- **Roles**: Bundles of permissions (Super Admin, Admin, Manager, Employee, Custom Roles).
- **Per-User Overrides**: Explicitly **Grant** or **Deny** individual capabilities for specific employees without altering their broad role assignments.
- **Audit Trails**: Every login, failed attempt, application assignment, or access change is logged with actor email, timestamp, IP address, and payload parameters.

---

## 🔄 Migrating from SQLite to PostgreSQL

When ready to switch to PostgreSQL (locally or in Azure):

1. **Install PostgreSQL drivers**:
   ```bash
   pip install asyncpg psycopg2-binary
   ```

2. **Run the automated data migrator**:
   ```bash
   python infrastructure/azure/migrate-to-postgres.py \
     --sqlite sqlite:///./backend/in2it_erp.db \
     --postgres postgresql://user:password@localhost:5432/in2it_erp
   ```

3. **Update `.env`**:
   ```env
   DATABASE_URL=postgresql+asyncpg://user:password@localhost:5432/in2it_erp
   ```

4. **Run Alembic Migrations**:
   ```bash
   cd backend
   alembic upgrade head
   ```

---

## ☁️ Azure Cloud Deployment

The repository includes a production-ready **Azure Bicep** template and provisioning script:

```powershell
./infrastructure/azure/deploy.ps1 -ResourceGroup "rg-in2it-erp-prod" -Location "eastus"
```

Provisioned Azure Resources:
- **Azure App Service (Linux)**: FastAPI Backend API
- **Azure Static Web App / App Service**: React Frontend
- **Azure Database for PostgreSQL Flexible Server**: Enterprise PostgreSQL with automated backups
- **Firewall Rules & Secure Connection Strings**

Refer to [docs/deployment.md](docs/deployment.md) for full instructions.

---

## 📚 Documentation
- [Architecture Blueprint & Data Flows](docs/architecture.md)
- [Microsoft Entra ID (Azure AD) SSO Setup Guide](docs/entra-setup.md)
- [Internal ERP Module Integration Guide](docs/application-integration.md)
- [Operations & Azure Hosting Guide](docs/deployment.md)
