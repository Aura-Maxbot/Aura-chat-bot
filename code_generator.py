import random
import re
from sqlalchemy.orm import Session


CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'


def generate_apartment_code() -> str:
    return ''.join(random.choices(CODE_ALPHABET, k=6))


def generate_unique_apartment_code(db: Session) -> str:
    from models.invite_code import InviteCode
    code = generate_apartment_code()
    while db.query(InviteCode).filter(InviteCode.code == code).first():
        code = generate_apartment_code()
    return code


def generate_code() -> str:
    return generate_apartment_code()


def normalize_phone(phone: str) -> str:
    cleaned = re.sub(r'[^\d+]', '', phone)
    if cleaned.startswith('8'):
        cleaned = '+7' + cleaned[1:]
    elif cleaned.startswith('7') and not cleaned.startswith('+'):
        cleaned = '+' + cleaned
    elif not cleaned.startswith('+'):
        cleaned = '+7' + cleaned
    return cleaned