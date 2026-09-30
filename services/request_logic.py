import logging
from datetime import datetime

from sqlalchemy.orm import Session

from models.request import Request as RequestModel
from models.resident import Resident
from models.staff import Staff

logger = logging.getLogger(__name__)

STATUS_NEW = "Новая"
STATUS_ANSWERED = "Есть ответ"

ADMIN_ROLE = "admin"

# Ограничения должны совпадать с bot.js
MAX_DESCRIPTION_LEN = 2000
MAX_ANSWER_LEN = 3000
MAX_PHOTO_LEN = 500  # длина колонки request.photo


class RequestLogic:

    def __init__(self, db: Session):
        self.db = db

    def _get_resident(self, max_id: int) -> Resident | None:
        return self.db.query(Resident).filter(
            Resident.max_id == max_id,
            Resident.is_active == True,
        ).first()

    def _admin_max_ids(self, company_id: int, exclude_staff_id: int) -> list[int]:
        """MAX ID админов компании (кроме указанного сотрудника): им уходят копии."""
        admins = self.db.query(Staff).filter(
            Staff.company_id == company_id,
            Staff.role == ADMIN_ROLE,
            Staff.is_active == True,
            Staff.max_id.isnot(None),
            Staff.id != exclude_staff_id,
        ).all()
        return [a.max_id for a in admins]

    def list_recipients(self, max_id: int) -> dict:
        """Сотрудники УК жителя, которым можно отправить заявку."""
        resident = self._get_resident(max_id)
        if not resident:
            return {"ok": False, "error": "Вы не привязаны к квартире. Отправьте /start и введите код квартиры."}

        company_id = resident.apartment.building.company_id

        staff = self.db.query(Staff).filter(
            Staff.company_id == company_id,
            Staff.is_active == True,
            Staff.max_id.isnot(None),  # только те, кому бот может написать
        ).order_by(Staff.id).all()

        return {
            "ok": True,
            "staff": [
                {"staff_id": s.id, "role": s.role, "full_name": s.full_name}
                for s in staff
            ],
        }

    def create_request(self, max_id: int, staff_id: int,
                       description: str, photo: str | None) -> dict:
        description = (description or "").strip()
        if not description:
            return {"ok": False, "error": "Опишите проблему"}
        if len(description) > MAX_DESCRIPTION_LEN:
            return {"ok": False, "error": f"Описание слишком длинное (максимум {MAX_DESCRIPTION_LEN} символов)"}

        resident = self._get_resident(max_id)
        if not resident:
            return {"ok": False, "error": "Вы не привязаны к квартире"}

        apartment = resident.apartment
        building = apartment.building
        company_id = building.company_id

        # Сотрудник должен быть из УК этого жителя
        staff = self.db.query(Staff).filter(
            Staff.id == staff_id,
            Staff.company_id == company_id,
            Staff.is_active == True,
            Staff.max_id.isnot(None),
        ).first()
        if not staff:
            return {"ok": False, "error": "Выбранный сотрудник недоступен. Выберите другого"}

        photo = (photo or "").strip() or None
        if photo and len(photo) > MAX_PHOTO_LEN:
            return {"ok": False, "error": "Не удалось сохранить фото. Отправьте заявку без фото"}

        request = RequestModel(
            company_id=company_id,
            apartment_id=apartment.id,
            resident_id=resident.id,
            category=staff.role,
            description=description,
            photo=photo,
            status=STATUS_NEW,
            executor_id=staff.id,
        )
        try:
            self.db.add(request)
            self.db.commit()
            self.db.refresh(request)
        except Exception:
            self.db.rollback()
            logger.exception("Не удалось сохранить заявку")
            return {"ok": False, "error": "Не удалось сохранить заявку. Попробуйте позже"}

        return {
            "ok": True,
            "request_id": request.id,
            "category": staff.role,
            "staff_max_id": staff.max_id,
            "staff_role": staff.role,
            "staff_name": staff.full_name,
            "resident_name": resident.full_name,
            "address": building.address,
            "apartment_number": apartment.number,
            # Копии админам, если заявка адресована не им
            "admin_max_ids": self._admin_max_ids(company_id, exclude_staff_id=staff.id),
        }

    def answer_request(self, staff_max_id: int, request_id: int, answer: str) -> dict:
        answer = (answer or "").strip()
        if not answer:
            return {"ok": False, "error": "Введите ответ"}
        if len(answer) > MAX_ANSWER_LEN:
            return {"ok": False, "error": f"Ответ слишком длинный (максимум {MAX_ANSWER_LEN} символов)"}

        staff = self.db.query(Staff).filter(
            Staff.max_id == staff_max_id,
            Staff.is_active == True,
        ).first()
        if not staff:
            return {"ok": False, "error": "Нет прав для ответа на заявки"}

        request = self.db.query(RequestModel).filter(RequestModel.id == request_id).first()
        if not request:
            return {"ok": False, "error": "Заявка не найдена"}

        # Отвечать может только тот, кому адресована заявка
        if request.executor_id != staff.id:
            return {"ok": False, "error": "Эта заявка адресована другому сотруднику"}

        try:
            request.answer = answer
            request.answered_at = datetime.utcnow()
            request.status = STATUS_ANSWERED
            self.db.commit()
        except Exception:
            self.db.rollback()
            logger.exception("Не удалось сохранить ответ на заявку")
            return {"ok": False, "error": "Не удалось сохранить ответ. Попробуйте позже"}

        resident = request.resident
        apartment = request.apartment
        building = apartment.building

        return {
            "ok": True,
            "request_id": request.id,
            "resident_max_id": resident.max_id,
            "resident_name": resident.full_name,
            "address": building.address,
            "apartment_number": apartment.number,
            "staff_role": staff.role,
            "staff_name": staff.full_name,
            "admin_max_ids": self._admin_max_ids(request.company_id, exclude_staff_id=staff.id),
        }

    def list_my_requests(self, max_id: int, limit: int = 20) -> dict:
        resident = self._get_resident(max_id)
        if not resident:
            return {"ok": False, "error": "Вы не привязаны к квартире. Отправьте /start и введите код квартиры."}

        rows = self.db.query(RequestModel).filter(
            RequestModel.resident_id == resident.id,
        ).order_by(RequestModel.id.desc()).limit(limit).all()

        return {
            "ok": True,
            "requests": [
                {
                    "request_id": r.id,
                    "category": r.category,
                    "description": r.description,
                    "status": r.status,
                    "answer": r.answer,
                    "created_at": r.created_at.strftime("%d.%m.%Y") if r.created_at else None,
                }
                for r in rows
            ],
        }
