from sqlalchemy import Column, Integer, String, Boolean
from sqlalchemy.orm import relationship
#from core.database import Base

class UK(Base):
    __tablename__ = "uk"

    id = Column(Integer, primary_key=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255))
    phone = Column(String(20))
    is_active = Column(Boolean, default=True)

    sotrudnik = relationship("Sotrudnik", back_populates="uk")