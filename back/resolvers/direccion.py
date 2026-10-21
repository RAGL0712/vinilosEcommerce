import os
import re
import asyncio
from typing import Optional

import requests
import strawberry
from dotenv import load_dotenv

from auth import requerir_usuario

load_dotenv()

GOOGLE_MAPS_API_KEY = os.getenv("AIzaSyCKlOG0MYcWsO1UIgXSSoKWqd6Xvd9_8OI")
GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json"


def _geocodificar(direccion, cp):
    r = requests.get(
        GEOCODE_URL,
        params={
            "address": direccion,
            "components": f"country:MX|postal_code:{cp}",
            "language": "es",
            "region": "mx",
            "key": GOOGLE_MAPS_API_KEY,
        },
        timeout=15,
    )
    return r.json()


def _componente(resultado, tipo):
    for c in resultado.get("address_components", []):
        if tipo in c.get("types", []):
            return c.get("long_name")
    return None


def _invalida(mensaje):
    return {"valida": False, "mensaje": mensaje, "direccion": None, "lat": None, "lng": None}


# Verifica con Google Geocoding que la direccion exista y pertenezca al codigo postal
async def validar_direccion(direccion, codigo_postal):
    direccion = (direccion or "").strip()
    cp = (codigo_postal or "").strip()

    if not re.fullmatch(r"\d{5}", cp):
        return _invalida("El codigo postal debe tener 5 digitos")
    if len(direccion) < 5:
        return _invalida("Escribe la calle y el numero")
    if not GOOGLE_MAPS_API_KEY:
        return _invalida("Falta configurar GOOGLE_MAPS_API_KEY en el servidor")

    datos = await asyncio.to_thread(_geocodificar, direccion, cp)
    estado = datos.get("status")
    resultados = datos.get("results") or []

    if estado == "ZERO_RESULTS" or (estado == "OK" and not resultados):
        return _invalida("No encontramos esa direccion. Revisa la calle, el numero y el codigo postal")
    if estado != "OK":
        print("Error Google Geocoding:", estado, datos.get("error_message"))
        return _invalida(f"No se pudo verificar la direccion ({estado})")

    r = resultados[0]
    if _componente(r, "postal_code") != cp:
        return _invalida(f"La direccion no corresponde al codigo postal {cp}")
    if not _componente(r, "route"):
        return _invalida(f"No encontramos esa calle en el codigo postal {cp}. Escribe calle y numero")

    ubicacion = r["geometry"]["location"]
    return {
        "valida": True,
        "mensaje": "Direccion verificada",
        "direccion": r["formatted_address"],
        "lat": ubicacion["lat"],
        "lng": ubicacion["lng"],
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