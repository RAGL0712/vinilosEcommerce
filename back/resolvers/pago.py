import os
import asyncio
import strawberry
import mercadopago
from dotenv import load_dotenv

from db import consultar, ejecutar
from auth import requerir_usuario

load_dotenv()

sdk = mercadopago.SDK(os.getenv("MP_ACCESS_TOKEN"))
FRONT_URL = os.getenv("FRONT_URL")
BACK_URL = os.getenv("BACK_URL")


@strawberry.type
class PagoMutations:
    @strawberry.field
    async def crearPreferenciaPago(self, info: strawberry.Info, pedidoId: strawberry.ID) -> str:
        usuarioId = requerir_usuario(info)["usuario_id"]

        pedidos = await consultar(
            "SELECT * FROM pedidos WHERE id = :id AND usuario_id = :usuario",
            {"id": int(pedidoId), "usuario": usuarioId},
        )
        if not pedidos:
            raise Exception("Pedido no encontrado")
        pedido = pedidos[0]
        if pedido["status"] != "PENDIENTE":
            raise Exception("Este pedido ya fue procesado")

        lineas = await consultar(
            """SELECT d.cantidad, d.precio_unitario, p.titulo, p.artista
               FROM detalle_pedido d JOIN productos p ON p.id = d.producto_id
               WHERE d.pedido_id = :id ORDER BY d.id""",
            {"id": int(pedidoId)},
        )

        items = [
            {
                "title": f"{l['titulo']} - {l['artista']}",
                "quantity": int(l["cantidad"]),
                "unit_price": float(l["precio_unitario"]),
                "currency_id": "MXN",
            }
            for l in lineas
        ]
        # Misma regla que el front: envio gratis desde 1800
        if float(pedido["total"]) < 1800:
            items.append({"title": "Envio", "quantity": 1, "unit_price": 150.0, "currency_id": "MXN"})

        datos = {
            "items": items,
            "external_reference": str(pedido["id"]),
            "back_urls": {
                "success": f"{FRONT_URL}/pago",
                "failure": f"{FRONT_URL}/pago",
                "pending": f"{FRONT_URL}/pago",
            },
            "auto_return": "approved",
            "notification_url": f"{BACK_URL}/webhook/mercadopago",
        }

        resultado = await asyncio.to_thread(sdk.preference().create, datos)
        if resultado["status"] not in (200, 201):
            print("Error Mercado Pago:", resultado["response"])
            raise Exception("No se pudo crear el pago")

        return resultado["response"]["init_point"]


async def procesar_pago(pago_id):
    resultado = await asyncio.to_thread(sdk.payment().get, pago_id)
    if resultado["status"] != 200:
        return

    pago = resultado["response"]
    pedido_id = pago.get("external_reference")
    if not pedido_id or pago.get("status") != "approved":
        return

    actualizados = await ejecutar(
        "UPDATE pedidos SET status = 'PAGADO' WHERE id = :id AND status = 'PENDIENTE' RETURNING id",
        {"id": int(pedido_id)},
    )
    # Vaciar el carrito solo la primera vez que llega la notificacion
    if actualizados:
        await ejecutar(
            """DELETE FROM items_carrito WHERE carrito_id IN (
                 SELECT c.id FROM carritos c JOIN pedidos p ON p.usuario_id = c.usuario_id WHERE p.id = :id)""",
            {"id": int(pedido_id)},
        )