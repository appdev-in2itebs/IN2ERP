"""
Seed In2CRM users for development.

Creates the In2CRM application (with its role catalogue) and the listed users if they
do not exist yet, granting each one In2CRM role (awaiting app-owner confirmation).
New users have no password: they sign in with Microsoft, or an administrator issues a
one-time password from the Admin Console. Existing users are left untouched.
No user is made a superadmin.

Run from backend/ after `alembic upgrade head`:
    python seed_master_settings.py
"""

import asyncio

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.db.database import async_session_factory
from app.db.seed import build_app_roles
from app.models.application import AppAssignment, Application
from app.models.role import Role, UserRole
from app.models.user import User

# (first name, last name, email, designation, department, In2CRM role)
MASTER_USERS = [
    ("Abhijit", "Shukla", "abhijit.shukla@in2itebs.com", "Chief Revenue Officer", "Leadership", "Chief Revenue Officer"),
    ("Chinmaya Chintan", "Prustry", "chinmaya@in2itebs.com", "Administrator", "IT & Governance", "Administrator"),
    ("Elisaya", "Nayak", "elisaya.nayak@in2itebs.com", "Sales Manager", "Sales", "Sales Manager"),
    ("Finance", "Approver", "finance@in2itebs.com", "Finance Approver", "Finance", "Finance Approver"),
    ("Kunwar Krishna", "Menon", "kunwar.menon@in2itebs.com", "Chief Revenue Officer", "Leadership", "Chief Revenue Officer"),
    ("Pravat Kumar", "Paikaray", "pravat.paikaray@in2itebs.com", "Salesperson", "Sales", "Salesperson"),
    ("Project", "Manager", "pm@in2itebs.com", "Project Manager", "Operations", "Project Manager"),
    ("Read", "Only", "readonly@in2itebs.com", "Read Only", "Audit", "Read Only"),
    ("Rudra", "Shatapathy", "rudra@in2itebs.com", "Executive Chairman", "Executive Board", "Executive Chairman"),
    ("Sridhar", "V", "sridhar.v@in2itebs.com", "Practice Lead", "Technology", "Practice Lead"),
]


async def seed_master_settings():
    async with async_session_factory() as session:
        crm = (await session.execute(
            select(Application).options(selectinload(Application.roles))
            .where(Application.slug == "in2crm")
        )).scalar_one_or_none()
        if not crm:
            crm = Application(
                name="In2CRM", slug="in2crm", description="ENTERPRISE PIPELINE V2.0",
                icon="in2crm", color="#7A244E", category="Sales", is_active=True,
                sort_order=1, integration_type="manual", integration_status="manual",
            )
            crm.roles = build_app_roles("in2crm")
            session.add(crm)
            await session.flush()
            print("[+] Created application In2CRM with its role catalogue")
        crm_roles = {r.name: r for r in crm.roles}

        employee_role = (await session.execute(
            select(Role).where(Role.name == "Employee")
        )).scalar_one_or_none()

        created = []
        for first, last, email, designation, dept, crm_role_name in MASTER_USERS:
            user = (await session.execute(select(User).where(User.email == email))).scalar_one_or_none()
            if user:
                continue

            user = User(
                first_name=first, last_name=last, email=email,
                designation=designation, department=dept, is_active=True,
            )
            session.add(user)
            await session.flush()
            if employee_role:
                session.add(UserRole(user_id=user.id, role_id=employee_role.id))

            role = crm_roles.get(crm_role_name)
            if role:
                session.add(AppAssignment(
                    user_id=user.id, application_id=crm.id, app_role_id=role.id,
                    app_role=role.name, status="active", notes="In2CRM Pipeline Workspace",
                    # Applied by the In2CRM owner, then confirmed in the Admin Console.
                    provisioning_status="manual_action_required", version=1,
                ))
            created.append(email)

        await session.commit()

    if not created:
        print("[i] All users already exist; nothing changed.")
        return
    print(f"\n[SUCCESS] Created {len(created)} users: {', '.join(created)}")
    print("They sign in with Microsoft, or an administrator issues one-time passwords in the Admin Console.")


if __name__ == "__main__":
    asyncio.run(seed_master_settings())
