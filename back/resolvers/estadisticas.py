import strawberry
from typing import List

from db import consultar
from auth import requerir_admin


@strawberry.type
class PuntoPedidos:
    fecha: str
    pedidos: int


@strawberry.type
class UsuarioReciente:
    id: int
    nombre: str
    email: str
    rol: str


@strawberry.type
class EstadisticasAdmin:
    totalUsuarios: int
    totalAdmins: int
    totalClientes: int
    totalPedidos: int
    promedioProductosCarrito: float
    promedioPrecioProductos: float
    ingresosTotales: float
    productoMasVendido: str
    pedidosPorDia: List[PuntoPedidos]
    usuariosRecientes: List[UsuarioReciente]


@strawberry.type
class EstadisticasQueries:
    @strawberry.field
    async def estadisticasAdmin(self, info: strawberry.Info) -> EstadisticasAdmin:
        requerir_admin(info)

        u = (await consultar(
            "SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE rol = 'ADMIN') AS admins FROM usuarios"
        ))[0]
        p = (await consultar(
            """SELECT COUNT(*) AS total,
                      COALESCE(SUM(total) FILTER (WHERE status <> 'CANCELADO'), 0) AS ingresos
               FROM pedidos"""
        ))[0]
        c = (await consultar(
            "SELECT COALESCE(AVG(t), 0) AS prom FROM (SELECT SUM(cantidad) AS t FROM items_carrito GROUP BY carrito_id) x"
        ))[0]
        pr = (await consultar("SELECT COALESCE(AVG(precio), 0) AS prom FROM productos"))[0]
        top = await consultar(
            """SELECT pr.titulo FROM detalle_pedido d
               JOIN productos pr ON pr.id = d.producto_id
               GROUP BY pr.titulo ORDER BY SUM(d.cantidad) DESC LIMIT 1"""
        )
        dias = await consultar(
            "SELECT to_char(fecha, 'YYYY-MM-DD') AS dia, COUNT(*) AS n FROM pedidos GROUP BY 1 ORDER BY 1"
        )
        recientes = await consultar("SELECT id, nombre, email, rol FROM usuarios ORDER BY id DESC LIMIT 5")

        return EstadisticasAdmin(
            totalUsuarios=u["total"],
            totalAdmins=u["admins"],
            totalClientes=u["total"] - u["admins"],
            totalPedidos=p["total"],
            promedioProductosCarrito=float(c["prom"]),
            promedioPrecioProductos=float(pr["prom"]),
            ingresosTotales=float(p["ingresos"]),
            productoMasVendido=top[0]["titulo"] if top else "Sin ventas",
            pedidosPorDia=[PuntoPedidos(fecha=d["dia"], pedidos=d["n"]) for d in dias],
            usuariosRecientes=[
                UsuarioReciente(id=r["id"], nombre=r["nombre"] or "", email=r["email"], rol=str(r["rol"]))
                for r in recientes
            ],
        )