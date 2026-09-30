import logging
from io import BytesIO

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font
from sqlalchemy import func
from sqlalchemy.orm import Session

from models.apartment import Apartment
from models.building import Building
from models.code_generator import generate_code

logger = logging.getLogger(__name__)

MAX_APARTMENTS = 2000
MAX_FLOORS = 100
MAX_ADDRESS_LEN = 500
IN_CHUNK = 500  # лимит параметров в IN


class BuildingLogic:

    def __init__(self, db: Session):
        self.db = db

    def _generate_unique_codes(self, count: int) -> list[str]:
        """Генерирует count кодов, которых ещё нет ни в БД, ни среди уже сгенерированных."""
        codes: list[str] = []
        used: set[str] = set()

        while len(codes) < count:
            batch: list[str] = []
            for _ in range(count - len(codes)):
                code = generate_code(prefix="KV")
                if code not in used:
                    used.add(code)
                    batch.append(code)

            taken: set[str] = set()
            for i in range(0, len(batch), IN_CHUNK):
                part = batch[i:i + IN_CHUNK]
                rows = self.db.query(Apartment.code).filter(Apartment.code.in_(part)).all()
                taken.update(code for (code,) in rows)

            codes.extend(code for code in batch if code not in taken)

        return codes

    def add_building(self, company_id: int, address: str,
                     apartments_count: int, floors_count: int) -> dict:
        if not company_id:
            return {"ok": False, "error": "Компания не найдена"}

        address = (address or "").strip()
        if not address:
            return {"ok": False, "error": "Укажите адрес"}
        if len(address) > MAX_ADDRESS_LEN:
            return {"ok": False, "error": f"Адрес слишком длинный (максимум {MAX_ADDRESS_LEN} символов)"}

        if not 1 <= apartments_count <= MAX_APARTMENTS:
            return {"ok": False, "error": f"Количество квартир должно быть от 1 до {MAX_APARTMENTS}"}
        if not 1 <= floors_count <= MAX_FLOORS:
            return {"ok": False, "error": f"Количество этажей должно быть от 1 до {MAX_FLOORS}"}

        existing = self.db.query(Building).filter(
            Building.company_id == company_id,
            func.lower(Building.address) == address.lower(),
        ).first()
        if existing:
            return {"ok": False, "error": "Дом с таким адресом уже добавлен"}

        try:
            building = Building(
                company_id=company_id,
                address=address,
                floors_count=floors_count,
            )
            self.db.add(building)
            self.db.flush()

            codes = self._generate_unique_codes(apartments_count)
            self.db.add_all([
                Apartment(
                    building_id=building.id,
                    number=str(number),
                    code=codes[number - 1],
                )
                for number in range(1, apartments_count + 1)
            ])
            self.db.commit()
        except Exception:
            self.db.rollback()
            logger.exception("Не удалось добавить дом")
            return {"ok": False, "error": "Не удалось сохранить дом. Попробуйте позже"}

        return {
            "ok": True,
            "building_id": building.id,
            "apartments_count": apartments_count,
        }

    def get_codes(self, building_id: int, company_id: int) -> dict | None:
        """Квартиры и коды дома. Дом должен принадлежать указанной компании."""
        building = self.db.query(Building).filter(
            Building.id == building_id,
            Building.company_id == company_id,
        ).first()
        if not building:
            return None

        apartments = self.db.query(Apartment).filter(
            Apartment.building_id == building.id,
        ).order_by(Apartment.id).all()

        return {
            "address": building.address,
            "rows": [(a.number, a.code) for a in apartments],
        }

    @staticmethod
    def build_xlsx(rows: list[tuple[str, str]]) -> bytes:
        """Таблица «Квартира - Код» в формате xlsx."""
        wb = Workbook()
        ws = wb.active
        ws.title = "Коды квартир"

        ws.append(["Квартира", "Код"])
        for cell in ws[1]:
            cell.font = Font(bold=True)
            cell.alignment = Alignment(horizontal="center")

        for number, code in rows:
            ws.append([int(number) if str(number).isdigit() else number, code])

        ws.column_dimensions["A"].width = 12
        ws.column_dimensions["B"].width = 20
        ws.freeze_panes = "A2"

        buffer = BytesIO()
        wb.save(buffer)
        return buffer.getvalue()
