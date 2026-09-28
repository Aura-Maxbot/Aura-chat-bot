from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session

from core.database import get_db
from services.company_logic import CompanyLogic
from services.staff_logic import StaffLogic
from models.staff import Staff
from models.company import Company

app = FastAPI(title="Aura Chat Bot API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class PhoneCheckRequest(BaseModel):
    phone: str
    max_id: int
    full_name: str | None = None


class PhoneCheckResponse(BaseModel):
    ok: bool
    exists: bool
    company_name: str | None = None
    staff_id: int | None = None


class UserRoleResponse(BaseModel):
    ok: bool
    found: bool
    role: str | None = None
    staff_id: int | None = None
    full_name: str | None = None
    company_id: int | None = None
    company_name: str | None = None

class AddStaffRequest(BaseModel):
    company_id: int
    role: str
    phone: str
    full_name: str | None = None


class AddStaffResponse(BaseModel):
    ok: bool
    error: str | None = None
    staff_id: int | None = None



@app.get("/")
def root():
    return {"status": "ok", "service": "Aura Chat Bot API"}


@app.get("/health")
def health():
    return {"status": "healthy"}


@app.post("/api/company/check-phone-admin", response_model=PhoneCheckResponse)
def check_company_phone_admin(payload: PhoneCheckRequest, db: Session = Depends(get_db)):

    company_logic = CompanyLogic(db)
    result = company_logic.check_phone(payload.phone)

    if not result:
        return {"ok": True, "exists": False}

    staff_logic = StaffLogic(db)
    staff_result = staff_logic.register_admin(
        company_id=result["company_id"],
        max_id=payload.max_id,
        full_name=payload.full_name,
        phone=payload.phone,
    )

    if not staff_result.get("ok"):
        return {
            "ok": False,
            "exists": True,
            "company_name": result["company_name"],
        }

    return {
        "ok": True,
        "exists": True,
        "company_name": result["company_name"],
        "staff_id": staff_result["staff_id"],
    }

@app.get("/api/staff/by-max-id/{max_id}", response_model=UserRoleResponse)
def get_staff_by_max_id(max_id: int, db: Session = Depends(get_db)):
    logic = StaffLogic(db)
    result = logic.get_by_max_id_with_company(max_id)

    if not result:
        return {"ok": True, "found": False}

    return {"ok": True, "found": True, **result}

@app.post("/api/staff/add", response_model=AddStaffResponse)
def add_staff(payload: AddStaffRequest, db: Session = Depends(get_db)):
    logic = StaffLogic(db)
    result = logic.add_direct(
        company_id=payload.company_id,
        full_name=payload.full_name or " ",
        phone=payload.phone,
        role=payload.role,
    )
    if not result.get("ok"):
        return {"ok": False, "error": result.get("error")}
    return {"ok": True, "staff_id": result["staff_id"]}