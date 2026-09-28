from datetime import datetime
from sqlalchemy.orm import Session
from models.resident import Resident
from models.invite_code import InviteCode
from code_generator import normalize_phone


class ResidentLogic:

    def __init__(self, db: Session):
        self.db = db

    def bind_owner_by_code(self, code: str, max_id: int,
                            full_name: str | None = None) -> dict:
        existing = self.db.query(Resident).filter(
            Resident.max_id == max_id
        ).first()
        if existing:
            return {"ok": False, "error": "Вы уже привязаны"}

        invite = self.db.query(InviteCode).filter(
            InviteCode.code == code,
            InviteCode.is_active == True,
        ).first()

        if not invite:
            return {"ok": False, "error": "Код не найден"}

        if invite.expires_at and invite.expires_at < datetime.utcnow():
            return {"ok": False, "error": "Код устарел"}

        if invite.used_at:
            return {"ok": False, "error": "Код уже использован"}

        resident = Resident(
            apartment_id=invite.apartment_id,
            max_id=max_id,
            full_name=full_name,
            role="owner",
            is_active=True,
        )
        self.db.add(resident)

        invite.used_at = datetime.utcnow()
        invite.is_active = False

        self.db.commit()

        return {
            "ok": True,
            "resident_id": resident.id,
            "role": "owner",
            "apartment_id": invite.apartment_id,
        }

    def add_family_member(self, apartment_id: int, phone: str,
                           full_name: str, role: str,
                           invited_by: int) -> dict:
        phone = normalize_phone(phone)

        existing = self.db.query(Resident).filter(
            Resident.phone == phone
        ).first()
        if existing:
            return {"ok": False, "error": "Житель с таким номером уже есть"}

        resident = Resident(
            apartment_id=apartment_id,
            phone=phone,
            full_name=full_name,
            role=role,
            invited_by=invited_by,
            is_active=False,
        )
        self.db.add(resident)
        self.db.commit()

        return {
            "ok": True,
            "resident_id": resident.id,
            "message": "Житель добавлен. Пусть введёт свой номер в боте",
        }

    def activate_by_phone(self, phone: str, max_id: int,
                           full_name: str | None = None) -> dict:
        phone = normalize_phone(phone)

        resident = self.db.query(Resident).filter(
            Resident.phone == phone
        ).first()

        if not resident:
            return {"ok": False, "error": "Житель с таким номером не найден"}

        if resident.max_id:
            return {"ok": False, "error": "Этот житель уже привязан"}

        resident.max_id = max_id
        resident.is_active = True
        if full_name and not resident.full_name:
            resident.full_name = full_name

        self.db.commit()

        return {
            "ok": True,
            "resident_id": resident.id,
            "role": resident.role,
            "apartment_id": resident.apartment_id,
        }

    def get(self, resident_id: int) -> Resident | None:
        return self.db.query(Resident).get(resident_id)

    def get_by_max_id(self, max_id: int) -> Resident | None:
        return self.db.query(Resident).filter(
            Resident.max_id == max_id
        ).first()

    def deactivate(self, resident_id: int) -> dict:
        resident = self.db.query(Resident).get(resident_id)
        if not resident:
            return {"ok": False, "error": "Житель не найден"}

        resident.is_active = False
        self.db.commit()
        return {"ok": True}