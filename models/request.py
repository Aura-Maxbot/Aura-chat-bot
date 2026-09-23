from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
#from core.database import Base

class Request(Base):
    __tablename__ = "request"

    id = Column(Integer, primary_key=True)
    company_id = Column(Integer, ForeignKey("company.id"), nullable=False)
    apartment_id = Column(Integer, ForeignKey("apartment.id"), nullable=False)
    resident_id = Column(Integer, ForeignKey("resident.id"), nullable=False)
    category = Column(String(50), nullable=False)
    description = Column(Text, nullable=False)
    photo = Column(String(500))
    status = Column(String(50), nullable=False)
    executor_id = Column(Integer, ForeignKey("staff.id"), nullable=True)
    rating = Column(Integer, nullable=True)
    rating_comment = Column(Text, nullable=True)
    rated_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    closed_at = Column(DateTime, nullable=True)

    company = relationship("Company", back_populates="requests")
    apartment = relationship("Apartment", back_populates="requests")
    resident = relationship("Resident", back_populates="requests")
    executor = relationship("Staff", back_populates="requests")