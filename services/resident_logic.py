import logging

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from models.apartment import Apartment
from models.resident import Resident

logger = logging.getLogger(__name__)

# Мобильные клавиатуры часто подменяют дефис на длинное тире
_DASHES = str.maketrans({"–": "-", "—": "-", "−": "-"})


def normalize_code(raw: str | None) -> str:
    """Убирает пробелы, приводит к верхнему регистру и заменяет тире на дефис."""
    if not raw:
        return ""
    return "".join(raw.split()).upper().translate(_DASHES)


class ResidentLogic:

    RESIDENT_ROLE = "resident"

    def __init__(self, db: Session):
        self.db = db

    @staticmethod
    def _to_info(resident: Resident) -> dict:
        apartment = resident.apartment
        building = apartment.building if apartment else None
        company = building.company if building else None

        return {
            "resident_id": resident.id,
            "full_name": resident.full_name,
            "apartment_id": resident.apartment_id,
            "apartment_number": apartment.number if apartment else None,
            "address": building.address if building else None,
            "company_id": building.company_id if building else None,
            "company_name": company.name if company else None,
        }

    def get_by_max_id(self, max_id: int) -> dict | None:
        resident = self.db.query(Resident).filter(
            Resident.max_id == max_id,
            Resident.is_active == True,
        ).first()
        return self._to_info(resident) if resident else None

    def bind_by_code(self, code: str, max_id: int, full_name: str | None) -> dict:
        """
        Привязывает пользователя MAX к квартире по коду.
        found=False означает, что код не найден. Остальные проблемы приходят как ok=False.
        """
        code = normalize_code(code)
        if not code:
            return {"ok": True, "found": False}

        apartment = self.db.query(Apartment).filter(Apartment.code == code).first()
        if not apartment:
            return {"ok": True, "found": False}

        resident = self.db.query(Resident).filter(Resident.max_id == max_id).first()
        if resident:
            if not resident.is_active:
                return {"ok": False, "error": "Доступ отключён. Обратитесь в УК."}
            if resident.apartment_id != apartment.id:
                return {"ok": False, "error": "Вы уже привязаны к другой квартире. Для смены обратитесь в УК."}
            # Повторный ввод кода той же квартиры: просто возвращаем данные
            return {"ok": True, "found": True, **self._to_info(resident)}

        resident = Resident(
            apartment_id=apartment.id,
            max_id=max_id,
            full_name=(full_name or "").strip() or None,
            role=self.RESIDENT_ROLE,
            is_active=True,
        )
        try:
            self.db.add(resident)
            self.db.commit()
            self.db.refresh(resident)
        except IntegrityError:
            # Параллельный запрос успел привязать этого же пользователя
            self.db.rollback()
            logger.exception("Не удалось привязать жителя")
            return {"ok": False, "error": "Не удалось привязать квартиру. Попробуйте ещё раз."}

        return {"ok": True, "found": True, **self._to_info(resident)}
