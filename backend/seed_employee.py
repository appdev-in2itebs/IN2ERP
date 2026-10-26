import asyncio
from sqlalchemy import select
from app.db.database import async_session_factory
from app.core.security import hash_password
from app.models.user import User
from app.models.role import Role, RolePermission, Permission, UserRole
from app.models.application import Application, AppAssignment


async def setup_employee():
    async with async_session_factory() as session:
        # 1. Update Employee Role Permissions
        emp_role_res = await session.execute(select(Role).where(Role.name == "Employee"))
        emp_role = emp_role_res.scalar_one_or_none()
        if not emp_role:
            print("Employee role not found!")
            return

        # Fetch permissions
        dashboard_perm = (await session.execute(select(Permission).where(Permission.code == "dashboard.read"))).scalar_one_or_none()
        apps_perm = (await session.execute(select(Permission).where(Permission.code == "applications.read"))).scalar_one_or_none()

        # Remove existing permissions for Employee role
        existing_rp = await session.execute(select(RolePermission).where(RolePermission.role_id == emp_role.id))
        for rp in existing_rp.scalars().all():
            await session.delete(rp)
        await session.flush()

        # Add only dashboard.read and applications.read
        if dashboard_perm:
            session.add(RolePermission(role_id=emp_role.id, permission_id=dashboard_perm.id))
        if apps_perm:
            session.add(RolePermission(role_id=emp_role.id, permission_id=apps_perm.id))
        await session.flush()

        # 2. Check if employee already exists
        emp_res = await session.execute(select(User).where(User.email == "employee@in2it.com"))
        employee = emp_res.scalar_one_or_none()

        if not employee:
            print("[+] Creating demo employee user: employee@in2it.com ...")
            employee = User(
                email="employee@in2it.com",
                hashed_password=hash_password("employee123"),
                first_name="Alex",
                last_name="Morgan",
                department="Engineering",
                designation="Software Engineer",
                phone="+1 (555) 234-5678",
                is_active=True,
                is_superadmin=False,
            )
            session.add(employee)
            await session.flush()
        else:
            print("[i] Updating demo employee user: employee@in2it.com ...")
            employee.hashed_password = hash_password("employee123")
            employee.first_name = "Alex"
            employee.last_name = "Morgan"
            employee.department = "Engineering"
            employee.designation = "Software Engineer"
            employee.is_active = True
            employee.is_superadmin = False
            await session.flush()

        # 3. Ensure UserRole link
        ur_res = await session.execute(
            select(UserRole).where((UserRole.user_id == employee.id) & (UserRole.role_id == emp_role.id))
        )
        if not ur_res.scalar_one_or_none():
            session.add(UserRole(user_id=employee.id, role_id=emp_role.id))
            await session.flush()

        # 4. Remove existing assignments for clean setup
        old_assignments = await session.execute(
            select(AppAssignment).where(AppAssignment.user_id == employee.id)
        )
        for a in old_assignments.scalars().all():
            await session.delete(a)
        await session.flush()

        # 5. Assign exactly 2 applications: Project Management & Leave Management
        proj_res = await session.execute(select(Application).where(Application.slug == "project-mgmt"))
        proj_app = proj_res.scalar_one_or_none()

        leave_res = await session.execute(select(Application).where(Application.slug == "leave-mgmt"))
        leave_app = leave_res.scalar_one_or_none()

        if proj_app:
            session.add(AppAssignment(
                user_id=employee.id,
                application_id=proj_app.id,
                status="active",
                notes="Primary Developer Workspace",
            ))
            print(f"   [+] Assigned: {proj_app.name}")

        if leave_app:
            session.add(AppAssignment(
                user_id=employee.id,
                application_id=leave_app.id,
                status="active",
                notes="Employee Self-Service Portal",
            ))
            print(f"   [+] Assigned: {leave_app.name}")

        await session.commit()
        print("\n[SUCCESS] Employee credentials created:")
        print("   Email:    employee@in2it.com")
        print("   Password: employee123")
        print("   Assigned Apps: Project Management, Leave Management")


if __name__ == "__main__":
    asyncio.run(setup_employee())
