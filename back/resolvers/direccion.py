import os
import re
import time
import asyncio
import unicodedata
from typing import List, Optional

import requests
import strawberry
from dotenv import load_dotenv

from auth import requerir_usuario

load_dotenv()

ZIPPOPOTAM_URL = "https://api.zippopotam.us/mx/{cp}"
NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
# Nominatim pide identificar la app con un User-Agent y un correo de contacto
NOMINATIM_EMAIL = os.getenv("NOMINATIM_EMAIL", "")
HEADERS = {"User-Agent": f"VinilosEcommerce/1.0 ({NOMINATIM_EMAIL or 'proyecto escolar'})", "Accept-Language": "es"}

_cache_cp = {}
_lock_nominatim = asyncio.Lock()
_ultima_peticion = 0.0


def _get_json(url, params=None):
    try:
        r = requests.get(url, params=params, headers=HEADERS, timeout=15)
        if r.status_code != 200:
            if r.status_code != 404:
                print("Error servicio de direcciones:", url, r.status_code, r.text[:200])
            return None
        return r.json()
    except Exception as e:
        print("Error servicio de direcciones:", url, e)
        return None


# Nominatim permite maximo 1 peticion por segundo
async def _nominatim(params):
    global _ultima_peticion
    async with _lock_nominatim:
        espera = 1.1 - (time.monotonic() - _ultima_peticion)
        if espera > 0:
            await asyncio.sleep(espera)
        try:
            return await asyncio.to_thread(
                _get_json, NOMINATIM_URL, {**params, "format": "jsonv2", "addressdetails": 1, "limit": 1, "countrycodes": "mx"}
            )
        finally:
            _ultima_peticion = time.monotonic()


def _normalizar(texto):
    t = unicodedata.normalize("NFD", (texto or "").lower())
    t = "".join(c for c in t if unicodedata.category(c) != "Mn").strip()
    t = t.replace("estado de ", "")
    if t in ("distrito federal", "cdmx", "d.f."):
        t = "ciudad de mexico"
    return t


def _mismo_estado(a, b):
    a, b = _normalizar(a), _normalizar(b)
    return bool(a and b) and (a.startswith(b) or b.startswith(a))


def _ciudad_de(direccion):
    for clave in ("city", "town", "municipality", "village", "county"):
        if direccion.get(clave):
            return direccion[clave]
    return None


@strawberry.type
class UbicacionCP:
    encontrado: bool
    mensaje: str
    pais: Optional[str] = None
    estado: Optional[str] = None
    ciudad: Optional[str] = None
    colonias: List[str] = strawberry.field(default_factory=list)


# Con el codigo postal obtiene pais, estado y colonias (Zippopotam) y la ciudad (OpenStreetMap)
async def buscar_codigo_postal(codigo_postal):
    cp = (codigo_postal or "").strip()
    if not re.fullmatch(r"\d{5}", cp):
        return UbicacionCP(encontrado=False, mensaje="El codigo postal debe tener 5 digitos")
    if cp in _cache_cp:
        return _cache_cp[cp]

    datos = await asyncio.to_thread(_get_json, ZIPPOPOTAM_URL.format(cp=cp))
    lugares = (datos or {}).get("places") or []
    if not lugares:
        return UbicacionCP(encontrado=False, mensaje=f"No encontramos el codigo postal {cp}")

    estado = lugares[0].get("state") or ""
    if _normalizar(estado) == "ciudad de mexico":
        estado = "Ciudad de México"
    colonias = sorted({l.get("place name") for l in lugares if l.get("place name")})

    ciudad = None
    r = await _nominatim({"postalcode": cp, "country": "México"})
    if r and _mismo_estado(r[0].get("address", {}).get("state"), estado):
        ciudad = _ciudad_de(r[0]["address"])
    if not ciudad and colonias:
        r = await _nominatim({"q": f"{colonias[0]}, {estado}, México"})
        if r and _mismo_estado(r[0].get("address", {}).get("state"), estado):
            ciudad = _ciudad_de(r[0]["address"])

    resultado = UbicacionCP(
        encontrado=True,
        mensaje="Codigo postal encontrado",
        pais="México",
        estado=estado,
        ciudad=ciudad,
        colonias=colonias,
    )
    _cache_cp[cp] = resultado
    return resultado


def _invalida(mensaje):
    return {"valida": False, "mensaje": mensaje, "direccion": None, "lat": None, "lng": None}


# Verifica con OpenStreetMap que la calle exista en el estado del codigo postal.
# "direccion" llega como "calle y numero, colonia, ciudad, estado" (asi la arma el checkout)
async def validar_direccion(direccion, codigo_postal):
    direccion = (direccion or "").strip()
    cp = (codigo_postal or "").strip()

    if not re.fullmatch(r"\d{5}", cp):
        return _invalida("El codigo postal debe tener 5 digitos")
    if len(direccion) < 5:
        return _invalida("Escribe la calle y el numero")

    ubicacion = await buscar_codigo_postal(cp)
    if not ubicacion.encontrado:
        return _invalida(ubicacion.mensaje)

    partes = [p.strip() for p in direccion.split(",") if p.strip()]
    partes = [p for p in partes if not p.upper().startswith("C.P.") and _normalizar(p) != "mexico"]
    calle = partes[0]
    colonia = partes[1] if len(partes) > 1 and _normalizar(partes[1]) not in (_normalizar(ubicacion.ciudad), _normalizar(ubicacion.estado)) else ""
    ciudad = ubicacion.ciudad or (partes[2] if len(partes) > 2 else "")

    if not re.search(r"[A-Za-zÁÉÍÓÚáéíóúÑñ]{3,}", calle):
        return _invalida("Escribe el nombre de la calle y el numero")

    # 1) busqueda estructurada; 2) busqueda libre con la colonia
    r = await _nominatim({"street": calle, "city": ciudad, "state": ubicacion.estado, "country": "México"})
    if not r and colonia:
        r = await _nominatim({"q": f"{calle}, {colonia}, {ciudad}, {ubicacion.estado}, México"})
    if not r:
        return _invalida("No encontramos esa calle. Revisa el nombre de la calle, la colonia y el codigo postal")

    resultado = r[0]
    datos = resultado.get("address", {})
    if not datos.get("road"):
        return _invalida("No encontramos esa calle. Escribe el nombre completo de la calle y el numero")
    if not _mismo_estado(datos.get("state"), ubicacion.estado):
        return _invalida(f"Esa calle no esta en {ubicacion.estado}, que es el estado del codigo postal {cp}")
    if datos.get("postcode") and datos["postcode"].strip() != cp:
        return _invalida(f"Esa calle no corresponde al codigo postal {cp}")

    ciudad_final = ubicacion.ciudad or _ciudad_de(datos) or ciudad
    texto = ", ".join(x for x in [calle, colonia, f"C.P. {cp}", ciudad_final, ubicacion.estado, "México"] if x)
    return {
        "valida": True,
        "mensaje": "Direccion verificada",
        "direccion": texto,
        "lat": float(resultado["lat"]),
        "lng": float(resultado["lon"]),
    }


@strawberry.type
class DireccionVerificada:
    valida: bool
    mensaje: str
    direccion: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None


@strawberry.type
class DireccionQueries:
    @strawberry.field
    async def validarDireccion(self, info: strawberry.Info, direccion: str, codigoPostal: str) -> DireccionVerificada:
        requerir_usuario(info)
        return DireccionVerificada(**(await validar_direccion(direccion, codigoPostal)))

    @strawberry.field
    async def buscarCodigoPostal(self, info: strawberry.Info, codigoPostal: str) -> UbicacionCP:
        requerir_usuario(info)
        return await buscar_codigo_postal(codigoPostal)