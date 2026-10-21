import os
import re
import asyncio
import unicodedata
from typing import List, Optional

import requests
import strawberry
from dotenv import load_dotenv

from db import consultar, ejecutar
from auth import requerir_admin
from imagenes import detectar_tipo, MAX_BYTES

load_dotenv()

DISCOGS_TOKEN = os.getenv("DISCOGS_TOKEN")
DISCOGS_SEARCH = "https://api.discogs.com/database/search"
HEADERS = {"User-Agent": "VinilosEcommerce/1.0 +https://vinilosecommerce.netlify.app"}

# Generos y estilos de Discogs que se revisan primero (para que un soundtrack quede como OST y no como Electronica)
PRIORIDAD = ["stage & screen", "soundtrack", "score", "video game music"]

# Generos/estilos de Discogs -> posibles nombres de categoria en la tienda
EQUIVALENCIAS = {
    "stage & screen": ["ost", "soundtrack", "banda sonora"],
    "soundtrack": ["ost", "soundtrack", "banda sonora"],
    "score": ["ost", "soundtrack"],
    "video game music": ["ost", "bgm"],
    "electronic": ["electronica", "electronic"],
    "ambient": ["bgm", "ambient"],
    "rock": ["rock"],
    "pop": ["pop"],
    "jazz": ["jazz"],
    "hip hop": ["hip hop", "rap"],
    "classical": ["clasica", "classical"],
    "latin": ["latina", "latin"],
    "funk / soul": ["funk", "soul"],
    "blues": ["blues"],
    "reggae": ["reggae"],
    "folk, world, & country": ["folk", "country"],
}


def _normalizar(texto):
    t = unicodedata.normalize("NFD", (texto or "").lower())
    return "".join(c for c in t if unicodedata.category(c) != "Mn").strip()


def _limpiar_artista(nombre):
    nombre = re.sub(r"\s*\(\d+\)$", "", nombre or "").strip()
    return nombre.rstrip("*").strip()


def _imagen_valida(url):
    return url if url and url.startswith("https://") and not url.endswith("spacer.gif") else None


def _buscar(texto, tipo):
    params = {"q": texto, "type": tipo, "format": "Vinyl", "per_page": 8}
    headers = {**HEADERS, "Authorization": f"Discogs token={DISCOGS_TOKEN}"}
    r = requests.get(DISCOGS_SEARCH, params=params, headers=headers, timeout=15)
    if r.status_code != 200:
        print("Error Discogs:", r.status_code, r.text[:200])
        return None
    return r.json().get("results", [])


def _descargar(url):
    headers = {**HEADERS, "Authorization": f"Discogs token={DISCOGS_TOKEN}"}
    r = requests.get(url, headers=headers, timeout=20)
    return r.status_code, r.content


def _elegir_categoria(generos, estilos, categorias):
    por_nombre = {_normalizar(c["nombre"]): c for c in categorias}
    terminos = [_normalizar(t) for t in generos + estilos]
    terminos = sorted(terminos, key=lambda t: 0 if t in PRIORIDAD else 1)
    for t in terminos:
        for candidato in EQUIVALENCIAS.get(t, []) + [t]:
            if candidato in por_nombre:
                return por_nombre[candidato]
    return por_nombre.get("otro") or por_nombre.get("otros")


@strawberry.type
class ResultadoDiscogs:
    id: str
    titulo: str
    artista: str
    anio: Optional[str]
    generos: List[str]
    imagen: Optional[str]
    miniatura: Optional[str]
    categoriaId: Optional[str]
    categoriaNombre: Optional[str]


@strawberry.type
class DiscogsQueries:
    @strawberry.field
    async def buscarDiscogs(self, info: strawberry.Info, texto: str) -> List[ResultadoDiscogs]:
        requerir_admin(info)
        texto = (texto or "").strip()
        if len(texto) < 2:
            raise Exception("Escribe al menos 2 letras para buscar")
        if not DISCOGS_TOKEN:
            raise Exception("Falta configurar DISCOGS_TOKEN en el servidor")

        resultados = await asyncio.to_thread(_buscar, texto, "master")
        if resultados == []:
            resultados = await asyncio.to_thread(_buscar, texto, "release")
        if resultados is None:
            raise Exception("No se pudo consultar Discogs. Intenta de nuevo en un momento")

        categorias = await consultar("SELECT id, nombre FROM categorias ORDER BY id")
        salida = []
        for r in resultados:
            completo = r.get("title") or ""
            artista, _, titulo = completo.partition(" - ")
            if not titulo:
                artista, titulo = "", completo
            generos = r.get("genre") or []
            estilos = r.get("style") or []
            cat = _elegir_categoria(generos, estilos, categorias)
            salida.append(ResultadoDiscogs(
                id=str(r.get("id")),
                titulo=titulo.strip()[:150],
                artista=_limpiar_artista(artista)[:150],
                anio=str(r["year"]) if r.get("year") else None,
                generos=generos + estilos,
                imagen=_imagen_valida(r.get("cover_image")),
                miniatura=_imagen_valida(r.get("thumb")) or _imagen_valida(r.get("cover_image")),
                categoriaId=str(cat["id"]) if cat else None,
                categoriaNombre=cat["nombre"] if cat else None,
            ))
        return salida


@strawberry.type
class DiscogsMutations:
    # Copia la portada de Discogs a nuestra tabla de imagenes y devuelve "/imagenes/ID"
    @strawberry.field
    async def importarImagenDiscogs(self, info: strawberry.Info, url: str) -> str:
        requerir_admin(info)
        if not url.startswith("https://i.discogs.com/"):
            raise Exception("Solo se pueden importar imagenes de Discogs")
        codigo, contenido = await asyncio.to_thread(_descargar, url)
        if codigo != 200 or not contenido:
            raise Exception("No se pudo descargar la imagen de Discogs")
        if len(contenido) > MAX_BYTES:
            raise Exception("La imagen de Discogs pesa mas de 2 MB")
        tipo = detectar_tipo(contenido)
        if tipo is None:
            raise Exception("La imagen de Discogs no es JPG, PNG o WEBP")
        filas = await ejecutar(
            "INSERT INTO imagenes (tipo, datos) VALUES (:tipo, :datos) RETURNING id",
            {"tipo": tipo, "datos": contenido},
        )
        return f"/imagenes/{filas[0]['id']}"