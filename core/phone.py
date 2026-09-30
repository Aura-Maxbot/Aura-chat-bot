import re


def normalize_phone(raw: str | None) -> str | None:
    """Приводит номер к виду 79990000000. Если номер некорректный, вернёт None."""
    if not raw:
        return None
    digits = re.sub(r"\D", "", raw)
    if len(digits) == 11 and digits.startswith("8"):
        digits = "7" + digits[1:]
    elif len(digits) == 10:
        digits = "7" + digits
    return digits if re.fullmatch(r"7\d{10}", digits) else None