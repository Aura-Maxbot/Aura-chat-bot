from sqlalchemy import Column, Integer, String, Boolean, BigInteger, DateTime, ForeignKey
from sqlalchemy.orm import relationship
#from core.database import Base

class Resident(Base):
    __tablename__ = "resident"

    id = Column(Integer, primary_key=True)
    apartment_id = Column(Integer, ForeignKey("apartment.id"), nullable=False)
    max_id = Column(BigInteger, unique=True)
    full_name = Column(String(255))
    phone = Column(String(20))
    role = Column(String(50), nullable=False)
    invited_by = Column(Integer, ForeignKey("resident.id"), nullable=True)
    access_expires_at = Column(DateTime, nullable=True)
    is_active = Column(Boolean, default=True)

    apartment = relationship("Apartment", back_populates="residents")
    requests = relationship("Request", back_populates="resident")