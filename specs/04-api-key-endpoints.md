# Component: API Key Management Endpoints

## Overview
CRUD endpoints for users to manage their BYOK (Bring Your Own Key) API keys for OpenAI and Anthropic providers. Keys are stored encrypted in the database.

## What It Does
- `POST /api/v1/keys` — Save or update (upsert) an API key for a provider
- `GET /api/v1/keys` — List configured providers with masked key info
- `GET /api/v1/keys/decrypt` — Fetch full decrypted keys (called once per session)
- `DELETE /api/v1/keys/{provider}` — Delete a stored API key

## Files to Create
- `backend/app/routers/keys.py` — route handlers
- `backend/app/schemas/__init__.py`
- `backend/app/schemas/keys.py` — Pydantic request/response schemas

## Dependencies
- Component `01-database-models` (UserApiKey model)
- Component `02-backend-config` (FastAPI app, settings)
- Component `03-encryption-service` (encrypt/decrypt functions)
- Component `05-auth-middleware` (for `get_current_user` dependency)

## Pydantic Schemas

### Request: `SaveKeyRequest`
```
{
  "provider": str,   # "openai" or "anthropic"
  "api_key": str     # full API key string
}
```

### Response: `KeyInfo`
```
{
  "provider": str,
  "key_last_four": str,
  "updated_at": datetime
}
```

### Response: `KeyListResponse`
```
{
  "keys": list[KeyInfo]
}
```

### Response: `DecryptedKeysResponse`
```
{
  "keys": {
    "openai": str | null,
    "anthropic": str | null
  }
}
```

## Endpoint Details

### `POST /api/v1/keys`
- **Auth**: Required
- **Input**: `SaveKeyRequest` body
- **Behavior**:
  1. Validate `provider` is "openai" or "anthropic"
  2. Encrypt the API key using `encrypt_key()`
  3. Extract last 4 chars via `get_key_last_four()`
  4. Upsert into `user_api_keys` (INSERT ON CONFLICT UPDATE on `user_id + provider`)
  5. Return `KeyInfo`
- **Output**: 200 with `KeyInfo`
- **Errors**: 400 if invalid provider, 401 if unauthenticated

### `GET /api/v1/keys`
- **Auth**: Required
- **Behavior**: Query `user_api_keys` for the authenticated user, return metadata only
- **Output**: 200 with `KeyListResponse`

### `GET /api/v1/keys/decrypt`
- **Auth**: Required
- **Behavior**: Query all keys for user, decrypt each, return as provider->key map
- **Output**: 200 with `DecryptedKeysResponse`
- **Security**: This returns sensitive data. Must only be served over HTTPS in production.

### `DELETE /api/v1/keys/{provider}`
- **Auth**: Required
- **Behavior**: Delete the key for the given provider, if it exists
- **Output**: 200 with `{"deleted": true, "provider": "<provider>"}`
- **Errors**: 404 if no key exists for this provider

## Behavior & Constraints
- One key per provider per user (enforced by unique constraint and upsert logic)
- The full API key is never returned by `GET /api/v1/keys` — only last 4 chars
- `GET /api/v1/keys/decrypt` is the only endpoint that returns full keys
- Provider values are restricted to `"openai"` and `"anthropic"`

## Relevant Skills
- `fastapi` — route handlers, dependency injection
- `python` — SQLAlchemy upsert patterns

### Recommended skills.sh Skills
- **fastapi-templates** — production-ready FastAPI route handlers with dependency injection and layered architecture
  ```bash
  npx skills add https://github.com/wshobson/agents --skill fastapi-templates
  ```
- **api-design-principles** — REST API design principles covering HTTP method semantics, error handling, and consistent status codes
  ```bash
  npx skills add https://github.com/wshobson/agents --skill api-design-principles
  ```

## Tests to Validate
- **Save key**: POST a key, verify 200 response with correct `key_last_four`
- **Upsert**: POST a key for the same provider twice, verify the second updates (not duplicates)
- **List keys**: After saving 2 keys, GET returns both with metadata only (no full keys)
- **Decrypt keys**: After saving keys, GET decrypt returns full plaintext keys
- **Delete key**: DELETE a key, verify it's gone from list
- **Delete non-existent**: DELETE a provider with no key returns 404
- **Invalid provider**: POST with `provider: "google"` returns 400
- **Auth required**: All endpoints return 401 without a valid JWT
