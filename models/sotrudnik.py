from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, BigInteger
from sqlalchemy.orm import relationship
#from core.database import Base


class Sotrudnik(Base):
    __tablename__ = "sotrudnik"

    id = Column(Integer, primary_key=True)
    uk_id = Column(Integer, ForeignKey("uk.id"), nullable=True)
    max_id = Column(BigInteger, unique=True, nullable=True)

    full_name = Column(String(255), nullable=False)
    phone = Column(String(20))
    role = Column(String(50), nullable=False)
    is_active = Column(Boolean, default=True)

    uk = relationship("UK", back_populates="sotrudnik")