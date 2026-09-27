from sqlalchemy import Column, Integer, String, Boolean, BigInteger, ForeignKey
from sqlalchemy.orm import relationship
from core.database import Base

class Staff(Base):
    __tablename__ = "staff"

    id = Column(Integer, primary_key=True)
    company_id = Column(Integer, ForeignKey("company.id"), nullable=True)
    max_id = Column(BigInteger, unique=True)
    full_name = Column(String(255), nullable=False)
    phone = Column(String(20))
    role = Column(String(50), nullable=False)
    is_active = Column(Boolean, default=True)

    company = relationship("Company", back_populates="staff")
    requests = relationship("Request", back_populates="executor")