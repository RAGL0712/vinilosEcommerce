import strawberry
from typing import Annotated, List, Optional

from db import consultar


#TYPES


@strawberry.type
class Categoria:
    id: strawberry.ID
    nombre: str

    @strawberry.field
    async def productos(self) -> List[Annotated["Producto", strawberry.lazy("resolvers.producto")]]:
        from resolvers.producto import crear_producto

        filas = await consultar("SELECT * FROM productos WHERE categoria_id = :id ORDER BY id", {"id": int(self.id)})
        return [crear_producto(f) for f in filas]


def crear_categoria(f):
    return Categoria(id=f["id"], nombre=f["nombre"])




#QUIERY Y MUTATIONS



@strawberry.type
class CategoriaQueries:
    @strawberry.field
    async def obtenerCategorias(self) -> List[Categoria]:
        filas = await consultar("SELECT * FROM categorias ORDER BY id")
        return [crear_categoria(f) for f in filas]

    @strawberry.field
    async def obtenerCategoria(self, id: strawberry.ID) -> Optional[Categoria]:
        filas = await consultar("SELECT * FROM categorias WHERE id = :id", {"id": int(id)})
        return crear_categoria(filas[0]) if filas else None
