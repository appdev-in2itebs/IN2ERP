"""
In2IT ERP - Database Seed Data
Bootstraps an empty database: permissions, ERP roles, applications with their
role catalogues, and the first superadmin account.
"""

import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.security import hash_password
from app.models.application import AppAssignment, AppRole, Application
from app.models.role import Permission, Role, RolePermission, UserRole
from app.models.user import User

logger = logging.getLogger("in2erp.seed")

# All granular permissions organized by module
DEFAULT_PERMISSIONS = [
    # Employees
    ("employees.read", "View Employees", "View employee list and details", "employees"),
    ("employees.create", "Create Employee", "Create new employee accounts", "employees"),
    ("employees.update", "Update Employee", "Modify employee information", "employees"),
    ("employees.delete", "Delete Employee", "Remove employee accounts", "employees"),
    # Roles
    ("roles.read", "View Roles", "View roles and permissions", "roles"),
    ("roles.create", "Create Role", "Create new roles", "roles"),
    ("roles.update", "Update Role", "Modify role permissions", "roles"),
    ("roles.delete", "Delete Role", "Remove roles", "roles"),
    ("roles.assign", "Assign Roles", "Assign/remove roles to users", "roles"),
    ("roles.override", "Override Permissions", "Set per-user permission overrides", "roles"),
    # Applications
    ("applications.read", "View Applications", "View application list", "applications"),
    ("applications.create", "Create Application", "Register new applications", "applications"),
    ("applications.update", "Update Application", "Modify application settings", "applications"),
    ("applications.delete", "Delete Application", "Remove applications", "applications"),
    # Assignments
    ("assignments.read", "View Assignments", "View app assignments", "assignments"),
    ("assignments.create", "Create Assignment", "Assign apps to users", "assignments"),
    ("assignments.update", "Update Assignment", "Modify assignments", "assignments"),
    ("assignments.delete", "Delete Assignment", "Remove assignments", "assignments"),
    # Audit
    ("audit.read", "View Audit Logs", "View system audit trail", "audit"),
    # Dashboard
    ("dashboard.read", "View Dashboard", "View dashboard statistics", "dashboard"),
]

DEFAULT_ROLES = [
    ("Super Admin", "Full system access - all permissions", True, "#EF4444"),
    ("Admin", "Administrative access - manage users, roles, and applications", True, "#8B5CF6"),
    ("Manager", "Management access - view and manage team assignments", True, "#3B82F6"),
    ("Employee", "Basic access - view own profile and assigned applications", True, "#10B981"),
]

# Permissions per role
ROLE_PERMISSIONS = {
    "Admin": [
        "employees.read", "employees.create", "employees.update",
        "roles.read", "roles.assign",
        "applications.read",
        "assignments.read", "assignments.create", "assignments.update", "assignments.delete",
        "audit.read", "dashboard.read",
    ],
    # Managers can see their organisation's access but only ERP admins change it.
    "Manager": [
        "employees.read",
        "roles.read",
        "applications.read",
        "assignments.read",
        "dashboard.read",
    ],
    "Employee": [
        "dashboard.read",
        "applications.read",
    ],
}

DEFAULT_APPLICATIONS = [
    ("HR Management", "hr-management", "Human Resources module", "Users", "#8B5CF6",
     None, "Core", True, False, None, 1),
    ("Finance & Accounting", "finance", "Financial management module", "DollarSign", "#10B981",
     None, "Core", True, False, None, 2),
    ("Project Management", "project-mgmt", "Project tracking and management", "Briefcase", "#3B82F6",
     None, "Core", True, False, None, 3),
    ("Inventory Management", "inventory", "Stock and inventory tracking", "Package", "#F59E0B",
     None, "Operations", False, False, None, 4),
    ("CRM", "crm", "Customer relationship management", "Heart", "#EC4899",
     None, "Sales", False, False, None, 5),
    ("Payroll", "payroll", "Salary and payroll processing", "CreditCard", "#6366F1",
     None, "Core", True, True, 50, 6),
    ("Leave Management", "leave-mgmt", "Employee leave tracking", "Calendar", "#14B8A6",
     None, "HR", False, False, None, 7),
    ("Reports & Analytics", "reports", "Business intelligence dashboards", "BarChart3", "#F97316",
     None, "Analytics", False, False, None, 8),
]

# Starting role catalogue per application: (name, code, is_default).
# These must be confirmed against each application's real role model.
CRM_ROLES = [
    ("Administrator", "ADMIN", False),
    ("Chief Revenue Officer", "CRO", False),
    ("Sales Manager", "SALES_MANAGER", False),
    ("Salesperson", "SALES", False),
    ("Practice Lead", "PRACTICE_LEAD", False),
    ("Finance Approver", "FINANCE", False),
    ("Executive Chairman", "EXEC_CHAIRMAN", False),
    ("Project Manager", "PROJECT_MANAGER", False),
    ("Read Only", "VIEWER", True),
]
DEFAULT_APP_ROLES: dict[str, list[tuple[str, str, bool]]] = {
    "hr-management": [
        ("HR Director", "HR_DIRECTOR", False), ("HR Manager", "HR_MANAGER", False),
        ("HR Staff", "HR_STAFF", False), ("Employee Self-Service", "ESS", True),
    ],
    "finance": [
        ("Finance Controller", "CONTROLLER", False), ("Accountant", "ACCOUNTANT", False),
        ("Approver", "APPROVER", False), ("Viewer", "VIEWER", True),
    ],
    "project-mgmt": [
        ("Project Lead", "LEAD", False), ("Senior Developer", "SENIOR_DEV", False),
        ("Contributor", "CONTRIBUTOR", True), ("Viewer", "VIEWER", False),
    ],
    "inventory": [
        ("Inventory Manager", "MANAGER", False), ("Store Keeper", "STORE_KEEPER", False),
        ("Viewer", "VIEWER", True),
    ],
    "crm": CRM_ROLES,
    "in2crm": CRM_ROLES,
    "payroll": [
        ("Payroll Administrator", "ADMIN", False), ("Payroll Processor", "PROCESSOR", False),
        ("Viewer", "VIEWER", True),
    ],
    "leave-mgmt": [
        ("Leave Approver / HOD", "APPROVER", False), ("Staff / Requester", "REQUESTER", True),
    ],
    "reports": [("Analyst", "ANALYST", False), ("Viewer", "VIEWER", True)],
}


def build_app_roles(slug: str) -> list[AppRole]:
    return [
        AppRole(name=name, code=code, is_default=is_default, sort_order=i)
        for i, (name, code, is_default) in enumerate(DEFAULT_APP_ROLES.get(slug, []))
    ]


async def seed_database(db: AsyncSession, admin_password: str | None = None) -> None:
    """Seed the database with bootstrap data if it is empty."""
    result = await db.execute(select(Permission).limit(1))
    if result.scalar_one_or_none():
        return  # Already seeded

    settings = get_settings()
    logger.info("Seeding empty database with bootstrap data")

    # 1. Permissions
    permission_map: dict[str, Permission] = {}
    for code, name, description, module in DEFAULT_PERMISSIONS:
        perm = Permission(code=code, name=name, description=description, module=module)
        db.add(perm)
        permission_map[code] = perm
    await db.flush()

    # 2. ERP roles and their permissions
    role_map: dict[str, Role] = {}
    for name, description, is_system, color in DEFAULT_ROLES:
        role = Role(name=name, description=description, is_system=is_system, color=color)
        db.add(role)
        role_map[name] = role
    await db.flush()

    for perm in permission_map.values():
        db.add(RolePermission(role_id=role_map["Super Admin"].id, permission_id=perm.id))
    for role_name, perm_codes in ROLE_PERMISSIONS.items():
        for code in perm_codes:
            db.add(RolePermission(
                role_id=role_map[role_name].id, permission_id=permission_map[code].id
            ))
    await db.flush()

    # 3. First superadmin, only when its password is supplied by the operator
    #    (SEED_ADMIN_PASSWORD). Otherwise use `python -m app.cli bootstrap-admin`.
    #    Passwords are never generated into, or written to, logs.
    password = admin_password or settings.SEED_ADMIN_PASSWORD
    if password:
        admin = User(
            email=settings.SEED_ADMIN_EMAIL,
            hashed_password=hash_password(password),
            first_name="System",
            last_name="Admin",
            department="IT",
            designation="System Administrator",
            is_active=True,
            is_superadmin=True,
        )
        db.add(admin)
        await db.flush()
        db.add(UserRole(user_id=admin.id, role_id=role_map["Super Admin"].id))

    # 4. Applications with their role catalogues
    app_map: dict[str, Application] = {}
    for name, slug, desc, icon, color, url, category, is_core, req_lic, max_u, order in DEFAULT_APPLICATIONS:
        app = Application(
            name=name, slug=slug, description=desc, icon=icon,
            color=color, url=url, category=category, is_core=is_core,
            requires_license=req_lic, max_users=max_u, sort_order=order,
            integration_type="manual", integration_status="manual",
        )
        app.roles = build_app_roles(slug)
        db.add(app)
        app_map[slug] = app
    await db.flush()

    # 5. Optional demo employee (SEED_DEMO_DATA=true). It has no password: an administrator
    #    issues a one-time password from the Admin Console, or it signs in with Microsoft.
    if settings.SEED_DEMO_DATA:
        employee = User(
            email="employee@in2it.com",
            first_name="Alex",
            last_name="Morgan",
            department="Engineering",
            designation="Software Engineer",
            is_active=True,
        )
        db.add(employee)
        await db.flush()
        db.add(UserRole(user_id=employee.id, role_id=role_map["Employee"].id))
        for slug, role_name in (("project-mgmt", "Project Lead"), ("leave-mgmt", "Staff / Requester")):
            app = app_map[slug]
            role = next(r for r in app.roles if r.name == role_name)
            db.add(AppAssignment(
                user_id=employee.id, application_id=app.id,
                app_role_id=role.id, app_role=role.name, status="active",
                provisioning_status="manual_action_required", version=1,
            ))

    await db.commit()
    if password:
        logger.info("Superadmin %s created", settings.SEED_ADMIN_EMAIL)
    else:
        logger.warning(
            "No administrator created. Run `python -m app.cli bootstrap-admin --email <email>` "
            "or set SEED_ADMIN_PASSWORD for the first start."
        )
