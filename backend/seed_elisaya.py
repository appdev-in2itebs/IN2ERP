import asyncio
from sqlalchemy import select
from app.db.database import async_session_factory
from app.core.security import hash_password
from app.models.user import User
from app.models.role import Role, RolePermission, Permission, UserRole
from app.models.application import Application, AppAssignment


async def seed_elisaya():
    async with async_session_factory() as session:
        # 1. Ensure Employee role exists
        emp_role_res = await session.execute(select(Role).where(Role.name == "Employee"))
        emp_role = emp_role_res.scalar_one_or_none()
        if not emp_role:
            emp_role = Role(name="Employee", description="Standard employee access", is_system=True, color="#10B981")
            session.add(emp_role)
            await session.flush()

        # 2. Ensure In2CRM Application exists
        crm_res = await session.execute(
            select(Application).where((Application.slug == "in2crm") | (Application.slug == "crm"))
        )
        crm_app = crm_res.scalar_one_or_none()
        if not crm_app:
            crm_app = Application(
                name="In2CRM",
                slug="in2crm",
                description="ENTERPRISE PIPELINE V2.0",
                icon="in2crm",
                color="#7A244E",
                url="/apps/crm",
                category="Sales",
                is_active=True,
                is_core=False,
                sort_order=1,
            )
            session.add(crm_app)
            await session.flush()
            print("[+] Created Application: In2CRM")
        else:
            crm_app.name = "In2CRM"
            crm_app.slug = "in2crm"
            crm_app.description = "ENTERPRISE PIPELINE V2.0"
            crm_app.icon = "in2crm"
            crm_app.color = "#7A244E"
            crm_app.category = "Sales"
            await session.flush()
            print("[i] Updated Application: In2CRM")

        # Also rename/brand other applications for In2ERP ecosystem
        apps_to_ensure = [
            ("In2Projects", "project-mgmt", "AGILE DELIVERY & MILESTONES", "in2projects", "#1D4ED8", "Operations", 2),
            ("In2HRM", "hr-management", "PEOPLE & TALENT SUITE", "in2hrm", "#047857", "HR", 3),
            ("In2Leave", "leave-mgmt", "EMPLOYEE TIME OFF PORTAL", "in2leave", "#0F766E", "HR", 4),
            ("In2Finance", "finance", "LEDGER & CAPITAL PLANNING", "in2finance", "#B45309", "Finance", 5),
        ]
        for name, slug, desc, icon, color, cat, sort in apps_to_ensure:
            app_res = await session.execute(select(Application).where(Application.slug == slug))
            app_obj = app_res.scalar_one_or_none()
            if app_obj:
                app_obj.name = name
                app_obj.description = desc
                app_obj.icon = icon
                app_obj.color = color
                app_obj.category = cat
                app_obj.sort_order = sort
            else:
                session.add(Application(
                    name=name, slug=slug, description=desc, icon=icon, color=color,
                    url=f"/apps/{slug}", category=cat, is_active=True, is_core=True, sort_order=sort
                ))
        await session.flush()

        # 3. Create or update Elisaya Nayak
        el_res = await session.execute(select(User).where(User.email == "elisaya.nayak@in2itebs.com"))
        elisaya = el_res.scalar_one_or_none()

        if not elisaya:
            print("[+] Creating user: Elisaya Nayak (elisaya.nayak@in2itebs.com)...")
            elisaya = User(
                email="elisaya.nayak@in2itebs.com",
                hashed_password=hash_password("password123"),
                first_name="Elisaya",
                last_name="Nayak",
                department="Sales",
                designation="Sales Manager",
                phone="+91 98765 43210",
                is_active=True,
                is_superadmin=False,
            )
            session.add(elisaya)
            await session.flush()
        else:
            print("[i] Updating user: Elisaya Nayak...")
            elisaya.hashed_password = hash_password("password123")
            elisaya.first_name = "Elisaya"
            elisaya.last_name = "Nayak"
            elisaya.department = "Sales"
            elisaya.designation = "Sales Manager"
            elisaya.is_active = True
            await session.flush()

        # Ensure Role
        ur_res = await session.execute(
            select(UserRole).where((UserRole.user_id == elisaya.id) & (UserRole.role_id == emp_role.id))
        )
        if not ur_res.scalar_one_or_none():
            session.add(UserRole(user_id=elisaya.id, role_id=emp_role.id))
            await session.flush()

        # 4. Assign In2CRM to Elisaya Nayak
        assign_res = await session.execute(
            select(AppAssignment).where(
                (AppAssignment.user_id == elisaya.id) & (AppAssignment.application_id == crm_app.id)
            )
        )
        assign = assign_res.scalar_one_or_none()
        if not assign:
            session.add(AppAssignment(
                user_id=elisaya.id,
                application_id=crm_app.id,
                app_role="Sales Manager",
                status="active",
                notes="Primary CRM Workspace",
            ))
            print(f"[+] Assigned In2CRM to Elisaya Nayak with app_role='Sales Manager'")
        else:
            assign.app_role = "Sales Manager"
            assign.status = "active"

        await session.commit()
        print("\n[SUCCESS] Seeded Elisaya Nayak:")
        print("  Email:       elisaya.nayak@in2itebs.com")
        print("  Password:    password123")
        print("  Designation: Sales Manager")
        print("  App:         In2CRM (ENTERPRISE PIPELINE V2.0)")


if __name__ == "__main__":
    asyncio.run(seed_elisaya())
