import os
import uuid
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv
from jose import jwt, JWTError



load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITMO = "HS256"


def crear_access(usuario_id, rol):
    datos = {
        "usuario_id": usuario_id,
        "rol": rol,
        "tipo": "access",
        "exp": datetime.now(timezone.utc) + timedelta(minutes=30),
    }
    return jwt.encode(datos, SECRET_KEY, algorithm=ALGORITMO)






def crear_refresh(usuario_id, rol):
    jti = str(uuid.uuid4())
    datos = {
        "usuario_id": usuario_id,
        "rol": rol,
        "tipo": "refresh",
        "jti": jti,
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
    }
    return jwt.encode(datos, SECRET_KEY, algorithm=ALGORITMO), jti






def decodificar(token):
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITMO])
    except JWTError:
        return None
