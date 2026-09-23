from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
#from core.database import Base

class Apartment(Base):
    __tablename__ = "apartment"

    id = Column(Integer, primary_key=True)
    building_id = Column(Integer, ForeignKey("building.id"), nullable=False)
    number = Column(String(20), nullable=False)
    entrance = Column(Integer)
    floor = Column(Integer)
    code = Column(String(50), unique=True, nullable=False)

    building = relationship("Building", back_populates="apartments")
    residents = relationship("Resident", back_populates="apartment")
    requests = relationship("Request", back_populates="apartment")