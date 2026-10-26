"""
In2IT ERP - Users API Routes
CRUD operations for user management.
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.dependencies import get_current_user, require_permission
from app.db.database import get_db
from app.models.user import User
from app.repositories.user_repository import UserRepository
from app.schemas.user import UserCreate, UserListResponse, UserResponse, UserUpdate
from app.core.security import hash_password

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("", response_model=UserListResponse)
async def list_users(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    search: str | None = None,
    department: str | None = None,
    is_active: bool | None = None,
    current_user: User = Depends(require_permission("employees.read")),
    db: AsyncSession = Depends(get_db),
):
    """List users with pagination and filtering."""
    repo = UserRepository(db)
    users, total = await repo.list_users(
        page=page, per_page=per_page, search=search,
        department=department, is_active=is_active
    )
    return UserListResponse(
        users=[UserResponse.model_validate(u) for u in users],
        total=total, page=page, per_page=per_page,
    )


@router.get("/departments", response_model=list[str])
async def list_departments(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get list of all departments."""
    repo = UserRepository(db)
    return await repo.get_departments()


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: str,
    current_user: User = Depends(require_permission("employees.read")),
    db: AsyncSession = Depends(get_db),
):
    """Get a user by ID."""
    repo = UserRepository(db)
    user = await repo.get_by_id(user_id)
    if not user:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="User not found")
    return UserResponse.model_validate(user)


@router.post("", response_model=UserResponse, status_code=201)
async def create_user(
    data: UserCreate,
    current_user: User = Depends(require_permission("employees.create")),
    db: AsyncSession = Depends(get_db),
):
    """Create a new user (admin action)."""
    repo = UserRepository(db)
    existing = await repo.get_by_email(data.email)
    if existing:
        from fastapi import HTTPException
        raise HTTPException(status_code=409, detail="Email already exists")

    user = User(
        email=data.email,
        hashed_password=hash_password(data.password),
        first_name=data.first_name,
        last_name=data.last_name,
        phone=data.phone,
        department=data.department,
        designation=data.designation,
        avatar_url=data.avatar_url,
    )
    await repo.create(user)
    return UserResponse.model_validate(user)


@router.patch("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: str,
    data: UserUpdate,
    current_user: User = Depends(require_permission("employees.update")),
    db: AsyncSession = Depends(get_db),
):
    """Update a user."""
    repo = UserRepository(db)
    user = await repo.get_by_id(user_id)
    if not user:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="User not found")

    update_data = data.model_dump(exclude_unset=True)
    await repo.update(user, update_data)
    return UserResponse.model_validate(user)


@router.delete("/{user_id}", status_code=204)
async def delete_user(
    user_id: str,
    current_user: User = Depends(require_permission("employees.delete")),
    db: AsyncSession = Depends(get_db),
):
    """Delete a user."""
    repo = UserRepository(db)
    user = await repo.get_by_id(user_id)
    if not user:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="User not found")
    await repo.delete(user)
