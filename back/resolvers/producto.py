import strawberry
from typing import Annotated, List, Optional

from db import consultar, ejecutar
from auth import requerir_admin


#TYPES


@strawberry.type
class Producto:
    id: strawberry.ID
    titulo: str
    artista: str
    precio: float
    imagen_url: Optional[str]
    stock: int
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
        imagen_url=f["imagen_url"],
        stock=f["stock"],
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
    # --- CRUD de productos ---
    # No se llaman todavia desde el frontend (el catalogo solo lee
    # productos), pero quedan listas para administrar el catalogo
    # desde un panel de administracion o Apollo Sandbox.
    @strawberry.field
    async def crearProducto(self, info: strawberry.Info, datos: "ProductoInput") -> Optional[Producto]:
        requerir_admin(info)
        filas = await ejecutar(
            """INSERT INTO productos (titulo, artista, precio, imagen_url, stock, categoria_id)
               VALUES (:titulo, :artista, :precio, :imagen_url, :stock, :categoria_id)
               RETURNING *""",
            {
                "titulo": datos.titulo,
                "artista": datos.artista,
                "precio": datos.precio,
                "imagen_url": datos.imagen_url,
                "stock": datos.stock,
                "categoria_id": int(datos.categoriaId),
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
               SET titulo = :titulo, artista = :artista, precio = :precio, imagen_url = :imagen_url, stock = :stock, categoria_id = :categoria_id
               WHERE id = :id
               RETURNING *""",
            {
                "titulo": datos.titulo or actual["titulo"],
                "artista": datos.artista or actual["artista"],
                "precio": datos.precio or actual["precio"],
                "imagen_url": datos.imagen_url or actual["imagen_url"],
                "stock": datos.stock if datos.stock is not None else actual["stock"],
                "categoria_id": int(datos.categoriaId) if datos.categoriaId else actual["categoria_id"],
                "id": int(id),
            },
        )
        return crear_producto(filas[0])

    @strawberry.field
    async def eliminarProducto(self, info: strawberry.Info, id: strawberry.ID) -> bool:
        requerir_admin(info)
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

@strawberry.input
class ProductoUpdateInput:
    titulo: Optional[str] = None
    artista: Optional[str] = None
    precio: Optional[float] = None
    imagen_url: Optional[str] = None
    stock: Optional[int] = None
    categoriaId: Optional[strawberry.ID] = None
