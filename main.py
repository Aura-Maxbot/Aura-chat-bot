from fastapi import FastAPI, Depends, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session
from services.resident_logic import ResidentLogic
from services.request_logic import RequestLogic
from services.building_logic import BuildingLogic

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
    admin_max_id: int
    role: str
    phone: str


class AddStaffResponse(BaseModel):
    ok: bool
    error: str | None = None
    staff_id: int | None = None
    phone: str | None = None

class StaffItem(BaseModel):
    staff_id: int
    full_name: str
    role: str
    phone: str | None = None
    is_active: bool


class StaffListResponse(BaseModel):
    ok: bool
    staff: list[StaffItem] = []



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

    # Компанию берём из записи админа, а не из запроса
    admin = logic.get_by_max_id_with_company(payload.admin_max_id)
    if not admin or admin["role"] != "admin":
        return {"ok": False, "error": "Нет прав для добавления сотрудников"}

    result = logic.add_direct(
        company_id=admin["company_id"],
        full_name="",
        phone=payload.phone,
        role=payload.role,
    )
    if not result.get("ok"):
        return {"ok": False, "error": result.get("error")}
    return {"ok": True, "staff_id": result["staff_id"], "phone": result["phone"]}

@app.get("/api/staff/by-company/{company_id}", response_model=StaffListResponse)
def list_staff_by_company(company_id: int, db: Session = Depends(get_db)):
    logic = StaffLogic(db)
    items = logic.list_by_company(company_id)
    return {"ok": True, "staff": items}


class StaffCheckRequest(BaseModel):
    phone: str
    max_id: int
    full_name: str | None = None


class StaffCheckResponse(BaseModel):
    ok: bool
    exists: bool
    company_name: str | None = None
    role: str | None = None
    staff_id: int | None = None
    company_id: int | None = None


@app.post("/api/staff/check-phone", response_model=StaffCheckResponse)
def check_phone_staff(payload: StaffCheckRequest, db: Session = Depends(get_db)):
    logic = StaffLogic(db)
    result = logic.check_phone_staff(
        phone=payload.phone,
        max_id=payload.max_id,
        full_name=payload.full_name or "Не активирован",
    )
    if not result:
        return {"ok": True, "exists": False}
    return {"ok": True, "exists": True, **result}

class StaffListResponse(BaseModel):
    ok: bool
    error: str | None = None
    staff: list[StaffItem] = []

@app.get("/api/staff/list/{admin_max_id}", response_model=StaffListResponse)
def list_staff_for_admin(admin_max_id: int, db: Session = Depends(get_db)):
    logic = StaffLogic(db)

    # Компанию берём из записи админа, а не из запроса
    admin = logic.get_by_max_id_with_company(admin_max_id)
    if not admin or admin["role"] != "admin":
        return {"ok": False, "error": "Нет прав для просмотра сотрудников", "staff": []}

    return {"ok": True, "staff": logic.list_by_company(admin["company_id"])}


class AddBuildingRequest(BaseModel):
    admin_max_id: int
    address: str
    apartments_count: int
    floors_count: int


class AddBuildingResponse(BaseModel):
    ok: bool
    error: str | None = None
    building_id: int | None = None
    apartments_count: int | None = None


XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


def get_admin_or_none(db: Session, max_id: int) -> dict | None:
    admin = StaffLogic(db).get_by_max_id_with_company(max_id)
    if not admin or admin["role"] != "admin" or not admin["company_id"]:
        return None
    return admin


@app.post("/api/building/add", response_model=AddBuildingResponse)
def add_building(payload: AddBuildingRequest, db: Session = Depends(get_db)):
    admin = get_admin_or_none(db, payload.admin_max_id)
    if not admin:
        return {"ok": False, "error": "Нет прав для добавления домов"}

    return BuildingLogic(db).add_building(
        company_id=admin["company_id"],
        address=payload.address,
        apartments_count=payload.apartments_count,
        floors_count=payload.floors_count,
    )


@app.get("/api/building/{building_id}/codes-xlsx")
def building_codes_xlsx(building_id: int, admin_max_id: int, db: Session = Depends(get_db)):
    admin = get_admin_or_none(db, admin_max_id)
    if not admin:
        raise HTTPException(status_code=403, detail="Нет прав")

    logic = BuildingLogic(db)
    data = logic.get_codes(building_id, admin["company_id"])
    if not data:
        raise HTTPException(status_code=404, detail="Дом не найден")

    return Response(
        content=logic.build_xlsx(data["rows"]),
        media_type=XLSX_MIME,
        headers={"Content-Disposition": f'attachment; filename="codes_{building_id}.xlsx"'},
    )

class BindResidentRequest(BaseModel):
    code: str
    max_id: int
    full_name: str | None = None


class ResidentInfoResponse(BaseModel):
    ok: bool
    found: bool = False
    error: str | None = None
    resident_id: int | None = None
    full_name: str | None = None
    apartment_id: int | None = None
    apartment_number: str | None = None
    address: str | None = None
    company_id: int | None = None
    company_name: str | None = None


@app.get("/api/resident/by-max-id/{max_id}", response_model=ResidentInfoResponse)
def get_resident_by_max_id(max_id: int, db: Session = Depends(get_db)):
    info = ResidentLogic(db).get_by_max_id(max_id)
    if not info:
        return {"ok": True, "found": False}
    return {"ok": True, "found": True, **info}


@app.post("/api/resident/bind", response_model=ResidentInfoResponse)
def bind_resident(payload: BindResidentRequest, db: Session = Depends(get_db)):
    return ResidentLogic(db).bind_by_code(
        code=payload.code,
        max_id=payload.max_id,
        full_name=payload.full_name,
    )


class RecipientItem(BaseModel):
    staff_id: int
    role: str
    full_name: str | None = None


class RecipientsResponse(BaseModel):
    ok: bool
    error: str | None = None
    staff: list[RecipientItem] = []


class CreateRequestPayload(BaseModel):
    max_id: int
    staff_id: int
    description: str
    photo: str | None = None


class CreateRequestResponse(BaseModel):
    ok: bool
    error: str | None = None
    request_id: int | None = None
    category: str | None = None
    staff_max_id: int | None = None
    staff_role: str | None = None
    staff_name: str | None = None
    resident_name: str | None = None
    address: str | None = None
    apartment_number: str | None = None
    admin_max_ids: list[int] = []


class AnswerRequestPayload(BaseModel):
    staff_max_id: int
    request_id: int
    answer: str


class AnswerRequestResponse(BaseModel):
    ok: bool
    error: str | None = None
    request_id: int | None = None
    resident_max_id: int | None = None
    resident_name: str | None = None
    address: str | None = None
    apartment_number: str | None = None
    staff_role: str | None = None
    staff_name: str | None = None
    admin_max_ids: list[int] = []


class MyRequestItem(BaseModel):
    request_id: int
    category: str
    description: str
    status: str
    answer: str | None = None
    created_at: str | None = None


class MyRequestsResponse(BaseModel):
    ok: bool
    error: str | None = None
    requests: list[MyRequestItem] = []


@app.get("/api/request/recipients/{max_id}", response_model=RecipientsResponse)
def list_request_recipients(max_id: int, db: Session = Depends(get_db)):
    return RequestLogic(db).list_recipients(max_id)


@app.post("/api/request/create", response_model=CreateRequestResponse)
def create_request(payload: CreateRequestPayload, db: Session = Depends(get_db)):
    return RequestLogic(db).create_request(
        max_id=payload.max_id,
        staff_id=payload.staff_id,
        description=payload.description,
        photo=payload.photo,
    )


@app.post("/api/request/answer", response_model=AnswerRequestResponse)
def answer_request(payload: AnswerRequestPayload, db: Session = Depends(get_db)):
    return RequestLogic(db).answer_request(
        staff_max_id=payload.staff_max_id,
        request_id=payload.request_id,
        answer=payload.answer,
    )


@app.get("/api/request/my/{max_id}", response_model=MyRequestsResponse)
def list_my_requests(max_id: int, db: Session = Depends(get_db)):
    return RequestLogic(db).list_my_requests(max_id)