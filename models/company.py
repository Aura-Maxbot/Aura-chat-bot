from sqlalchemy import Column, Integer, String, Boolean
from sqlalchemy.orm import relationship
from core.database import Base

class Company(Base):
    __tablename__ = "company"

    id = Column(Integer, primary_key=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255))
    phone = Column(String(20))
    is_active = Column(Boolean, default=True)

    buildings = relationship("Building", back_populates="company")
    staff = relationship("Staff", back_populates="company")
    requests = relationship("Request", back_populates="company")