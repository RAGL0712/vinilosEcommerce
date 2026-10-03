import strawberry
from enum import Enum
from typing import Annotated, List, Optional
from sqlalchemy import text

from db import engine, consultar
from auth import requerir_usuario, requerir_admin


#TYPES


@strawberry.type
class DetallePedido:
    id: strawberry.ID
    cantidad: int
    precioUnitario: float
    producto_id: strawberry.Private[int]

    @strawberry.field
    async def producto(self) -> Annotated["Producto", strawberry.lazy("resolvers.producto")]:
        from resolvers.producto import crear_producto

        filas = await consultar("SELECT * FROM productos WHERE id = :id", {"id": self.producto_id})
        return crear_producto(filas[0])

@strawberry.type
class Pedido:
    id: strawberry.ID
    nombreCliente: str
    email: str
    direccion: str
    fecha: str
    status: "StatusPedido"
    total: float
    usuario_id: strawberry.Private[int]

    @strawberry.field
    async def usuario(self) -> Optional[Annotated["Usuario", strawberry.lazy("resolvers.usuario")]]:
        from resolvers.usuario import crear_usuario

        filas = await consultar("SELECT * FROM usuarios WHERE id = :id", {"id": self.usuario_id})
        return crear_usuario(filas[0])

    @strawberry.field
    async def lineas(self) -> List[DetallePedido]:
        filas = await consultar("SELECT * FROM detalle_pedido WHERE pedido_id = :id ORDER BY id", {"id": int(self.id)})
        return [
            DetallePedido(id=f["id"], cantidad=f["cantidad"], precioUnitario=float(f["precio_unitario"]), producto_id=f["producto_id"])
            for f in filas
        ]


def crear_pedido(f):
    return Pedido(
        id=f["id"],
        nombreCliente=f["nombre_cliente"],
        email=f["email"],
        direccion=f["direccion"],
        fecha=f["fecha"].isoformat(),
        status=StatusPedido(f["status"]),
        total=float(f["total"]),
        usuario_id=f["usuario_id"],
    )




#QUIERY Y MUTATIONS



@strawberry.type
class PedidoQueries:
    @strawberry.field
    async def historialPedidos(self, info: strawberry.Info) -> List[Pedido]:
        requerir_admin(info)
        filas = await consultar("SELECT * FROM pedidos ORDER BY fecha DESC")
        return [crear_pedido(f) for f in filas]


# MUTATIONS

@strawberry.type
class PedidoMutations:
    @strawberry.field
    async def crearPedido(self, info: strawberry.Info, datos: "PedidoInput") -> Optional[Pedido]:
        usuarioId = requerir_usuario(info)["usuario_id"]

        async with engine.begin() as conn:
            total = 0
            precios = {}
            for linea in datos.lineas:
                res = await conn.execute(text("SELECT precio FROM productos WHERE id = :id"), {"id": int(linea.productoId)})
                producto = res.mappings().first()
                precios[linea.productoId] = producto["precio"]
                total = total + producto["precio"] * linea.cantidad

            res = await conn.execute(
                text("""INSERT INTO pedidos (usuario_id, nombre_cliente, email, direccion, total)
                        VALUES (:usuario, :nombre, :email, :direccion, :total)
                        RETURNING id"""),
                {
                    "usuario": usuarioId,
                    "nombre": datos.nombreCliente,
                    "email": datos.email,
                    "direccion": datos.direccion,
                    "total": total,
                },
            )
            pedidoId = res.scalar()

            for linea in datos.lineas:
                await conn.execute(
                    text("""INSERT INTO detalle_pedido (pedido_id, producto_id, cantidad, precio_unitario)
                            VALUES (:pedido, :producto, :cantidad, :precio)"""),
                    {
                        "pedido": pedidoId,
                        "producto": int(linea.productoId),
                        "cantidad": linea.cantidad,
                        "precio": precios[linea.productoId],
                    },
                )

            await conn.execute(
                text("DELETE FROM items_carrito WHERE carrito_id IN (SELECT id FROM carritos WHERE usuario_id = :usuario)"),
                {"usuario": usuarioId},
            )

        pedidoCreado = await consultar("SELECT * FROM pedidos WHERE id = :id", {"id": pedidoId})
        return crear_pedido(pedidoCreado[0])





# INPUT


@strawberry.input
class LineaPedidoInput:
    productoId: strawberry.ID
    cantidad: int

@strawberry.input
class PedidoInput:
    nombreCliente: str
    email: str
    direccion: str
    lineas: List[LineaPedidoInput]






# ENUMS


@strawberry.enum
class StatusPedido(Enum):
    PENDIENTE = "PENDIENTE"
    PAGADO = "PAGADO"
    ENVIADO = "ENVIADO"
    CANCELADO = "CANCELADO"
