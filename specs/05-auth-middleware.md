# Component: Authentication Middleware

## Overview
JWT validation middleware for the FastAPI backend. Validates tokens issued by NextAuth.js using a shared secret. Also handles user creation/lookup on first sign-in.

## What It Does
- Extracts and validates JWT from the `Authorization: Bearer <token>` header
- Returns the authenticated `user_id` as a FastAPI dependency
- Creates a user record in the DB on first authentication (if not exists)
- Provides an optional auth dependency for endpoints with mixed auth (e.g., shared debates)

## Files to Create
- `backend/app/middleware/__init__.py`
- `backend/app/middleware/auth.py`

## Dependencies
- `python-jose[cryptography]>=3.3`
- Component `01-database-models` (User model)
- Component `02-backend-config` (for `NEXTAUTH_SECRET`)

## Inputs
- `Authorization` header with format `Bearer <jwt>`
- JWT payload contains at minimum: `sub` (user ID or email), `email`, `name`, `picture`

## Outputs
- `get_current_user(authorization: str) -> str` — returns `user_id` (UUID string)
- `get_optional_user(authorization: str | None) -> str | None` — returns `user_id` or None

## Behavior & Constraints

### `get_current_user` (strict auth)
1. Extract token from `Authorization: Bearer <token>` header
2. Decode with `python-jose` using `NEXTAUTH_SECRET` and `HS256` algorithm
3. Extract `sub` from payload — this is the user identifier
4. Look up user in `users` table by email (from token)
5. If user doesn't exist, create them (email, name, avatar_url from token claims)
6. Return the user's UUID `id`
7. On any failure: raise `HTTPException(401, "Invalid token")`

### `get_optional_user` (optional auth)
- Same as above but returns `None` instead of raising 401 if no token is provided
- Still raises 401 if a token IS provided but is invalid
- Used for endpoints like `GET /debates/{id}` that serve both authenticated and public requests

### JWT Token Structure (from NextAuth)
```json
{
  "sub": "<user-email-or-id>",
  "email": "user@example.com",
  "name": "User Name",
  "picture": "https://...",
  "iat": 1712300000,
  "exp": 1712390000
}
```

### Constraints
- The JWT secret is shared between NextAuth.js and FastAPI via `NEXTAUTH_SECRET`
- Algorithm is `HS256`
- Expired tokens must be rejected
- The middleware should NOT make a DB call on every request if possible — but for MVP, a lookup per request is acceptable
- User creation is idempotent (use email as the natural key for lookup)

## Relevant Skills
- `fastapi` — dependency injection, middleware patterns
- `python` — JWT validation with python-jose

### Recommended skills.sh Skills
- **fastapi-templates** — covers authentication via JWT tokens and dependency-based authorization checks on protected endpoints
  ```bash
  npx skills add https://github.com/wshobson/agents --skill fastapi-templates
  ```
- **python-testing-patterns** — pytest patterns for testing auth flows, including mocking and fixture-based setup
  ```bash
  npx skills add https://github.com/wshobson/agents --skill python-testing-patterns
  ```

## Tests to Validate
- **Valid token**: A properly signed JWT returns the correct user_id
- **Expired token**: An expired JWT raises 401
- **Invalid signature**: A JWT signed with a different secret raises 401
- **Missing header**: No Authorization header raises 401 (strict) or returns None (optional)
- **Malformed header**: `Authorization: NotBearer xyz` raises 401
- **User creation**: First auth with a new email creates a user record in the DB
- **User lookup**: Subsequent auth with same email returns the same user_id
- **Optional auth with token**: Valid token returns user_id
- **Optional auth without token**: No token returns None
- **Optional auth with bad token**: Invalid token still raises 401
