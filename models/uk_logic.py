from sqlalchemy.orm import Session
from models.uk import UK
from models.sotrudnik import Sotrudnik
from code_generator import generate_code

class UK_Logic:
    def __init__(self, db: Session):
        self.db = db

    def register(self, name: str, email: str, phone: str,
                 chairman_max_id: int, chairman_name: str) -> dict:

        existing = self.db.query(UK).filter(UK.name == name).first()
        if existing:
            return {"ok": False, "error": "УК с таким названием уже существует"}

        uk = UK(name=name, email=email, phone=phone, is_active=True)
        self.db.add(uk)
        self.db.flush()

        chairman = Sotrudnik(
            uk_id=uk.id,
            max_id=chairman_max_id,
            full_name=chairman_name,
            role="chairman",
            is_active=True,
        )
        self.db.add(chairman)
        self.db.commit()

        return {
            "ok": True,
            "uk_id": uk.id,
            "message": "УК создана",
        }

    def generate_owner_codes(self, uk_id: int, apartment_id: int,
                             created_by: int) -> dict:
        uk = self.db.query(UK).get(uk_id)
        if not uk:
            return {"ok": False, "error": "УК не найдена"}

        code = generate_code(prefix="OWNER")

        from models.invite_code import InviteCode
        invite = InviteCode(
            uk_id=uk_id,
            code=code,
            type="owner",
            apartment_id=apartment_id,
            target_role="owner",
            created_by_staff=created_by,
        )
        self.db.add(invite)
        self.db.commit()

        return {"ok": True, "code": code}


    def get(self, uk_id: int) -> UK | None:
        return self.db.query(UK).get(uk_id)

    def get_active(self) -> list[UK]:
        return self.db.query(UK).filter(UK.is_active == True).all()