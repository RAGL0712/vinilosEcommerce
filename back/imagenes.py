from fastapi import APIRouter, Request, Response
from fastapi.responses import JSONResponse

from db import consultar, ejecutar
from jwt_service import decodificar

router = APIRouter()

MAX_BYTES = 2 * 1024 * 1024  # 2 MB (el front ya manda la imagen comprimida)


# Las imagenes subidas se guardan en la BD (bytea) porque el disco de Render es temporal
async def crear_tabla_imagenes():
    await ejecutar(
        """CREATE TABLE IF NOT EXISTS imagenes (
             id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
             tipo varchar(20) NOT NULL,
             datos bytea NOT NULL,
             creada timestamptz NOT NULL DEFAULT now()
           )"""
    )


# Detecta el tipo real por los primeros bytes (no confiamos en el Content-Type)
def detectar_tipo(b: bytes):
    if b[:3] == b"\xff\xd8\xff":
        return "image/jpeg"
    if b[:8] == b"\x89PNG\r\n\x1a\n":
        return "image/png"
    if b[:4] == b"RIFF" and b[8:12] == b"WEBP":
        return "image/webp"
    return None


@router.post("/imagenes")
async def subir_imagen(request: Request):
    header = request.headers.get("Authorization", "")
    datos = decodificar(header[7:]) if header.startswith("Bearer ") else None
    if datos is None:
        return JSONResponse({"error": "TOKEN_EXPIRADO"}, status_code=401)
    if datos.get("tipo") != "access" or datos.get("rol") != "ADMIN":
        return JSONResponse({"error": "No tienes permiso"}, status_code=403)

    cuerpo = await request.body()
    if not cuerpo or len(cuerpo) > MAX_BYTES:
        return JSONResponse({"error": "La imagen esta vacia o pesa mas de 2 MB"}, status_code=400)
    tipo = detectar_tipo(cuerpo)
    if tipo is None:
        return JSONResponse({"error": "El archivo no es una imagen valida (JPG, PNG o WEBP)"}, status_code=400)

    filas = await ejecutar(
        "INSERT INTO imagenes (tipo, datos) VALUES (:tipo, :datos) RETURNING id",
        {"tipo": tipo, "datos": cuerpo},
    )
    return {"imagen_url": f"/imagenes/{filas[0]['id']}"}


@router.get("/imagenes/{imagen_id}")
async def ver_imagen(imagen_id: int):
    filas = await consultar("SELECT tipo, datos FROM imagenes WHERE id = :id", {"id": imagen_id})
    if not filas:
        return Response(status_code=404)
    return Response(
        content=bytes(filas[0]["datos"]),
        media_type=filas[0]["tipo"],
        headers={"Cache-Control": "public, max-age=31536000, immutable"},
    )
