from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from core.database import SessionLocal
from services.staff_logic import StaffLogic
from services.resident_logic import ResidentLogic
from services.company_logic import CompanyLogic


app = FastAPI(title="Aura Chat Bot API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class CompanyCreateRequest(BaseModel):
    name: str
    email: str
    phone: str
    admin_phone: str
    admin_name: str


class PhoneVerifyRequest(BaseModel):
    phone: str
    max_id: int
    full_name: str | None = None


class OwnerVerifyRequest(BaseModel):
    code: str
    max_id: int
    full_name: str | None = None


@app.post("/api/companies")
def create_company(data: CompanyCreateRequest):
    db = SessionLocal()
    try:
        logic = CompanyLogic(db)
        result = logic.register(
            name=data.name,
            email=data.email,
            phone=data.phone,
            admin_phone=data.admin_phone,
            admin_name=data.admin_name,
        )
        if not result["ok"]:
            raise HTTPException(status_code=400, detail=result["error"])
        return result
    finally:
        db.close()


@app.post("/api/auth/phone")
def verify_phone(data: PhoneVerifyRequest):
    db = SessionLocal()
    try:
        staff_logic = StaffLogic(db)
        result = staff_logic.activate_by_phone(
            phone=data.phone,
            max_id=data.max_id,
            full_name=data.full_name,
        )
        if result["ok"]:
            return {**result, "user_type": "staff"}

        resident_logic = ResidentLogic(db)
        result = resident_logic.activate_by_phone(
            phone=data.phone,
            max_id=data.max_id,
            full_name=data.full_name,
        )
        if result["ok"]:
            return {**result, "user_type": "resident"}

        raise HTTPException(status_code=400, detail="Номер не найден")
    finally:
        db.close()


@app.post("/api/auth/owner")
def verify_owner(data: OwnerVerifyRequest):
    db = SessionLocal()
    try:
        logic = ResidentLogic(db)
        result = logic.bind_owner_by_code(
            code=data.code,
            max_id=data.max_id,
            full_name=data.full_name,
        )
        if not result["ok"]:
            raise HTTPException(status_code=400, detail=result["error"])
        return {**result, "user_type": "owner"}
    finally:
        db.close()


@app.get("/")
def root():
    return {"status": "ok", "service": "Aura Chat Bot API"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)