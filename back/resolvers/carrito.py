import strawberry
from typing import List, Optional

from db import consultar, ejecutar
from auth import requerir_usuario


#TYPES


@strawberry.type
class ItemCarrito:
    id: strawberry.ID
    producto_id: strawberry.ID
    titulo: str
    artista: str
    precio: float
    imagen_url: str
    cantidad: int




async def validar_stock(productoId, cantidad):
    filas = await consultar("SELECT stock FROM productos WHERE id = :id", {"id": int(productoId)})
    if not filas:
        raise Exception("Producto no encontrado")
    if cantidad < 1:
        raise Exception("La cantidad minima es 1")
    if cantidad > filas[0]["stock"]:
        raise Exception(f"Solo hay {filas[0]['stock']} disponibles")

#QUIERY Y MUTATIONS

@strawberry.type
class CarritoQueries:
    @strawberry.field
    async def obtenerCarrito(self, info: strawberry.Info) -> Optional[List[Optional[ItemCarrito]]]:
        usuarioId = requerir_usuario(info)["usuario_id"]
        filas = await consultar(
            """SELECT ic.id, ic.producto_id, ic.cantidad, p.titulo, p.artista, p.precio, p.imagen_url
               FROM items_carrito ic
               JOIN carritos c ON ic.carrito_id = c.id
               JOIN productos p ON ic.producto_id = p.id
               WHERE c.usuario_id = :usuario
               ORDER BY ic.id""",
            {"usuario": usuarioId},
        )
        return [
            ItemCarrito(
                id=f["id"],
                producto_id=f["producto_id"],
                titulo=f["titulo"],
                artista=f["artista"],
                precio=float(f["precio"]),
                imagen_url=f["imagen_url"],
                cantidad=f["cantidad"],
            )
            for f in filas
        ]


# MUTATIONS

@strawberry.type
class CarritoMutations:
    @strawberry.field
    async def agregarAlCarrito(self, info: strawberry.Info, productoId: strawberry.ID, cantidad: int = 1) -> str:
        usuarioId = requerir_usuario(info)["usuario_id"]
        carritos = await consultar("SELECT id FROM carritos WHERE usuario_id = :usuario", {"usuario": usuarioId})
        
        if len(carritos) == 0:
            
            nuevo = await ejecutar("INSERT INTO carritos (usuario_id) VALUES (:usuario) RETURNING id", {"usuario": usuarioId})
            carritoId = nuevo[0]["id"]
        else:
            carritoId = carritos[0]["id"]

            actual = await consultar(
            "SELECT cantidad FROM items_carrito WHERE carrito_id = :carrito AND producto_id = :producto",
            {"carrito": carritoId, "producto": int(productoId)},
        )
        yaTiene = actual[0]["cantidad"] if actual else 0
        await validar_stock(productoId, yaTiene + cantidad)
        await ejecutar(
            """INSERT INTO items_carrito (carrito_id, producto_id, cantidad)
               VALUES (:carrito, :producto, :cantidad)
               ON CONFLICT (carrito_id, producto_id) DO UPDATE SET cantidad = items_carrito.cantidad + EXCLUDED.cantidad""",
            {"carrito": carritoId, "producto": int(productoId), "cantidad": cantidad},
        )
        return 'Producto agregado al carrito'

    @strawberry.field
    async def eliminarDelCarrito(self, info: strawberry.Info, productoId: strawberry.ID) -> str:
        usuarioId = requerir_usuario(info)["usuario_id"]
        await ejecutar(
            """DELETE FROM items_carrito
               WHERE carrito_id IN (SELECT id FROM carritos WHERE usuario_id = :usuario)
               AND producto_id = :producto""",
            {"usuario": usuarioId, "producto": int(productoId)},
        )
        return 'Producto eliminado del carrito'

    @strawberry.field
    async def actualizarCantidadItem(self, info: strawberry.Info, productoId: strawberry.ID, cantidad: int) -> str:
        usuarioId = requerir_usuario(info)["usuario_id"]
        await validar_stock(productoId, cantidad)
        await ejecutar(
            """UPDATE items_carrito
               SET cantidad = :cantidad
               WHERE carrito_id IN (SELECT id FROM carritos WHERE usuario_id = :usuario)
               AND producto_id = :producto""",
            {"cantidad": cantidad, "usuario": usuarioId, "producto": int(productoId)},
        )
        return 'Cantidad actualizada'

    @strawberry.field
    async def vaciarCarrito(self, info: strawberry.Info) -> bool:
        usuarioId = requerir_usuario(info)["usuario_id"]
        await ejecutar(
            "DELETE FROM items_carrito WHERE carrito_id IN (SELECT id FROM carritos WHERE usuario_id = :usuario)",
            {"usuario": usuarioId},
        )
        return True
