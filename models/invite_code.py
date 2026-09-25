from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from datetime import datetime
from core.database import Base

class InviteCode(Base):
    __tablename__ = "invite_code"

    id = Column(Integer, primary_key=True)
    company_id = Column(Integer, ForeignKey("company.id"), nullable=False)
    code = Column(String(50), unique=True, nullable=False)
    type = Column(String(50), nullable=False)
    apartment_id = Column(Integer, ForeignKey("apartment.id"), nullable=True)
    target_role = Column(String(50))
    created_by_staff = Column(Integer, ForeignKey("staff.id"), nullable=True)
    created_by_resident = Column(Integer, ForeignKey("resident.id"), nullable=True)
    expires_at = Column(DateTime, nullable=True)
    used_at = Column(DateTime, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)