# In2IT ERP - Enterprise Architecture

## 1. System Overview

**In2IT ERP** is a modern Enterprise Resource Planning platform featuring fine-grained Role-Based Access Control (RBAC), user permission overrides, application module entitlement management, and immutable audit trailing.

```
┌─────────────────────────────────────────────────────────────┐
│                       React Frontend                        │
│   (Vite + TypeScript + Vanilla CSS Enterprise Design System)│
└──────────────────────────────┬──────────────────────────────┘
                               │ REST / JSON (JWT Bearer)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                    FastAPI Backend (Async)                  │
│  ┌────────────────┐ ┌────────────────┐ ┌────────────────┐   │
│  │  Auth Service  │ │  RBAC Service  │ │ Assign Service │   │
│  └────────────────┘ └────────────────┘ └────────────────┘   │
│  ┌────────────────┐ ┌────────────────┐ ┌────────────────┐   │
│  │ Audit Service  │ │  User Service  │ │  App Service   │   │
│  └────────────────┘ └────────────────┘ └────────────────┘   │
└──────────────────────────────┬──────────────────────────────┘
                               │ SQLAlchemy 2.0 (Async)
                               ▼
              ┌─────────────────────────────────┐
              │          Data Tier              │
              │  • Development: SQLite          │
              │  • Production: Azure PostgreSQL │
              └─────────────────────────────────┘
```

---

## 2. Architectural Layers

### Frontend Layer (`/frontend`)
- **Framework**: React 18 with TypeScript and Vite.
- **Styling**: Vanilla CSS Design System with CSS Custom Properties, glassmorphism, responsive grid, and fluid micro-animations.
- **Routing**: React Router DOM with protected route guards and permission verifiers.
- **State & Stores**: `AuthContext` for user profile and permission checks; `NotificationContext` for auto-dismissing toast feedback.
- **API Communication**: Centralized `apiClient` with automatic JWT bearer attachment, refresh token cycling, and error normalization.

### Backend Layer (`/backend`)
- **Framework**: FastAPI (Python 3.11+) with full `async`/`await` request pipeline.
- **Persistence**: Async SQLAlchemy 2.0 ORM with declarative mappings and `selectinload` eager fetching.
- **Migrations**: Alembic with dual SQLite (batch mode) and PostgreSQL schema generation.
- **Validation**: Pydantic v2 schemas for all request/response models.

---

## 3. RBAC & Permission Resolution Engine

In2IT ERP implements a hybrid **RBAC + Granular Per-User Overrides** security model:

1. **Permissions**: Atomic capability strings organized by module (e.g., `employees.create`, `roles.update`, `applications.read`).
2. **Roles**: Bundles of permissions (e.g., *Super Admin*, *Admin*, *Manager*, *Employee*).
3. **User Roles**: Many-to-many relationship linking users to one or more roles.
4. **User Permission Overrides**: Explicit per-user **Grant** or **Deny** flags that take precedence over role-derived permissions.

### Resolution Algorithm (`AuthorizationService`):

$$\text{Effective Permissions} = \left( \bigcup_{r \in \text{UserRoles}} \text{Permissions}(r) \cup \text{ExplicitGrants} \right) \setminus \text{ExplicitDenies}$$

Superadmin users automatically bypass evaluation and receive unconditional system-wide access.

---

## 4. Database Strategy: SQLite to PostgreSQL

- **Development**: Uses SQLite (`sqlite+aiosqlite:///./in2it_erp.db`) for instant zero-dependency local startup.
- **Production / Azure**: Uses Azure Database for PostgreSQL Flexible Server (`postgresql+asyncpg://...`).
- The entire persistence layer uses standard SQLAlchemy abstractions and Alembic batch operations, allowing zero-code switching via the `DATABASE_URL` environment variable.
