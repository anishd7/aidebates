"""Tests for backend/app/schemas/keys.py Pydantic schemas."""

from datetime import datetime, timezone

import pytest
from pydantic import ValidationError

from app.schemas.keys import (
    DecryptedKeysResponse,
    DeleteKeyResponse,
    KeyInfo,
    KeyListResponse,
    Provider,
    SaveKeyRequest,
)


class TestProvider:
    def test_valid_providers(self):
        assert Provider("openai") == Provider.openai
        assert Provider("anthropic") == Provider.anthropic

    def test_invalid_provider(self):
        with pytest.raises(ValueError):
            Provider("google")


class TestSaveKeyRequest:
    def test_valid_request(self):
        req = SaveKeyRequest(provider="openai", api_key="sk-abc123")
        assert req.provider == Provider.openai
        assert req.api_key == "sk-abc123"

    def test_anthropic_provider(self):
        req = SaveKeyRequest(provider="anthropic", api_key="sk-ant-xyz")
        assert req.provider == Provider.anthropic

    def test_invalid_provider_rejected(self):
        with pytest.raises(ValidationError) as exc_info:
            SaveKeyRequest(provider="google", api_key="key123")
        assert "provider" in str(exc_info.value)

    def test_empty_api_key_rejected(self):
        with pytest.raises(ValidationError) as exc_info:
            SaveKeyRequest(provider="openai", api_key="")
        assert "api_key" in str(exc_info.value)

    def test_missing_api_key_rejected(self):
        with pytest.raises(ValidationError):
            SaveKeyRequest(provider="openai")


class TestKeyInfo:
    def test_valid_key_info(self):
        now = datetime.now(timezone.utc)
        info = KeyInfo(provider="openai", key_last_four="c123", updated_at=now)
        assert info.provider == "openai"
        assert info.key_last_four == "c123"
        assert info.updated_at == now

    def test_from_attributes(self):
        """Verify from_attributes is enabled for ORM model compatibility."""

        class FakeORM:
            provider = "anthropic"
            key_last_four = "xyz9"
            updated_at = datetime(2025, 1, 1, tzinfo=timezone.utc)

        info = KeyInfo.model_validate(FakeORM())
        assert info.provider == "anthropic"
        assert info.key_last_four == "xyz9"


class TestKeyListResponse:
    def test_empty_list(self):
        resp = KeyListResponse(keys=[])
        assert resp.keys == []

    def test_multiple_keys(self):
        now = datetime.now(timezone.utc)
        resp = KeyListResponse(
            keys=[
                KeyInfo(provider="openai", key_last_four="1234", updated_at=now),
                KeyInfo(provider="anthropic", key_last_four="5678", updated_at=now),
            ]
        )
        assert len(resp.keys) == 2


class TestDecryptedKeysResponse:
    def test_both_keys_present(self):
        resp = DecryptedKeysResponse(keys={"openai": "sk-abc", "anthropic": "sk-ant"})
        assert resp.keys["openai"] == "sk-abc"
        assert resp.keys["anthropic"] == "sk-ant"

    def test_null_values(self):
        resp = DecryptedKeysResponse(keys={"openai": None, "anthropic": None})
        assert resp.keys["openai"] is None
        assert resp.keys["anthropic"] is None

    def test_partial_keys(self):
        resp = DecryptedKeysResponse(keys={"openai": "sk-abc", "anthropic": None})
        assert resp.keys["openai"] == "sk-abc"
        assert resp.keys["anthropic"] is None


class TestDeleteKeyResponse:
    def test_delete_response(self):
        resp = DeleteKeyResponse(deleted=True, provider="openai")
        assert resp.deleted is True
        assert resp.provider == "openai"
