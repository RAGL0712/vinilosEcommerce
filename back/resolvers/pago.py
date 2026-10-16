import os
import uuid
import asyncio

import requests
import strawberry
from dotenv import load_dotenv

from db import consultar, ejecutar
from auth import requerir_usuario

load_dotenv()

MP_ACCESS_TOKEN = os.getenv("MP_ACCESS_TOKEN")
MP_API = "https://api.mercadopago.com/v1/orders"

MENSAJES = {
    "accredited": "¡Pago aprobado! Gracias por tu compra.",
    "in_review": "Tu pago está en revisión.",
    "pending_review_manual": "Tu pago está en revisión.",
    "insufficient_amount": "Fondos insuficientes.",
    "bad_filled_security_code": "Código de seguridad inválido.",
    "bad_filled_date": "Fecha de vencimiento inválida.",
    "bad_filled_other": "Revisa los datos de la tarjeta.",
    "call_for_authorize": "Debes autorizar el pago con tu banco.",
}


def total_con_envio(total):
    return total + (0 if total >= 1800 else 150)


def _headers(idempotente=False):
    h = {"Authorization": f"Bearer {MP_ACCESS_TOKEN}", "Content-Type": "application/json"}
    if idempotente:
        h["X-Idempotency-Key"] = str(uuid.uuid4())
    return h


def _crear_order(cuerpo):
    r = requests.post(MP_API, json=cuerpo, headers=_headers(idempotente=True), timeout=30)
    return r.status_code, r.json()


def _obtener_order(order_id):
    r = requests.get(f"{MP_API}/{order_id}", headers=_headers(), timeout=30)
    return r.status_code, r.json()


async def marcar_pagado(pedido_id):
    actualizados = await ejecutar(
        "UPDATE pedidos SET status = 'PAGADO' WHERE id = :id AND status = 'PENDIENTE' RETURNING id",
        {"id": int(pedido_id)},
    )
    if actualizados:
        await ejecutar(
            """DELETE FROM items_carrito WHERE carrito_id IN (
                 SELECT c.id FROM carritos c JOIN pedidos p ON p.usuario_id = c.usuario_id WHERE p.id = :id)""",
            {"id": int(pedido_id)},
        )


@strawberry.type
class ResultadoPago:
    status: str
    detalle: str


@strawberry.input
class PagoInput:
    pedidoId: strawberry.ID
    token: str
    paymentMethodId: str
    paymentTypeId: str
    email: str
    installments: int = 1


@strawberry.type
class PagoMutations:
    @strawberry.field
    async def pagarPedido(self, info: strawberry.Info, datos: PagoInput) -> ResultadoPago:
        usuarioId = requerir_usuario(info)["usuario_id"]

        pedidos = await consultar(
            "SELECT * FROM pedidos WHERE id = :id AND usuario_id = :usuario",
            {"id": int(datos.pedidoId), "usuario": usuarioId},
        )
        if not pedidos:
            raise Exception("Pedido no encontrado")
        pedido = pedidos[0]
        if pedido["status"] != "PENDIENTE":
            raise Exception("Este pedido ya fue pagado")

        monto = f"{total_con_envio(float(pedido['total'])):.2f}"
        cuerpo = {
            "type": "online",
            "processing_mode": "automatic",
            "total_amount": monto,
            "external_reference": str(pedido["id"]),
            "payer": {"email": datos.email},
            "transactions": {
                "payments": [
                    {
                        "amount": monto,
                        "payment_method": {
                            "id": datos.paymentMethodId,
                            "type": datos.paymentTypeId,
                            "token": datos.token,
                            "installments": datos.installments,
                        },
                    }
                ]
            },
        }

        codigo, respuesta = await asyncio.to_thread(_crear_order, cuerpo)

        # Un rechazo puede llegar como 201 con status "failed" o como error con la order en "data"
        order = respuesta.get("data", respuesta) if isinstance(respuesta, dict) else {}
        if "status" not in order:
            print("Error Mercado Pago:", codigo, respuesta)
            raise Exception("No se pudo procesar el pago")

        pagos = order.get("transactions", {}).get("payments", [])
        detalle = pagos[0].get("status_detail", "") if pagos else order.get("status_detail", "")

        if order["status"] == "processed":
            await marcar_pagado(pedido["id"])
            return ResultadoPago(status="approved", detalle=MENSAJES["accredited"])
        if order["status"] in ("action_required", "in_review", "in_process"):
            return ResultadoPago(status="in_process", detalle=MENSAJES.get(detalle, "Tu pago se está procesando."))

        print("Pago rechazado:", codigo, order.get("status"), detalle)
        return ResultadoPago(status="rejected", detalle=MENSAJES.get(detalle, "El pago fue rechazado. Intenta con otra tarjeta."))


async def procesar_order(order_id):
    codigo, order = await asyncio.to_thread(_obtener_order, order_id)
    if codigo != 200:
        return
    if order.get("status") == "processed" and order.get("external_reference"):
        await marcar_pagado(order["external_reference"])