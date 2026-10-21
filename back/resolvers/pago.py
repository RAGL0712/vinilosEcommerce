import os
import uuid
import asyncio

import requests
import strawberry
from notificaciones import notificar_pedido
from dotenv import load_dotenv

from db import consultar, ejecutar
from auth import requerir_usuario

load_dotenv()

MP_ACCESS_TOKEN = os.getenv("MP_ACCESS_TOKEN")
MP_API = "https://api.mercadopago.com/v1/orders"

def mensaje_pago(detalle):
    d = (detalle or "").lower()
    reglas = [
        ("accredited", "Pago aprobado"),
        ("contingency", "Pendiente de pago"),
        ("pending", "Pendiente de pago"),
        ("review", "Pendiente de pago"),
        ("call_for_authorize", "Rechazado con validación para autorizar"),
        ("insufficient", "Rechazado por importe insuficiente"),
        ("security_code", "Rechazado por código de seguridad inválido"),
        ("card_number", "Rechazado por falta de card_number"),
        ("date", "Rechazado debido a un problema de fecha de vencimiento"),
        ("expir", "Rechazado debido a un problema de fecha de vencimiento"),
        ("bad_filled", "Rechazado debido a un error de formulario"),
        ("installments", "Rechazado por cuotas invalidas"),
        ("duplicated", "Rechazado por pago duplicado"),
        ("disabled", "Rechazado por tarjeta deshabilitada"),
        ("card_type", "Rechazado por tipo de tarjeta no permitida"),
        ("not_allowed", "Rechazado por tipo de tarjeta no permitida"),
        ("attempts", "Rechazado debido a intentos excedidos del pin de la tarjeta"),
        ("blacklist", "Rechazado por estar en lista negra"),
        ("unsupported", "No soportado"),
        ("not_supported", "No soportado"),
        ("amount", "Usado para aplicar regla de montos"),
    ]
    for clave, texto in reglas:
        if clave in d:
            return texto
    return "Rechazado por error general"


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
        notificar_pedido(pedido_id)

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

        print("Mercado Pago:", codigo, order.get("status"), detalle)

        if order["status"] == "processed":
            await marcar_pagado(pedido["id"])
            return ResultadoPago(status="approved", detalle="Pago aprobado")
        if order["status"] in ("action_required", "in_review", "in_process", "processing", "pending"):
            mensaje = mensaje_pago(detalle)
            return ResultadoPago(status="in_process", detalle=mensaje if mensaje != "Rechazado por error general" else "Pendiente de pago")

        return ResultadoPago(status="rejected", detalle=mensaje_pago(detalle))

async def procesar_order(order_id):
    codigo, order = await asyncio.to_thread(_obtener_order, order_id)
    if codigo != 200:
        return
    if order.get("status") == "processed" and order.get("external_reference"):
        await marcar_pagado(order["external_reference"])