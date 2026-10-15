import os
import uuid
import asyncio
from typing import Optional

import strawberry
import mercadopago
from dotenv import load_dotenv

from db import consultar, ejecutar
from auth import requerir_usuario

load_dotenv()

sdk = mercadopago.SDK(os.getenv("MP_ACCESS_TOKEN"))
BACK_URL = os.getenv("BACK_URL")

MENSAJES = {
    "accredited": "¡Pago aprobado! Gracias por tu compra.",
    "pending_contingency": "Tu pago se está procesando.",
    "pending_review_manual": "Tu pago está en revisión.",
    "cc_rejected_insufficient_amount": "Fondos insuficientes.",
    "cc_rejected_bad_filled_security_code": "Código de seguridad inválido.",
    "cc_rejected_bad_filled_date": "Fecha de vencimiento inválida.",
    "cc_rejected_bad_filled_other": "Revisa los datos de la tarjeta.",
    "cc_rejected_call_for_authorize": "Debes autorizar el pago con tu banco.",
}


def total_con_envio(total):
    return total + (0 if total >= 1800 else 150)


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
    email: str
    installments: int = 1
    issuerId: Optional[str] = None


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

        pago = {
            "transaction_amount": total_con_envio(float(pedido["total"])),
            "token": datos.token,
            "description": f"Pedido #{pedido['id']} - Vinilo",
            "installments": datos.installments,
            "payment_method_id": datos.paymentMethodId,
            "payer": {"email": datos.email},
            "external_reference": str(pedido["id"]),
            "notification_url": f"{BACK_URL}/webhook/mercadopago",
        }
        if datos.issuerId:
            pago["issuer_id"] = datos.issuerId

        opciones = mercadopago.config.RequestOptions()
        opciones.custom_headers = {"x-idempotency-key": str(uuid.uuid4())}

        resultado = await asyncio.to_thread(sdk.payment().create, pago, opciones)
        respuesta = resultado["response"]
        if resultado["status"] not in (200, 201):
            print("Error Mercado Pago:", respuesta)
            raise Exception(f"No se pudo procesar el pago: {respuesta.get('message', '')}")

        status = respuesta.get("status", "")
        detalle = respuesta.get("status_detail", "")
        if status == "approved":
            await marcar_pagado(pedido["id"])

        mensaje = MENSAJES.get(detalle, "El pago fue rechazado. Intenta con otra tarjeta.")
        return ResultadoPago(status=status, detalle=mensaje)


async def procesar_pago(pago_id):
    resultado = await asyncio.to_thread(sdk.payment().get, pago_id)
    if resultado["status"] != 200:
        return
    pago = resultado["response"]
    pedido_id = pago.get("external_reference")
    if pedido_id and pago.get("status") == "approved":
        await marcar_pagado(pedido_id)