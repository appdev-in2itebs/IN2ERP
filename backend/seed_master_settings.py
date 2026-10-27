import asyncio
from sqlalchemy import select
from app.db.database import async_session_factory
from app.core.security import hash_password
from app.models.user import User
from app.models.role import Role, Permission, RolePermission, UserRole
from app.models.application import Application, AppAssignment


MASTER_ROLES = [
    ("Administrator", "ADMIN", "Full system access including master data and pipeline configuration.", "#8B5CF6", 80),
    ("Chief Revenue Officer", "CRO", "Owns the portfolio. Sees all deals, approves Go/No-Go, sets tiering.", "#6366F1", 71),
    ("Salesperson", "SALES", "Creates and works deals they own or are on the team for.", "#3B82F6", 69),
    ("Sales Manager", "SALES_MANAGER", "Leads a sales team. Decides Prospect->Lead promotion. Team-scoped visibility.", "#7A244E", 73),
    ("Practice Lead", "PRACTICE_LEAD", "Owns solutioning and resourcing for a practice group.", "#0F766E", 64),
    ("Finance Approver", "FINANCE", "Decides Internal Finance Approval (GOV-08) and Review (PVT-06).", "#10B981", 61),
    ("Read Only", "VIEWER", "Reporting access with no write capability.", "#64748B", 60),
    ("Executive Chairman", "EXEC_CHAIRMAN", "Board-level sign-off. Axis 6 names the ExCh on eight stages, and FieldGovernance requires ExCh approval on any deal above Rs1 Cr TCV.", "#B45309", 63),
    ("Project Manager", "PROJECT_MANAGER", "Project delivery tracking, sprint allocation and milestone governance.", "#2563EB", 65),
]

MASTER_USERS = [
    ("Abhijit", "Shukla", "abhijit.shukla@in2itebs.com", "Chief Revenue Officer", "Leadership", "CRO"),
    ("Chinmaya Chintan", "Prustry", "chinmaya@in2itebs.com", "Administrator", "IT & Governance", "ADMIN"),
    ("Elisaya", "Nayak", "elisaya.nayak@in2itebs.com", "Sales Manager", "Sales", "SALES_MANAGER"),
    ("Finance", "Approver", "finance@in2itebs.com", "Finance Approver", "Finance", "FINANCE"),
    ("Kunwar Krishna", "Menon", "kunwar.menon@in2itebs.com", "Chief Revenue Officer", "Leadership", "CRO"),
    ("Pravat Kumar", "Paikaray", "pravat.paikaray@in2itebs.com", "Salesperson", "Sales", "SALES"),
    ("Project", "Manager", "pm@in2itebs.com", "Project Manager", "Operations", "PROJECT_MANAGER"),
    ("Read", "Only", "readonly@in2itebs.com", "Read Only", "Audit", "VIEWER"),
    ("Rudra", "Shatapathy", "rudra@in2itebs.com", "Executive Chairman", "Executive Board", "EXEC_CHAIRMAN"),
    ("Sridhar", "V", "sridhar.v@in2itebs.com", "Practice Lead", "Technology", "PRACTICE_LEAD"),
]


async def seed_master_settings():
    async with async_session_factory() as session:
        # 1. Ensure all Roles exist
        role_map = {}
        for name, code, desc, color, grants in MASTER_ROLES:
            res = await session.execute(select(Role).where(Role.name == name))
            r = res.scalar_one_or_none()
            if not r:
                r = Role(name=name, description=desc, color=color, is_system=True)
                session.add(r)
                await session.flush()
                print(f"[+] Created Role: {name}")
            else:
                r.description = desc
                r.color = color
                await session.flush()
            role_map[name] = r
            role_map[code] = r

        # 2. Ensure Applications exist
        crm_res = await session.execute(select(Application).where(Application.slug == "in2crm"))
        crm_app = crm_res.scalar_one_or_none()
        if not crm_app:
            crm_app = Application(
                name="In2CRM", slug="in2crm", description="ENTERPRISE PIPELINE V2.0",
                icon="in2crm", color="#7A244E", category="Sales", is_active=True, sort_order=1
            )
            session.add(crm_app)
            await session.flush()

        # 3. Seed Master Users
        for first, last, email, designation, dept, role_key in MASTER_USERS:
            u_res = await session.execute(select(User).where(User.email == email))
            u = u_res.scalar_one_or_none()
            if not u:
                u = User(
                    first_name=first,
                    last_name=last,
                    email=email,
                    hashed_password=hash_password("password123"),
                    designation=designation,
                    department=dept,
                    is_active=True,
                    is_superadmin=(role_key == "ADMIN"),
                )
                session.add(u)
                await session.flush()
                print(f"[+] Created User: {first} {last} ({email})")
            else:
                u.first_name = first
                u.last_name = last
                u.designation = designation
                u.department = dept
                u.is_active = True
                await session.flush()

            # Ensure UserRole link
            target_role = role_map.get(role_key) or role_map.get(designation)
            if target_role:
                ur_res = await session.execute(
                    select(UserRole).where((UserRole.user_id == u.id) & (UserRole.role_id == target_role.id))
                )
                if not ur_res.scalar_one_or_none():
                    session.add(UserRole(user_id=u.id, role_id=target_role.id))
                    await session.flush()

            # Ensure In2CRM assignment
            as_res = await session.execute(
                select(AppAssignment).where((AppAssignment.user_id == u.id) & (AppAssignment.application_id == crm_app.id))
            )
            if not as_res.scalar_one_or_none():
                session.add(AppAssignment(
                    user_id=u.id,
                    application_id=crm_app.id,
                    app_role=designation,
                    status="active",
                    notes="In2CRM Pipeline Workspace",
                ))

        await session.commit()
        print("\n[SUCCESS] Seeded all Master Settings users and roles.")


if __name__ == "__main__":
    asyncio.run(seed_master_settings())
