import secrets
 
# Алфавит без похожих символов (0/O, 1/I), чтобы код было легко вводить руками
ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
 
 
def generate_code(prefix: str = "", length: int = 8) -> str:
    """
    Генерирует случайный код, например KV-7H3K9P2M.
    Без prefix вернёт только случайную часть.
    """
    body = "".join(secrets.choice(ALPHABET) for _ in range(length))
    return f"{prefix}-{body}" if prefix else body
 