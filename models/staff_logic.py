from sqlalchemy.orm import Session
from datetime import datetime
from models.staff import Staff
from models.company import Company
from code_generator import generate_code

class StaffLogic:

    ALLOWED_ROLES = [
        "admin",
        "dispatcher",
        "main_dispatcher",
    ]

    def __init__(self, db: Session):
        self.db = db

    def add(self, company_id: int, max_id: int, full_name: str,
            phone: str, role: str, created_by: int) -> dict:
        company = self.db.query(Company).get(company_id)
        if not company:
            return {"ok": False, "error":"Компания не найдена"}

        if role not in self.ALLOWED_ROLES:
            return {"ok": False, "error": f"Недопустимая роль:{role}"}

        staff = Staff(
            company_id=company_id,
            max_id=max_id,
            full_name=full_name,
            phone=phone,
            role=role,
            is_active=False,
        )
        self.db.add(staff)
        self.db.flush()

        code = generate_code(prefix="STAFF")

        from models.invite_code import InviteCode
        invite = InviteCode(
            company_id=company_id,
            code=code,
            type="staff",
            target_role=role,
            created_by_staff=created_by,
        )
        self.db.add(invite)
        self.db.commit()

        return {
            "ok": True,
            "staff_id": staff.id,
            "code": code,
            "message": f"Сотрудник добавлен. Код для входа:{code}",
        }

    def activate_by_code(self, code: str, max_id: int) -> dict:
        from models.invite_code import InviteCode

        invite = self.db.query(InviteCode).filter(
            InviteCode.code == code,
            InviteCode.type == "staff",
            InviteCode.is_active == True,
        ).first()

        if not invite:
            return {"ok": False, "error":"Код не найден"}

        if invite.expires_at and invite.expires_at < datetime.utcnow():
            return {"ok": False, "error":"Код устарел"}

        staff = self.db.query(Staff).filter(
            Staff.max_id == max_id,
            Staff.company_id == invite.company_id,
        ).first()

        if not staff:
            return {"ok": False, "error":"Сотрудник не найден"}

        staff.is_active = True

        invite.used_at = datetime.utcnow()
        invite.is_active = False

        self.db.commit()

        return {
            "ok": True,
            "staff_id": staff.id,
            "role": staff.role,
            "company_id": staff.company_id,
        }

    def get(self, staff_id: int) -> Staff | None:
        return self.db.query(Staff).get(staff_id)

    def get_by_max_id(self, max_id: int) -> Staff | None:
        return self.db.query(Staff).filter(Staff.max_id == max_id).first()

    def get_by_company(self, company_id: int) -> list[Staff]:
        return self.db.query(Staff).filter(
            Staff.company_id == company_id,
            Staff.is_active == True,
        ).all()

    def deactivate(self, staff_id: int) -> dict:
        staff = self.db.query(Staff).get(staff_id)
        if not staff:
            return {"ok": False, "error":"Сотрудник не найден"}

        staff.is_active = False
        self.db.commit()
        return {"ok": True}