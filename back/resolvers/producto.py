import re
import strawberry
from typing import Annotated, List, Optional

from db import consultar, ejecutar
from auth import requerir_admin


IMAGEN_DEFECTO = "https://t3.ftcdn.net/jpg/03/64/22/10/360_F_364221046_KJcZa8Yvt4WWFAuxfcCTTW7I2M9iTwLe.jpg"


# Devuelve una url usable: si esta vacia o no es valida, se usa la imagen por defecto
def normalizar_imagen(url):
    url = (url or "").strip()
    if len(url) > 255:
        return IMAGEN_DEFECTO
    if url.startswith("/imagenes/") and url[len("/imagenes/"):].isdigit():
        return url
    if url.startswith(("http://", "https://")) and " " not in url and "." in url:
        return url
    return IMAGEN_DEFECTO


# Acepta un link de Spotify (album, cancion o playlist) o un URI y lo guarda como "spotify:tipo:id"
SPOTIFY_RE = re.compile(r"(?:spotify:|open\.spotify\.com/(?:intl-[a-z-]+/)?)(album|track|playlist)[:/]([A-Za-z0-9]{22})")


def normalizar_spotify(valor):
    valor = (valor or "").strip()
    if not valor:
        return None
    m = SPOTIFY_RE.search(valor)
    if not m:
        raise Exception("El link de Spotify no es valido (usa el link de un album, cancion o playlist)")
    return f"spotify:{m.group(1)}:{m.group(2)}"


#TYPES


@strawberry.type
class Producto:
    id: strawberry.ID
    titulo: str
    artista: str
    precio: float
    imagen_url: Optional[str]
    stock: int
    spotify_uri: Optional[str]
    categoria_id: strawberry.Private[int]

    @strawberry.field
    async def categoria(self) -> Annotated["Categoria", strawberry.lazy("resolvers.categoria")]:
        from resolvers.categoria import crear_categoria

        filas = await consultar("SELECT * FROM categorias WHERE id = :id", {"id": self.categoria_id})
        return crear_categoria(filas[0])


def crear_producto(f):
    return Producto(
        id=f["id"],
        titulo=f["titulo"],
        artista=f["artista"],
        precio=float(f["precio"]),
        imagen_url=normalizar_imagen(f["imagen_url"]),
        stock=f["stock"],
        spotify_uri=f.get("spotify_uri"),
        categoria_id=f["categoria_id"],
    )




#QUIERY Y MUTATIONS



@strawberry.type
class ProductoQueries:
    @strawberry.field
    async def obtenerProductos(self, limite: int = 20, desde: int = 0) -> List[Producto]:
        filas = await consultar("SELECT * FROM productos ORDER BY id LIMIT :limite OFFSET :desde", {"limite": limite, "desde": desde})
        return [crear_producto(f) for f in filas]

    @strawberry.field
    async def obtenerProducto(self, id: strawberry.ID) -> Optional[Producto]:
        filas = await consultar("SELECT * FROM productos WHERE id = :id", {"id": int(id)})
        return crear_producto(filas[0]) if filas else None

    @strawberry.field
    async def obtenerProductosPorCategoria(self, categoriaId: strawberry.ID) -> List[Producto]:
        filas = await consultar("SELECT * FROM productos WHERE categoria_id = :id ORDER BY id", {"id": int(categoriaId)})
        return [crear_producto(f) for f in filas]


# MUTATIONS

@strawberry.type
class ProductoMutations:
    # --- CRUD de productos (lo usa el backoffice) ---
    @strawberry.field
    async def crearProducto(self, info: strawberry.Info, datos: "ProductoInput") -> Optional[Producto]:
        requerir_admin(info)
        filas = await ejecutar(
            """INSERT INTO productos (titulo, artista, precio, imagen_url, stock, categoria_id, spotify_uri)
               VALUES (:titulo, :artista, :precio, :imagen_url, :stock, :categoria_id, :spotify_uri)
               RETURNING *""",
            {
                "titulo": datos.titulo,
                "artista": datos.artista,
                "precio": datos.precio,
                "imagen_url": normalizar_imagen(datos.imagen_url),
                "stock": datos.stock,
                "categoria_id": int(datos.categoriaId),
                "spotify_uri": normalizar_spotify(datos.spotify_uri),
            },
        )
        return crear_producto(filas[0])

    @strawberry.field
    async def actualizarProducto(self, info: strawberry.Info, id: strawberry.ID, datos: "ProductoUpdateInput") -> Optional[Producto]:
        requerir_admin(info)
        existentes = await consultar("SELECT * FROM productos WHERE id = :id", {"id": int(id)})
        actual = existentes[0]

        filas = await ejecutar(
            """UPDATE productos
               SET titulo = :titulo, artista = :artista, precio = :precio, imagen_url = :imagen_url, stock = :stock,
                   categoria_id = :categoria_id, spotify_uri = :spotify_uri
               WHERE id = :id
               RETURNING *""",
            {
                "titulo": datos.titulo or actual["titulo"],
                "artista": datos.artista or actual["artista"],
                "precio": datos.precio or actual["precio"],
                "imagen_url": normalizar_imagen(datos.imagen_url) if datos.imagen_url else normalizar_imagen(actual["imagen_url"]),
                "stock": datos.stock if datos.stock is not None else actual["stock"],
                "categoria_id": int(datos.categoriaId) if datos.categoriaId else actual["categoria_id"],
                "spotify_uri": normalizar_spotify(datos.spotify_uri) if datos.spotify_uri is not None else actual.get("spotify_uri"),
                "id": int(id),
            },
        )
        return crear_producto(filas[0])

    @strawberry.field
    async def eliminarProducto(self, info: strawberry.Info, id: strawberry.ID) -> bool:
        requerir_admin(info)
        if await consultar("SELECT 1 FROM detalle_pedido WHERE producto_id = :id LIMIT 1", {"id": int(id)}):
            raise Exception("No se puede eliminar: el producto tiene ventas")
        await ejecutar("DELETE FROM productos WHERE id = :id", {"id": int(id)})
        return True





# INPUT


@strawberry.input
class ProductoInput:
    titulo: str
    artista: str
    precio: float
    stock: int
    categoriaId: strawberry.ID
    imagen_url: Optional[str] = None
    spotify_uri: Optional[str] = None

@strawberry.input
class ProductoUpdateInput:
    titulo: Optional[str] = None
    artista: Optional[str] = None
    precio: Optional[float] = None
    imagen_url: Optional[str] = None
    stock: Optional[int] = None
    categoriaId: Optional[strawberry.ID] = None
    spotify_uri: Optional[str] = None