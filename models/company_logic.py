from sqlalchemy.orm import Session
from models.company import Company
from models.staff import Staff
from code_generator import generate_code

class CompanyLogic:

    def __init__(self, db: Session):
        self.db = db

    def register(self, name: str, email: str, phone: str,
                 admin_max_id: int, admin_name: str) -> dict:
        existing = self.db.query(Company).filter(Company.name == name).first()
        if existing:
            return {"ok": False, "error": "Компания с таким названием уже существует"}

        company = Company(name=name, email=email, phone=phone, is_active=True)
        self.db.add(company)
        self.db.flush()

        admin = Staff(
            company_id=company.id,
            max_id=admin_max_id,
            full_name=admin_name,
            role="admin",
            is_active=True,
        )
        self.db.add(admin)
        self.db.commit()

        return {
            "ok": True,
            "company_id": company.id,
            "admin_staff_id": admin.id,
            "message": "Компания создана",
        }

    def generate_owner_codes(self, company_id: int, apartment_id: int,
                             created_by: int) -> dict:
        company = self.db.query(Company).get(company_id)
        if not company:
            return {"ok": False, "error": "Компания не найдена"}

        code = generate_code(prefix="OWNER")

        from models.invite_code import InviteCode
        invite = InviteCode(
            company_id=company_id,
            code=code,
            type="owner",
            apartment_id=apartment_id,
            target_role="owner",
            created_by_staff=created_by,
        )
        self.db.add(invite)
        self.db.commit()

        return {"ok": True, "code": code}

    def get(self, company_id: int) -> Company | None:
        return self.db.query(Company).get(company_id)

    def get_active(self) -> list[Company]:
        return self.db.query(Company).filter(Company.is_active == True).all()