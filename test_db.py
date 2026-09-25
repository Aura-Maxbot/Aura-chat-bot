from core.database import SessionLocal
from models import Company

db = SessionLocal()

company = Company(name="Тестовая УК", email="test@uk.ru", phone="+79990000000")
db.add(company)
db.commit()
db.refresh(company)

print(f"Создана УК: id={company.id}, name={company.name}")

db.close()