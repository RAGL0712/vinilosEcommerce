from typing import AsyncGenerator, List

import strawberry

from jwt_service import decodificar
from resolvers.pedido import Pedido, crear_pedido
from resolvers.admin import en_vivo


# El token llega en el "connection_init" del WebSocket (igual que en el admin)
def requerir_usuario_ws(info):
    params = info.context.get("connection_params") or {}
    header = params.get("Authorization", "")
    if not header.startswith("Bearer "):
        raise Exception("Debes iniciar sesion")
    datos = decodificar(header[7:])
    if datos is None:
        raise Exception("TOKEN_EXPIRADO")
    if datos.get("tipo") != "access":
        raise Exception("Debes iniciar sesion")
    return datos


@strawberry.type
class MisPedidosSubscriptions:
    # Pedidos del usuario con sesion iniciada; revisa la BD cada 5 segundos
    @strawberry.subscription
    async def misPedidosEnVivo(self, info: strawberry.Info) -> AsyncGenerator[List[Pedido], None]:
        usuario = requerir_usuario_ws(info)
        async for lista in en_vivo(
            "SELECT * FROM pedidos WHERE usuario_id = :id ORDER BY fecha DESC",
            crear_pedido,
            {"id": usuario["usuario_id"]},
            5,
        ):
            yield lista