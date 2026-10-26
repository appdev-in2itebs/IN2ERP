"""
In2IT ERP - Database Seed Data
Creates default permissions, roles, applications, and a superadmin user.
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.models.application import Application, AppAssignment
from app.models.role import Permission, Role, RolePermission, UserRole
from app.models.user import User


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
        "assignments.read", "assignments.create", "assignments.update",
        "audit.read", "dashboard.read",
    ],
    "Manager": [
        "employees.read",
        "roles.read",
        "applications.read",
        "assignments.read", "assignments.create",
        "dashboard.read",
    ],
    "Employee": [
        "dashboard.read",
        "applications.read",
    ],
}

DEFAULT_APPLICATIONS = [
    ("HR Management", "hr-management", "Human Resources module", "Users", "#8B5CF6",
     "/apps/hr", "Core", True, False, None, 1),
    ("Finance & Accounting", "finance", "Financial management module", "DollarSign", "#10B981",
     "/apps/finance", "Core", True, False, None, 2),
    ("Project Management", "project-mgmt", "Project tracking and management", "Briefcase", "#3B82F6",
     "/apps/projects", "Core", True, False, None, 3),
    ("Inventory Management", "inventory", "Stock and inventory tracking", "Package", "#F59E0B",
     "/apps/inventory", "Operations", False, False, None, 4),
    ("CRM", "crm", "Customer relationship management", "Heart", "#EC4899",
     "/apps/crm", "Sales", False, False, None, 5),
    ("Payroll", "payroll", "Salary and payroll processing", "CreditCard", "#6366F1",
     "/apps/payroll", "Core", True, True, 50, 6),
    ("Leave Management", "leave-mgmt", "Employee leave tracking", "Calendar", "#14B8A6",
     "/apps/leave", "HR", False, False, None, 7),
    ("Reports & Analytics", "reports", "Business intelligence dashboards", "BarChart3", "#F97316",
     "/apps/reports", "Analytics", False, False, None, 8),
]


async def seed_database(db: AsyncSession):
    """Seed the database with default data if empty."""

    # Check if already seeded
    result = await db.execute(select(Permission).limit(1))
    if result.scalar_one_or_none():
        return  # Already seeded

    print("[+] Seeding database with default data...")

    # 1. Create permissions
    permission_map: dict[str, Permission] = {}
    for code, name, description, module in DEFAULT_PERMISSIONS:
        perm = Permission(code=code, name=name, description=description, module=module)
        db.add(perm)
        permission_map[code] = perm

    await db.flush()

    # 2. Create roles and assign permissions
    role_map: dict[str, Role] = {}
    for name, description, is_system, color in DEFAULT_ROLES:
        role = Role(name=name, description=description, is_system=is_system, color=color)
        db.add(role)
        role_map[name] = role

    await db.flush()

    # Super Admin gets ALL permissions
    for perm in permission_map.values():
        db.add(RolePermission(role_id=role_map["Super Admin"].id, permission_id=perm.id))

    # Other roles get specific permissions
    for role_name, perm_codes in ROLE_PERMISSIONS.items():
        for code in perm_codes:
            db.add(RolePermission(
                role_id=role_map[role_name].id,
                permission_id=permission_map[code].id
            ))

    await db.flush()

    # 3. Create superadmin user
    admin = User(
        email="admin@in2it.com",
        hashed_password=hash_password("admin123"),
        first_name="System",
        last_name="Admin",
        department="IT",
        designation="System Administrator",
        is_active=True,
        is_superadmin=True,
    )
    db.add(admin)
    await db.flush()

    # Assign Super Admin role
    db.add(UserRole(user_id=admin.id, role_id=role_map["Super Admin"].id))

    # 4. Create default applications
    app_map: dict[str, Application] = {}
    for name, slug, desc, icon, color, url, category, is_core, req_lic, max_u, order in DEFAULT_APPLICATIONS:
        app = Application(
            name=name, slug=slug, description=desc, icon=icon,
            color=color, url=url, category=category, is_core=is_core,
            requires_license=req_lic, max_users=max_u, sort_order=order,
        )
        db.add(app)
        app_map[slug] = app

    await db.flush()

    # 5. Create demo employee user (Alex Morgan)
    employee = User(
        email="employee@in2it.com",
        hashed_password=hash_password("employee123"),
        first_name="Alex",
        last_name="Morgan",
        department="Engineering",
        designation="Software Engineer",
        is_active=True,
        is_superadmin=False,
    )
    db.add(employee)
    await db.flush()

    # Assign Employee role
    db.add(UserRole(user_id=employee.id, role_id=role_map["Employee"].id))

    # Assign 2 Applications to the Employee with DIFFERENT application-specific roles:
    # 1. Project Management -> "Project Lead"
    # 2. Leave Management   -> "Requester / Staff"
    if "project-mgmt" in app_map:
        db.add(AppAssignment(
            user_id=employee.id,
            application_id=app_map["project-mgmt"].id,
            app_role="Project Lead",
            status="active",
            notes="Engineering team technical lead access",
        ))

    if "leave-mgmt" in app_map:
        db.add(AppAssignment(
            user_id=employee.id,
            application_id=app_map["leave-mgmt"].id,
            app_role="Requester / Staff",
            status="active",
            notes="Employee self-service leave portal",
        ))

    await db.commit()
    print("[SUCCESS] Database seeded successfully!")
    print("   Admin:    admin@in2it.com / admin123")
    print("   Employee: employee@in2it.com / employee123")
