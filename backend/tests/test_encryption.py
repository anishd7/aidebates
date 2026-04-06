import os
from unittest.mock import patch

import pytest
from cryptography.fernet import Fernet

import app.services.encryption as encryption_mod
from app.services.encryption import decrypt_key, encrypt_key, get_key_last_four


@pytest.fixture(autouse=True)
def reset_fernet_singleton():
    """Reset the module-level Fernet singleton between tests."""
    encryption_mod._fernet = None
    yield
    encryption_mod._fernet = None


class TestEncryptDecryptRoundTrip:
    def test_round_trip(self):
        plaintext = "sk-test123"
        ciphertext = encrypt_key(plaintext)
        assert decrypt_key(ciphertext) == plaintext

    def test_round_trip_long_key(self):
        plaintext = "sk-proj-abcdefghijklmnopqrstuvwxyz1234567890ABCDEFGHIJKLMNOP"
        ciphertext = encrypt_key(plaintext)
        assert decrypt_key(ciphertext) == plaintext

    def test_different_ciphertexts_each_call(self):
        plaintext = "sk-test123"
        ct1 = encrypt_key(plaintext)
        ct2 = encrypt_key(plaintext)
        assert ct1 != ct2
        assert decrypt_key(ct1) == plaintext
        assert decrypt_key(ct2) == plaintext


class TestDecryptErrors:
    def test_invalid_ciphertext(self):
        with pytest.raises(ValueError, match="Failed to decrypt"):
            decrypt_key("garbage")

    def test_wrong_encryption_key(self):
        plaintext = "sk-test123"
        ciphertext = encrypt_key(plaintext)

        # Create a Fernet with a different key and inject it
        different_key = Fernet.generate_key()
        encryption_mod._fernet = Fernet(different_key)
        with pytest.raises(ValueError, match="Failed to decrypt"):
            decrypt_key(ciphertext)


class TestGetKeyLastFour:
    def test_last_four(self):
        assert get_key_last_four("sk-abc123xyz") == "3xyz"

    def test_exactly_four_chars(self):
        assert get_key_last_four("abcd") == "abcd"

    def test_short_key(self):
        assert get_key_last_four("ab") == "ab"
