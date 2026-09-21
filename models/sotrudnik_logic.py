from sqlalchemy.orm import Session
from datetime import datetime
from models.sotrudnik import Sotrudnik
from models.uk import UK
from code_generator import generate_code

class Sotrudnik_Logic:
    def __init__(self, db: Session):
        self.db = db

    def add(self, uk_id: int, full_name: str, phone: str,
            role: str, created_by: int) -> dict:
        
        uk = self.db.query(UK).get(uk_id)
        if not uk:
            return {"ok": False, "error":"УК не найдена"}

        allowed_roles = ["admin", "dispatcher", "main_dispatcher"]
        if role not in allowed_roles:
            return {"ok": False, "error": f"Недопустимая роль:{role}"}

        sotrudnik = Sotrudnik(
            uk_id=uk_id,
            full_name=full_name,
            phone=phone,
            role=role,
            is_active=False,
        )
        self.db.add(sotrudnik)
        self.db.flush()

        code = generate_code(prefix="STAFF")

        from models.invite_code import InviteCode
        invite = InviteCode(
            uk_id=uk_id,
            code=code,
            type="staff",
            target_role=role,
            created_by_staff=created_by,
        )
        self.db.add(invite)
        self.db.commit()

        return {
            "ok": True,
            "sotrudnik_id": sotrudnik.id,
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

        sotrudnik = self.db.query(Sotrudnik).filter(
            Sotrudnik.uk_id == invite.uk_id,
            Sotrudnik.role == invite.target_role,
            Sotrudnik.max_id == None,
            Sotrudnik.is_active == False,
        ).first()

        if not sotrudnik:
            return {"ok": False}

        sotrudnik.max_id = max_id
        sotrudnik.is_active = True

        invite.used_at = datetime.utcnow()
        invite.is_active = False

        self.db.commit()

        return {
            "ok": True,
            "sotrudnik_id": sotrudnik.id,
            "role": sotrudnik.role,
            "uk_id": sotrudnik.uk_id,
        }


    def get(self, sotrudnik_id: int) -> Sotrudnik | None:
        return self.db.query(Sotrudnik).get(sotrudnik_id)

    def get_by_max_id(self, max_id: int) -> Sotrudnik | None:
        return self.db.query(Sotrudnik).filter(Sotrudnik.max_id == max_id).first()

    def get_by_uk(self, uk_id: int) -> list[Sotrudnik]:
        return self.db.query(Sotrudnik).filter(
            Sotrudnik.uk_id == uk_id,
            Sotrudnik.is_active == True,
        ).all()

    def deactivate(self, sotrudnik_id: int) -> dict:
        sotrudnik = self.db.query(Sotrudnik).get(sotrudnik_id)
        if not sotrudnik:
            return {"ok": False, "error":"Сотрудник не найден"}

        sotrudnik.is_active = False
        self.db.commit()
        return {"ok": True}