# Internal ERP Business Application Integration Guide

In2IT ERP is structured to host and govern access to internal business applications and operational modules (e.g., HR Management, Payroll, Finance, CRM, Project Management).

---

## 1. Registering a New Module

Modules can be registered via the **Applications Management** UI (`/applications`) or directly via API:

```http
POST /api/v1/applications
Authorization: Bearer <ADMIN_ACCESS_TOKEN>
Content-Type: application/json

{
  "name": "Supply Chain Analytics",
  "slug": "supply-chain",
  "description": "Inventory forecasts and procurement tracking",
  "icon": "TrendingUp",
  "color": "#10B981",
  "url": "/apps/supply-chain",
  "category": "Operations",
  "is_core": false,
  "requires_license": false,
  "max_users": 100,
  "sort_order": 10
}
```

---

## 2. Granular Module Permissions

Every new application can be paired with fine-grained permissions in `app/db/seed.py` or through the **Roles & RBAC** UI:

- `<module_slug>.read`: View and open the application
- `<module_slug>.create`: Create records within the module
- `<module_slug>.update`: Modify records
- `<module_slug>.delete`: Delete records
- `<module_slug>.admin`: Administrative control over the module

---

## 3. Allocating Module Access to Employees

Application assignments govern which employees can access specific tools.

### Via API:
```http
POST /api/v1/assignments
Authorization: Bearer <TOKEN>
Content-Type: application/json

{
  "user_id": "user-uuid-here",
  "application_id": "app-uuid-here",
  "notes": "Provisioned for Q4 logistics auditing",
  "expires_at": "2026-12-31T23:59:59Z"
}
```

### Business Rules Enforced:
1. **Application Active State**: Deactivated applications cannot be assigned.
2. **User Concurrency Cap**: If `max_users` is specified on the application, attempts to assign beyond this limit return HTTP 400.
3. **Audit Logging**: Every grant and revocation is recorded in `audit_logs` with timestamp, operator ID, and IP address.

---

## 4. Integrating Micro-Frontends or Sub-Routes

To attach a dedicated internal sub-view for a module:
1. Create your component in `frontend/src/views/modules/<ModuleSlug>.tsx`.
2. Add a route in `frontend/src/router/index.tsx` wrapped in `ProtectedRoute`:
   ```tsx
   <Route
     path="/apps/supply-chain"
     element={
       <ProtectedRoute permission="applications.read">
         <SupplyChainView />
       </ProtectedRoute>
     }
   />
   ```
