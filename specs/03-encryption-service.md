# Component: Encryption Service

## Overview
Symmetric encryption/decryption of user API keys at rest using Fernet (from the `cryptography` library). API keys are encrypted before storage and decrypted only when needed.

## What It Does
- Encrypts plaintext API keys into ciphertext for database storage
- Decrypts stored ciphertext back to plaintext for use in API calls
- Extracts the last 4 characters of a key for display purposes

## Files to Create
- `backend/app/services/__init__.py`
- `backend/app/services/encryption.py`

## Dependencies
- `cryptography>=42.0`
- Component `02-backend-config` (for `ENCRYPTION_KEY` from settings)

## Inputs
- `encrypt_key(plaintext: str) -> str` — plaintext API key
- `decrypt_key(ciphertext: str) -> str` — encrypted API key from DB
- `get_key_last_four(plaintext: str) -> str` — plaintext API key

## Outputs
- `encrypt_key` returns a Fernet-encrypted string (URL-safe base64)
- `decrypt_key` returns the original plaintext API key
- `get_key_last_four` returns the last 4 characters of the key

## Behavior & Constraints
- Uses `cryptography.fernet.Fernet` with the server's `ENCRYPTION_KEY`
- The `ENCRYPTION_KEY` must be a valid Fernet key (32 url-safe base64-encoded bytes)
- The Fernet instance should be created once (module-level or lazy singleton), not per-call
- `decrypt_key` raises an appropriate error if the ciphertext is invalid or the key has changed
- Keys should never be logged or appear in error messages

## Relevant Skills
- `python` — cryptography library usage

### Recommended skills.sh Skills
- **python-testing-patterns** — comprehensive pytest guide with fixtures, mocking, and test-driven development; useful for writing the round-trip and error-case tests for this service
  ```bash
  npx skills add https://github.com/wshobson/agents --skill python-testing-patterns
  ```

## Tests to Validate
- **Round-trip**: `decrypt_key(encrypt_key("sk-test123"))` returns `"sk-test123"`
- **Different ciphertexts**: Encrypting the same plaintext twice produces different ciphertexts (Fernet includes a timestamp)
- **Last four**: `get_key_last_four("sk-abc123xyz")` returns `"cxyz"` (last 4 chars)
- **Invalid ciphertext**: `decrypt_key("garbage")` raises an error
- **Wrong key**: Decrypting with a different `ENCRYPTION_KEY` raises an error
