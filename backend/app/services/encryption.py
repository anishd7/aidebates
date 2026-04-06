from cryptography.fernet import Fernet, InvalidToken

from app.config import settings

_fernet: Fernet | None = None


def _get_fernet() -> Fernet:
    global _fernet
    if _fernet is None:
        _fernet = Fernet(settings.ENCRYPTION_KEY.encode())
    return _fernet


def encrypt_key(plaintext: str) -> str:
    """Encrypt a plaintext API key for database storage."""
    return _get_fernet().encrypt(plaintext.encode()).decode()


def decrypt_key(ciphertext: str) -> str:
    """Decrypt a stored API key ciphertext back to plaintext."""
    try:
        return _get_fernet().decrypt(ciphertext.encode()).decode()
    except (InvalidToken, Exception) as e:
        raise ValueError("Failed to decrypt API key: invalid ciphertext or wrong encryption key") from e


def get_key_last_four(plaintext: str) -> str:
    """Return the last 4 characters of an API key for display."""
    return plaintext[-4:]
