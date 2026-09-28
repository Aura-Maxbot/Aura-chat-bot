from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session

from core.database import get_db
from services.company_logic import CompanyLogic

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


class PhoneCheckResponse(BaseModel):
    ok: bool
    exists: bool
    company_name: str | None = None


@app.get("/")
def root():
    return {"status": "ok", "service": "Aura Chat Bot API"}


@app.get("/health")
def health():
    return {"status": "healthy"}


@app.post("/api/company/check-phone-admin", response_model=PhoneCheckResponse)
def check_company_phone_admin(payload: PhoneCheckRequest, db: Session = Depends(get_db)):
    logic = CompanyLogic(db)
    result = logic.check_phone(payload.phone)
    if not result:
        return {"ok": True, "exists": False}
    return {"ok": True, "exists": True, "company_name": result["company_name"]}

