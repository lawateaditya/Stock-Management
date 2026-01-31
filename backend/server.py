from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, Response, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
from passlib.context import CryptContext
from jose import jwt, JWTError
import httpx

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# JWT settings
SECRET_KEY = os.environ.get('SECRET_KEY', 'your-secret-key-change-in-production')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

# Create the main app
app = FastAPI()
api_router = APIRouter(prefix="/api")

security = HTTPBearer(auto_error=False)

# ==================== MODELS ====================

class UserRole:
    SUPER_ADMIN = "super_admin"
    ADMIN = "admin"
    INWARD_USER = "inward_user"
    ISSUER_USER = "issuer_user"

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    user_id: str
    email: EmailStr
    name: str
    role: str
    is_active: bool = True
    picture: Optional[str] = None
    created_at: datetime

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None

class Token(BaseModel):
    access_token: str
    token_type: str
    user: User

class ItemMaster(BaseModel):
    model_config = ConfigDict(extra="ignore")
    item_code: str
    item_name: str
    category: str
    uom: str
    item_rate: float
    created_by: str
    created_at: datetime

class ItemMasterCreate(BaseModel):
    item_code: str
    item_name: str
    category: str
    uom: str
    item_rate: float

class ItemMasterUpdate(BaseModel):
    item_name: Optional[str] = None
    category: Optional[str] = None
    uom: Optional[str] = None
    item_rate: Optional[float] = None

class SupplierMaster(BaseModel):
    model_config = ConfigDict(extra="ignore")
    supplier_id: str
    supplier_name: str
    contact_person: str
    email: str
    phone: str
    country: str
    state: str
    city: str
    address: str
    pincode: str
    created_by: str
    created_at: datetime

class SupplierMasterCreate(BaseModel):
    supplier_id: str
    supplier_name: str
    contact_person: str
    email: str
    phone: str
    country: str
    state: str
    city: str
    address: str
    pincode: str

class SupplierMasterUpdate(BaseModel):
    supplier_name: Optional[str] = None
    contact_person: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    country: Optional[str] = None
    state: Optional[str] = None
    city: Optional[str] = None
    address: Optional[str] = None
    pincode: Optional[str] = None

class InwardEntry(BaseModel):
    model_config = ConfigDict(extra="ignore")
    entry_id: str
    date: datetime
    item_code: str
    item_description: str
    inward_qty: float
    inward_rate: float
    inward_value: float
    supplier: str
    ref_no: str
    created_by: str
    created_at: datetime

class InwardEntryCreate(BaseModel):
    date: datetime
    item_code: str
    inward_qty: float
    inward_rate: float
    supplier: str
    ref_no: str

class IssueEntry(BaseModel):
    model_config = ConfigDict(extra="ignore")
    entry_id: str
    date: datetime
    item_code: str
    item_description: str
    issued_qty: float
    created_by: str
    created_at: datetime

class IssueEntryCreate(BaseModel):
    date: datetime
    item_code: str
    issued_qty: float

class StockStatement(BaseModel):
    item_code: str
    item_description: str
    category: str
    opening_stk: float
    inward_qty: float
    issue_qty: float
    closing_stk: float

class SessionData(BaseModel):
    user_id: str
    session_token: str
    expires_at: datetime
    created_at: datetime

# ==================== AUTH HELPERS ====================

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(request: Request, credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)) -> User:
    # Check session_token cookie first
    session_token = request.cookies.get("session_token")
    
    if session_token:
        # Validate session token
        session_doc = await db.user_sessions.find_one(
            {"session_token": session_token},
            {"_id": 0}
        )
        
        if session_doc:
            expires_at = session_doc["expires_at"]
            if isinstance(expires_at, str):
                expires_at = datetime.fromisoformat(expires_at)
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)
            
            if expires_at >= datetime.now(timezone.utc):
                user_doc = await db.users.find_one(
                    {"user_id": session_doc["user_id"]},
                    {"_id": 0}
                )
                if user_doc and user_doc.get("is_active", True):
                    if isinstance(user_doc['created_at'], str):
                        user_doc['created_at'] = datetime.fromisoformat(user_doc['created_at'])
                    return User(**user_doc)
    
    # Fallback to Authorization header
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated"
        )
    
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token"
            )
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token"
        )
    
    user_doc = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not user_doc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )
    
    if not user_doc.get("is_active", True):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User is inactive"
        )
    
    if isinstance(user_doc['created_at'], str):
        user_doc['created_at'] = datetime.fromisoformat(user_doc['created_at'])
    
    return User(**user_doc)

def require_role(allowed_roles: List[str]):
    async def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions"
            )
        return current_user
    return role_checker

# ==================== AUTH ROUTES ====================

@api_router.post("/auth/register", response_model=Token)
async def register(user_input: UserCreate):
    # Check if user exists
    existing_user = await db.users.find_one({"email": user_input.email})
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Validate role
    valid_roles = [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.INWARD_USER, UserRole.ISSUER_USER]
    if user_input.role not in valid_roles:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid role"
        )
    
    # Create user
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    user_doc = {
        "user_id": user_id,
        "email": user_input.email,
        "password_hash": hash_password(user_input.password),
        "name": user_input.name,
        "role": user_input.role,
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.users.insert_one(user_doc)
    
    # Create token
    access_token = create_access_token(data={"sub": user_id})
    
    user_doc_clean = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    user_doc_clean['created_at'] = datetime.fromisoformat(user_doc_clean['created_at'])
    
    return Token(
        access_token=access_token,
        token_type="bearer",
        user=User(**user_doc_clean)
    )

@api_router.post("/auth/login", response_model=Token)
async def login(user_input: UserLogin):
    user_doc = await db.users.find_one({"email": user_input.email}, {"_id": 0})
    
    if not user_doc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials"
        )
    
    if not verify_password(user_input.password, user_doc["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials"
        )
    
    if not user_doc.get("is_active", True):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User is inactive"
        )
    
    access_token = create_access_token(data={"sub": user_doc["user_id"]})
    
    user_doc['created_at'] = datetime.fromisoformat(user_doc['created_at'])
    
    return Token(
        access_token=access_token,
        token_type="bearer",
        user=User(**user_doc)
    )

@api_router.get("/auth/session-data")
async def get_session_data(request: Request, response: Response):
    session_id = request.headers.get("X-Session-ID")
    
    if not session_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Session ID required"
        )
    
    # REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    async with httpx.AsyncClient() as client:
        try:
            api_response = await client.get(
                "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                headers={"X-Session-ID": session_id}
            )
            
            if api_response.status_code != 200:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid session"
                )
            
            session_data = api_response.json()
            
            # Check if user exists
            user_doc = await db.users.find_one(
                {"email": session_data["email"]},
                {"_id": 0}
            )
            
            if user_doc:
                user_id = user_doc["user_id"]
                # Update user info
                await db.users.update_one(
                    {"user_id": user_id},
                    {"$set": {
                        "name": session_data["name"],
                        "picture": session_data.get("picture")
                    }}
                )
            else:
                # Create new user with default role
                user_id = f"user_{uuid.uuid4().hex[:12]}"
                user_doc = {
                    "user_id": user_id,
                    "email": session_data["email"],
                    "name": session_data["name"],
                    "picture": session_data.get("picture"),
                    "role": UserRole.INWARD_USER,  # Default role
                    "is_active": True,
                    "created_at": datetime.now(timezone.utc).isoformat()
                }
                await db.users.insert_one(user_doc)
            
            # Store session
            session_token = session_data["session_token"]
            expires_at = datetime.now(timezone.utc) + timedelta(days=7)
            
            await db.user_sessions.insert_one({
                "user_id": user_id,
                "session_token": session_token,
                "expires_at": expires_at.isoformat(),
                "created_at": datetime.now(timezone.utc).isoformat()
            })
            
            # Set httpOnly cookie
            response.set_cookie(
                key="session_token",
                value=session_token,
                httponly=True,
                secure=True,
                samesite="none",
                path="/",
                max_age=7 * 24 * 60 * 60
            )
            
            # Get updated user
            user_doc = await db.users.find_one({"user_id": user_id}, {"_id": 0})
            user_doc['created_at'] = datetime.fromisoformat(user_doc['created_at'])
            
            return User(**user_doc)
            
        except httpx.RequestError:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to validate session"
            )

@api_router.get("/auth/me", response_model=User)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user

@api_router.post("/auth/logout")
async def logout(request: Request, response: Response, current_user: User = Depends(get_current_user)):
    session_token = request.cookies.get("session_token")
    
    if session_token:
        await db.user_sessions.delete_many({"session_token": session_token})
    
    response.delete_cookie(key="session_token", path="/")
    return {"message": "Logged out successfully"}

# ==================== USER ROUTES ====================

@api_router.get("/users", response_model=List[User])
async def get_users(
    current_user: User = Depends(require_role([UserRole.SUPER_ADMIN, UserRole.ADMIN]))
):
    users = await db.users.find({}, {"_id": 0}).to_list(1000)
    for user in users:
        if isinstance(user['created_at'], str):
            user['created_at'] = datetime.fromisoformat(user['created_at'])
    return users

@api_router.post("/users", response_model=User)
async def create_user(
    user_input: UserCreate,
    current_user: User = Depends(require_role([UserRole.SUPER_ADMIN, UserRole.ADMIN]))
):
    # Only super_admin can create admins
    if user_input.role == UserRole.ADMIN and current_user.role != UserRole.SUPER_ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only super admin can create admin users"
        )
    
    existing_user = await db.users.find_one({"email": user_input.email})
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    user_doc = {
        "user_id": user_id,
        "email": user_input.email,
        "password_hash": hash_password(user_input.password),
        "name": user_input.name,
        "role": user_input.role,
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.users.insert_one(user_doc)
    
    user_doc_clean = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    user_doc_clean['created_at'] = datetime.fromisoformat(user_doc_clean['created_at'])
    
    return User(**user_doc_clean)

@api_router.patch("/users/{user_id}", response_model=User)
async def update_user(
    user_id: str,
    user_update: UserUpdate,
    current_user: User = Depends(require_role([UserRole.SUPER_ADMIN, UserRole.ADMIN]))
):
    user_doc = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not user_doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Only super_admin can modify admin users
    if user_doc["role"] == UserRole.ADMIN and current_user.role != UserRole.SUPER_ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only super admin can modify admin users"
        )
    
    update_data = {k: v for k, v in user_update.model_dump().items() if v is not None}
    
    if update_data:
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": update_data}
        )
    
    updated_user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    updated_user['created_at'] = datetime.fromisoformat(updated_user['created_at'])
    
    return User(**updated_user)

@api_router.delete("/users/{user_id}")
async def delete_user(
    user_id: str,
    current_user: User = Depends(require_role([UserRole.SUPER_ADMIN]))
):
    result = await db.users.delete_one({"user_id": user_id})
    
    if result.deleted_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    return {"message": "User deleted successfully"}

# ==================== ITEM MASTER ROUTES ====================

@api_router.get("/items", response_model=List[ItemMaster])
async def get_items(
    current_user: User = Depends(get_current_user)
):
    items = await db.item_master.find({}, {"_id": 0}).to_list(1000)
    for item in items:
        if isinstance(item['created_at'], str):
            item['created_at'] = datetime.fromisoformat(item['created_at'])
    return items

@api_router.post("/items", response_model=ItemMaster)
async def create_item(
    item_input: ItemMasterCreate,
    current_user: User = Depends(require_role([UserRole.ADMIN, UserRole.SUPER_ADMIN]))
):
    existing_item = await db.item_master.find_one({"item_code": item_input.item_code})
    if existing_item:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Item code already exists"
        )
    
    item_doc = {
        **item_input.model_dump(),
        "created_by": current_user.user_id,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.item_master.insert_one(item_doc)
    
    item_doc_clean = await db.item_master.find_one({"item_code": item_input.item_code}, {"_id": 0})
    item_doc_clean['created_at'] = datetime.fromisoformat(item_doc_clean['created_at'])
    
    return ItemMaster(**item_doc_clean)

@api_router.patch("/items/{item_code}", response_model=ItemMaster)
async def update_item(
    item_code: str,
    item_update: ItemMasterUpdate,
    current_user: User = Depends(require_role([UserRole.SUPER_ADMIN, UserRole.ADMIN]))
):
    item_doc = await db.item_master.find_one({"item_code": item_code}, {"_id": 0})
    if not item_doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Item not found"
        )
    
    update_data = {k: v for k, v in item_update.model_dump().items() if v is not None}
    
    if update_data:
        await db.item_master.update_one(
            {"item_code": item_code},
            {"$set": update_data}
        )
    
    updated_item = await db.item_master.find_one({"item_code": item_code}, {"_id": 0})
    updated_item['created_at'] = datetime.fromisoformat(updated_item['created_at'])
    
    return ItemMaster(**updated_item)

@api_router.delete("/items/{item_code}")
async def delete_item(
    item_code: str,
    current_user: User = Depends(require_role([UserRole.ADMIN, UserRole.SUPER_ADMIN]))
):
    result = await db.item_master.delete_one({"item_code": item_code})
    
    if result.deleted_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Item not found"
        )
    
    return {"message": "Item deleted successfully"}

# ==================== SUPPLIER MASTER ROUTES ====================

@api_router.get("/suppliers", response_model=List[SupplierMaster])
async def get_suppliers(
    current_user: User = Depends(get_current_user)
):
    suppliers = await db.supplier_master.find({}, {"_id": 0}).to_list(1000)
    for supplier in suppliers:
        if isinstance(supplier['created_at'], str):
            supplier['created_at'] = datetime.fromisoformat(supplier['created_at'])
    return suppliers

@api_router.post("/suppliers", response_model=SupplierMaster)
async def create_supplier(
    supplier_input: SupplierMasterCreate,
    current_user: User = Depends(require_role([UserRole.ADMIN, UserRole.SUPER_ADMIN]))
):
    existing_supplier = await db.supplier_master.find_one({"supplier_id": supplier_input.supplier_id})
    if existing_supplier:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Supplier ID already exists"
        )
    
    supplier_doc = {
        **supplier_input.model_dump(),
        "created_by": current_user.user_id,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.supplier_master.insert_one(supplier_doc)
    
    supplier_doc_clean = await db.supplier_master.find_one({"supplier_id": supplier_input.supplier_id}, {"_id": 0})
    supplier_doc_clean['created_at'] = datetime.fromisoformat(supplier_doc_clean['created_at'])
    
    return SupplierMaster(**supplier_doc_clean)

@api_router.patch("/suppliers/{supplier_id}", response_model=SupplierMaster)
async def update_supplier(
    supplier_id: str,
    supplier_update: SupplierMasterUpdate,
    current_user: User = Depends(require_role([UserRole.SUPER_ADMIN, UserRole.ADMIN]))
):
    supplier_doc = await db.supplier_master.find_one({"supplier_id": supplier_id}, {"_id": 0})
    if not supplier_doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Supplier not found"
        )
    
    update_data = {k: v for k, v in supplier_update.model_dump().items() if v is not None}
    
    if update_data:
        await db.supplier_master.update_one(
            {"supplier_id": supplier_id},
            {"$set": update_data}
        )
    
    updated_supplier = await db.supplier_master.find_one({"supplier_id": supplier_id}, {"_id": 0})
    updated_supplier['created_at'] = datetime.fromisoformat(updated_supplier['created_at'])
    
    return SupplierMaster(**updated_supplier)

@api_router.delete("/suppliers/{supplier_id}")
async def delete_supplier(
    supplier_id: str,
    current_user: User = Depends(require_role([UserRole.ADMIN, UserRole.SUPER_ADMIN]))
):
    result = await db.supplier_master.delete_one({"supplier_id": supplier_id})
    
    if result.deleted_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Supplier not found"
        )
    
    return {"message": "Supplier deleted successfully"}

# ==================== INWARD ROUTES ====================

@api_router.get("/inward", response_model=List[InwardEntry])
async def get_inward_entries(
    current_user: User = Depends(require_role([UserRole.ADMIN, UserRole.INWARD_USER, UserRole.ISSUER_USER, UserRole.SUPER_ADMIN]))
):
    query = {}
    if current_user.role == UserRole.INWARD_USER:
        query["created_by"] = current_user.user_id
    
    entries = await db.tbl_inward.find(query, {"_id": 0}).to_list(1000)
    for entry in entries:
        if isinstance(entry['date'], str):
            entry['date'] = datetime.fromisoformat(entry['date'])
        if isinstance(entry['created_at'], str):
            entry['created_at'] = datetime.fromisoformat(entry['created_at'])
    return entries

@api_router.post("/inward", response_model=InwardEntry)
async def create_inward_entry(
    entry_input: InwardEntryCreate,
    current_user: User = Depends(require_role([UserRole.ADMIN, UserRole.INWARD_USER, UserRole.SUPER_ADMIN]))
):
    # Verify item exists
    item_doc = await db.item_master.find_one({"item_code": entry_input.item_code}, {"_id": 0})
    if not item_doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Item not found"
        )
    
    # Calculate inward value
    inward_value = entry_input.inward_qty * entry_input.inward_rate
    
    entry_id = f"inward_{uuid.uuid4().hex[:12]}"
    entry_doc = {
        "entry_id": entry_id,
        "date": entry_input.date.isoformat(),
        "item_code": entry_input.item_code,
        "item_description": item_doc["item_name"],
        "inward_qty": entry_input.inward_qty,
        "inward_rate": entry_input.inward_rate,
        "inward_value": inward_value,
        "supplier": entry_input.supplier,
        "ref_no": entry_input.ref_no,
        "created_by": current_user.user_id,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.tbl_inward.insert_one(entry_doc)
    
    entry_doc_clean = await db.tbl_inward.find_one({"entry_id": entry_id}, {"_id": 0})
    entry_doc_clean['date'] = datetime.fromisoformat(entry_doc_clean['date'])
    entry_doc_clean['created_at'] = datetime.fromisoformat(entry_doc_clean['created_at'])
    
    return InwardEntry(**entry_doc_clean)

@api_router.delete("/inward/{entry_id}")
async def delete_inward_entry(
    entry_id: str,
    current_user: User = Depends(require_role([UserRole.ADMIN, UserRole.INWARD_USER, UserRole.SUPER_ADMIN]))
):
    # Find the inward entry
    inward_entry = await db.tbl_inward.find_one({"entry_id": entry_id}, {"_id": 0})
    
    if not inward_entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Inward entry not found"
        )
    
    # Check permissions - INWARD_USER can only delete their own entries
    if current_user.role == UserRole.INWARD_USER and inward_entry["created_by"] != current_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only delete your own entries"
        )
    
    # Delete all issues related to this inward's item
    item_code = inward_entry["item_code"]
    await db.tbl_issue.delete_many({"item_code": item_code})
    
    # Delete the inward entry
    await db.tbl_inward.delete_one({"entry_id": entry_id})
    
    return {"message": "Inward entry and related issues deleted successfully"}

# ==================== ISSUE ROUTES ====================

@api_router.get("/issue", response_model=List[IssueEntry])
async def get_issue_entries(
    current_user: User = Depends(require_role([UserRole.ADMIN, UserRole.ISSUER_USER, UserRole.SUPER_ADMIN]))
):
    query = {}
    if current_user.role == UserRole.ISSUER_USER:
        query["created_by"] = current_user.user_id
    
    entries = await db.tbl_issue.find(query, {"_id": 0}).to_list(1000)
    for entry in entries:
        if isinstance(entry['date'], str):
            entry['date'] = datetime.fromisoformat(entry['date'])
        if isinstance(entry['created_at'], str):
            entry['created_at'] = datetime.fromisoformat(entry['created_at'])
    return entries

@api_router.post("/issue", response_model=IssueEntry)
async def create_issue_entry(
    entry_input: IssueEntryCreate,
    current_user: User = Depends(require_role([UserRole.ADMIN, UserRole.ISSUER_USER, UserRole.SUPER_ADMIN]))
):
    # Verify item exists
    item_doc = await db.item_master.find_one({"item_code": entry_input.item_code}, {"_id": 0})
    if not item_doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Item not found"
        )
    
    # Calculate available stock
    inward_pipeline = [
        {"$match": {"item_code": entry_input.item_code}},
        {"$group": {"_id": None, "total": {"$sum": "$inward_qty"}}}
    ]
    inward_result = await db.tbl_inward.aggregate(inward_pipeline).to_list(1)
    total_inward = inward_result[0]["total"] if inward_result else 0
    
    issue_pipeline = [
        {"$match": {"item_code": entry_input.item_code}},
        {"$group": {"_id": None, "total": {"$sum": "$issued_qty"}}}
    ]
    issue_result = await db.tbl_issue.aggregate(issue_pipeline).to_list(1)
    total_issued = issue_result[0]["total"] if issue_result else 0
    
    available_stock = total_inward - total_issued
    
    if entry_input.issued_qty > available_stock:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Insufficient stock. Available: {available_stock}"
        )
    
    entry_id = f"issue_{uuid.uuid4().hex[:12]}"
    entry_doc = {
        "entry_id": entry_id,
        "date": entry_input.date.isoformat(),
        "item_code": entry_input.item_code,
        "item_description": item_doc["item_name"],
        "issued_qty": entry_input.issued_qty,
        "created_by": current_user.user_id,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.tbl_issue.insert_one(entry_doc)
    
    entry_doc_clean = await db.tbl_issue.find_one({"entry_id": entry_id}, {"_id": 0})
    entry_doc_clean['date'] = datetime.fromisoformat(entry_doc_clean['date'])
    entry_doc_clean['created_at'] = datetime.fromisoformat(entry_doc_clean['created_at'])
    
    return IssueEntry(**entry_doc_clean)

@api_router.delete("/issue/{entry_id}")
async def delete_issue_entry(
    entry_id: str,
    current_user: User = Depends(require_role([UserRole.ADMIN, UserRole.ISSUER_USER, UserRole.SUPER_ADMIN]))
):
    # Find the issue entry
    issue_entry = await db.tbl_issue.find_one({"entry_id": entry_id}, {"_id": 0})
    
    if not issue_entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Issue entry not found"
        )
    
    # Check permissions - ISSUER_USER can only delete their own entries
    if current_user.role == UserRole.ISSUER_USER and issue_entry["created_by"] != current_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only delete your own entries"
        )
    
    # Delete the issue entry
    await db.tbl_issue.delete_one({"entry_id": entry_id})
    
    return {"message": "Issue entry deleted successfully"}

# ==================== STOCK STATEMENT ROUTES ====================

@api_router.get("/stock", response_model=List[StockStatement])
async def get_stock_statement(
    current_user: User = Depends(require_role([UserRole.ADMIN, UserRole.SUPER_ADMIN]))
):
    # Get all items
    items = await db.item_master.find({}, {"_id": 0}).to_list(1000)
    
    stock_list = []
    
    for item in items:
        item_code = item["item_code"]
        
        # Calculate total inward
        inward_pipeline = [
            {"$match": {"item_code": item_code}},
            {"$group": {"_id": None, "total": {"$sum": "$inward_qty"}}}
        ]
        inward_result = await db.tbl_inward.aggregate(inward_pipeline).to_list(1)
        total_inward = inward_result[0]["total"] if inward_result else 0
        
        # Calculate total issued
        issue_pipeline = [
            {"$match": {"item_code": item_code}},
            {"$group": {"_id": None, "total": {"$sum": "$issued_qty"}}}
        ]
        issue_result = await db.tbl_issue.aggregate(issue_pipeline).to_list(1)
        total_issued = issue_result[0]["total"] if issue_result else 0
        
        stock_list.append(StockStatement(
            item_code=item_code,
            item_description=item["item_name"],
            category=item["category"],
            opening_stk=0,  # You can implement opening stock logic if needed
            inward_qty=total_inward,
            issue_qty=total_issued,
            closing_stk=total_inward - total_issued
        ))
    
    return stock_list

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("startup")
async def startup_db():
    # Create default super admin if not exists
    super_admin = await db.users.find_one({"role": UserRole.SUPER_ADMIN})
    if not super_admin:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        admin_doc = {
            "user_id": user_id,
            "email": "admin@inventory.com",
            "password_hash": hash_password("Master@123"),
            "name": "Master Admin",
            "role": UserRole.SUPER_ADMIN,
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.users.insert_one(admin_doc)
        logger.info("Default super admin created: admin@inventory.com / Master@123")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()