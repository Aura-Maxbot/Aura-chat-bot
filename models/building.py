from sqlalchemy import Column, Integer, String, BigInteger, ForeignKey
from sqlalchemy.orm import relationship
from core.database import Base

class Building(Base):
    __tablename__ = "building"

    id = Column(Integer, primary_key=True)
    company_id = Column(Integer, ForeignKey("company.id"), nullable=False)
    address = Column(String(500), nullable=False)
    entrances_count = Column(Integer)
    floors_count = Column(Integer)
    max_chat_id = Column(BigInteger)

    company = relationship("Company", back_populates="buildings")
    apartments = relationship("Apartment", back_populates="building")