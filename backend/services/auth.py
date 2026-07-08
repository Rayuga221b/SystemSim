import os
from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt
from passlib.context import CryptContext

# Fail-soft in dev: generate an ephemeral secret (tokens die on restart) and
# warn loudly. Production MUST set JWT_SECRET — see .env.example.
SECRET_KEY = os.getenv("JWT_SECRET")
if not SECRET_KEY:
    import secrets
    SECRET_KEY = secrets.token_hex(32)
    print("WARNING: JWT_SECRET not set — using an ephemeral dev secret. "
          "All tokens invalidate on restart. Set JWT_SECRET in production.")
ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
EXPIRE_MINUTES = int(os.getenv("JWT_EXPIRE_MINUTES", "60"))

_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(plain: str) -> str:
    return _pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    return _pwd_context.verify(plain, hashed)


def create_access_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=EXPIRE_MINUTES),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_access_token(token: str) -> str:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str | None = payload.get("sub")
        if user_id is None:
            raise ValueError("token missing sub")
        return user_id
    except JWTError as e:
        raise ValueError(f"invalid token: {e}") from e
