import os
import html
import asyncio

import requests
from dotenv import load_dotenv

from db import consultar

load_dotenv()

BREVO_API_KEY = os.getenv("BREVO_API_KEY")
BREVO_SENDER_EMAIL = os.getenv("BREVO_SENDER_EMAIL")
BREVO_SENDER_NAME = os.getenv("BREVO_SENDER_NAME", "Vinilo")
FRONT_URL = os.getenv("FRONT_URL", "https://vinilosecommerce.netlify.app")

PASOS = [("PENDIENTE", "Recibido"), ("PAGADO", "Pagado"), ("ENVIADO", "Enviado")]

TEXTOS = {
    "PENDIENTE": ("Recibimos tu pedido", "Tu pedido fue registrado y esta esperando el pago."),
    "PAGADO": ("¡Pago confirmado!", "Recibimos tu pago. Estamos preparando tus vinilos para enviarlos."),
    "ENVIADO": ("¡Tu pedido va en camino!", "Tus vinilos ya salieron hacia tu direccion de entrega."),
    "CANCELADO": ("Tu pedido fue cancelado", "Tu pedido fue cancelado. Si tienes dudas, responde a este correo."),
}


def _linea_tiempo(status):
    if status == "CANCELADO":
        return '<p style="margin:16px 0;padding:10px;border:2px solid #000;border-radius:8px;text-align:center;font-weight:700;color:#c00;">PEDIDO CANCELADO</p>'
    actual = [p[0] for p in PASOS].index(status) if status in [p[0] for p in PASOS] else 0
    celdas = ""
    for i, (_, nombre) in enumerate(PASOS):
        hecho = i <= actual
        fondo = "#000" if hecho else "#fff"
        color = "#fff" if hecho else "#000"
        celdas += (
            f'<td align="center" style="padding:4px;">'
            f'<div style="width:34px;height:34px;line-height:34px;border-radius:50%;border:2px solid #000;'
            f'background:{fondo};color:{color};font-weight:700;margin:0 auto;">{i + 1}</div>'
            f'<div style="font-size:12px;margin-top:6px;font-weight:{700 if i == actual else 400};">{nombre}</div></td>'
        )
    return f'<table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;"><tr>{celdas}</tr></table>'


def _plantilla(p, lineas, status, titulo, texto):
    filas = ""
    subtotal = 0
    for l in lineas:
        importe = float(l["precio_unitario"]) * int(l["cantidad"])
        subtotal += importe
        filas += (
            f'<tr><td style="padding:8px;border-bottom:1px solid #ddd;">{html.escape(l["titulo"])}'
            f'<br><span style="color:#666;font-size:12px;">{html.escape(l["artista"] or "")}</span></td>'
            f'<td align="center" style="padding:8px;border-bottom:1px solid #ddd;">{l["cantidad"]}</td>'
            f'<td align="right" style="padding:8px;border-bottom:1px solid #ddd;">${importe:,.2f}</td></tr>'
        )
    envio = 0 if subtotal >= 1800 else 150
    return f"""<html><body style="margin:0;padding:0;background:#f4f4f4;font-family:Montserrat,Arial,sans-serif;color:#000;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 0;"><tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border:2px solid #000;border-radius:10px;padding:24px;">
<tr><td>
  <h1 style="margin:0 0 4px;font-size:26px;letter-spacing:2px;">VINILO</h1>
  <p style="margin:0;color:#666;">Seguimiento de tu pedido #{p["id"]}</p>
  <h2 style="margin:24px 0 8px;font-size:20px;">{titulo}</h2>
  <p style="margin:0;">Hola {html.escape(p["nombre_cliente"])}, {texto}</p>
  {_linea_tiempo(status)}
  <table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;">
    <tr><th align="left" style="padding:8px;border-bottom:2px solid #000;">Producto</th>
        <th style="padding:8px;border-bottom:2px solid #000;">Cant.</th>
        <th align="right" style="padding:8px;border-bottom:2px solid #000;">Importe</th></tr>
    {filas}
    <tr><td colspan="2" align="right" style="padding:6px 8px;">Envio</td><td align="right" style="padding:6px 8px;">{"GRATIS" if envio == 0 else f"${envio:,.2f}"}</td></tr>
    <tr><td colspan="2" align="right" style="padding:6px 8px;font-weight:700;">Total</td><td align="right" style="padding:6px 8px;font-weight:700;">${subtotal + envio:,.2f}</td></tr>
  </table>
  <p style="margin:20px 0 4px;font-weight:700;">Direccion de entrega</p>
  <p style="margin:0;color:#333;">{html.escape(p["direccion"])}</p>
  <p style="margin:28px 0 0;text-align:center;">
    <a href="{FRONT_URL}" style="display:inline-block;padding:10px 22px;border:2px solid #000;border-radius:10px;color:#000;text-decoration:none;font-weight:700;box-shadow:4px 4px 0 #000;">Ir a la tienda</a>
  </p>
</td></tr></table>
<p style="color:#888;font-size:12px;">Este correo se envio automaticamente porque realizaste una compra en Vinilo.</p>
</td></tr></table></body></html>"""


def _enviar(payload):
    r = requests.post(
        "https://api.brevo.com/v3/smtp/email",
        json=payload,
        headers={"api-key": BREVO_API_KEY, "accept": "application/json", "content-type": "application/json"},
        timeout=20,
    )
    return r.status_code, r.text


# Manda al correo del pedido un mensaje con su estado actual. Nunca rompe el flujo si falla.
async def enviar_correo_pedido(pedido_id):
    try:
        if not BREVO_API_KEY or not BREVO_SENDER_EMAIL:
            print("Brevo no configurado: falta BREVO_API_KEY o BREVO_SENDER_EMAIL")
            return
        pedidos = await consultar("SELECT * FROM pedidos WHERE id = :id", {"id": int(pedido_id)})
        if not pedidos:
            return
        p = pedidos[0]
        lineas = await consultar(
            """SELECT d.cantidad, d.precio_unitario, pr.titulo, pr.artista
               FROM detalle_pedido d JOIN productos pr ON pr.id = d.producto_id
               WHERE d.pedido_id = :id ORDER BY d.id""",
            {"id": int(pedido_id)},
        )
        status = str(p["status"])
        titulo, texto = TEXTOS.get(status, ("Actualizacion de tu pedido", f"Tu pedido ahora esta en estado {status}."))
        payload = {
            "sender": {"name": BREVO_SENDER_NAME, "email": BREVO_SENDER_EMAIL},
            "to": [{"email": p["email"], "name": p["nombre_cliente"]}],
            "subject": f"Pedido #{p['id']}: {titulo}",
            "htmlContent": _plantilla(p, lineas, status, titulo, texto),
        }
        codigo, respuesta = await asyncio.to_thread(_enviar, payload)
        if codigo >= 300:
            print("Error Brevo:", codigo, respuesta)
        else:
            print(f"Correo de seguimiento enviado: pedido {p['id']} ({status})")
    except Exception as e:
        print("Error al enviar correo:", e)


# Lo lanza en segundo plano para no hacer esperar la respuesta al cliente
def notificar_pedido(pedido_id):
    asyncio.create_task(enviar_correo_pedido(pedido_id))