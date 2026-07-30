from functools import lru_cache

import jwt
from fastapi import Header, HTTPException

from app.config import settings


@lru_cache(maxsize=1)
def _jwks_client() -> jwt.PyJWKClient:
    # Supabase's JWKS endpoint - works across key rotations, unlike a static secret.
    url = f"{settings.supabase_url}/auth/v1/.well-known/jwks.json"
    return jwt.PyJWKClient(url)


def get_current_user_id(authorization: str = Header(...)) -> str:
    if not authorization.startswith("Bearer "):
        raise HTTPException(401, "Missing bearer token")

    token = authorization.removeprefix("Bearer ").strip()
    try:
        signing_key = _jwks_client().get_signing_key_from_jwt(token)
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["ES256", "RS256"],
            audience="authenticated",
        )
    except jwt.PyJWTError as e:
        raise HTTPException(401, f"Invalid token: {e}")

    return payload["sub"]
