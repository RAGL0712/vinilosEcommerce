try:
    from mcp.server.mcpserver import MCPServer
except ImportError:
    from mcp.server.fastmcp import FastMCP as MCPServer

from db import consultar

mcp = MCPServer("vinillos1")


@mcp.tool()
async def productos_mas_vendidos(limite: int = 5) -> list[dict]:
    limite = max(1, min(limite, 20))
    filas = await consultar(
        """SELECT p.titulo, p.artista, SUM(d.cantidad) AS unidades, SUM(d.cantidad * d.precio_unitario) AS ingresos
           FROM detalle_pedido d
           JOIN pedidos pe ON pe.id = d.pedido_id AND pe.status <> 'CANCELADO'
           JOIN productos p ON p.id = d.producto_id
           GROUP BY p.id, p.titulo, p.artista
           ORDER BY unidades DESC
           LIMIT :limite""",
        {"limite": limite},
    )
    return [
        {"titulo": f["titulo"], "artista": f["artista"], "unidades_vendidas": int(f["unidades"]), "ingresos_mxn": float(f["ingresos"])}
        for f in filas
    ]


@mcp.tool()
async def buscar_producto(texto: str) -> list[dict]:
    filas = await consultar(
        """SELECT p.titulo, p.artista, c.nombre AS categoria, p.precio, p.stock
           FROM productos p JOIN categorias c ON c.id = p.categoria_id
           WHERE p.titulo ILIKE :t OR p.artista ILIKE :t
           ORDER BY p.titulo LIMIT 20""",
        {"t": f"%{texto.strip()}%"},
    )
    return [
        {"titulo": f["titulo"], "artista": f["artista"], "categoria": f["categoria"], "precio_mxn": float(f["precio"] or 0), "stock": f["stock"]}
        for f in filas
    ]


@mcp.tool()
async def productos_a_reponer(umbral: int = 5, dias: int = 30) -> list[dict]:
    filas = await consultar(
        """SELECT p.titulo, p.artista, p.stock,
                  COALESCE(SUM(d.cantidad) FILTER (
                      WHERE pe.status <> 'CANCELADO' AND pe.fecha >= NOW() - make_interval(days => :dias)
                  ), 0) AS vendidos
           FROM productos p
           LEFT JOIN detalle_pedido d ON d.producto_id = p.id
           LEFT JOIN pedidos pe ON pe.id = d.pedido_id
           WHERE p.stock <= :umbral
           GROUP BY p.id, p.titulo, p.artista, p.stock
           ORDER BY vendidos DESC, p.stock ASC""",
        {"umbral": umbral, "dias": dias},
    )
    return [
        {"titulo": f["titulo"], "artista": f["artista"], "stock": f["stock"], f"vendidos_ultimos_{dias}_dias": int(f["vendidos"])}
        for f in filas
    ]


@mcp.tool()
async def reporte_semanal() -> dict:
    r = (await consultar(
        """SELECT COUNT(*) AS pedidos, COALESCE(SUM(total), 0) AS ingresos, COALESCE(AVG(total), 0) AS ticket
           FROM pedidos WHERE status <> 'CANCELADO' AND fecha >= NOW() - INTERVAL '7 days'"""
    ))[0]
    top = await consultar(
        """SELECT p.titulo, SUM(d.cantidad) AS unidades
           FROM detalle_pedido d
           JOIN pedidos pe ON pe.id = d.pedido_id AND pe.status <> 'CANCELADO' AND pe.fecha >= NOW() - INTERVAL '7 days'
           JOIN productos p ON p.id = d.producto_id
           GROUP BY p.titulo ORDER BY unidades DESC LIMIT 3"""
    )
    return {
        "pedidos": r["pedidos"],
        "ingresos_mxn": float(r["ingresos"]),
        "ticket_promedio_mxn": round(float(r["ticket"]), 2),
        "top_3_semana": [{"titulo": t["titulo"], "unidades": int(t["unidades"])} for t in top],
    }


@mcp.resource("tienda://catalogo")
async def catalogo() -> str:
    filas = await consultar("SELECT titulo, artista, precio, stock FROM productos ORDER BY titulo")
    lineas = [f"- {f['titulo']} ({f['artista']}): ${float(f['precio'] or 0):.0f} MXN, stock {f['stock']}" for f in filas]
    return "CATÁLOGO\n" + "\n".join(lineas)


@mcp.resource("tienda://estadisticas")
async def estadisticas() -> str:
    u = (await consultar("SELECT COUNT(*) AS n FROM usuarios"))[0]["n"]
    p = (await consultar(
        "SELECT COUNT(*) AS n, COALESCE(SUM(total) FILTER (WHERE status <> 'CANCELADO'), 0) AS ing FROM pedidos"
    ))[0]
    return f"ESTADÍSTICAS\nUsuarios: {u}\nPedidos: {p['n']}\nIngresos totales: ${float(p['ing']):.2f} MXN"


@mcp.prompt()
def resumen_ventas() -> str:
    return (
        "Usa la herramienta productos_mas_vendidos y haz un resumen de ventas: "
        "menciona el disco estrella, el que menos vende y una recomendación breve."
    )


@mcp.prompt()
def reporte_semanal_prompt() -> str:
    return (
        "Usa la herramienta reporte_semanal y presenta un reporte de la semana: "
        "pedidos, ingresos, ticket promedio y los 3 discos más vendidos, con una conclusión breve."
    )


@mcp.prompt()
def que_comprar(umbral: str = "5") -> str:
    return (
        f"Usa la herramienta productos_a_reponer con umbral {umbral} y dime qué discos "
        "comprar primero, del más urgente al menos urgente, explicando por qué."
    )

# ---------- Enviar reportes por correo a los administradores ----------
import sys
import html
import asyncio

from notificaciones import _enviar, BREVO_API_KEY, BREVO_SENDER_EMAIL, BREVO_SENDER_NAME


def _html_reporte(asunto: str, contenido: str) -> str:
    cuerpo = html.escape(contenido).replace("\n", "<br>")
    return f"""<html><body style="margin:0;padding:24px;background:#f4f4f4;font-family:Montserrat,Arial,sans-serif;color:#000;">
<table width="600" align="center" cellpadding="0" cellspacing="0" style="background:#fff;border:2px solid #000;border-radius:10px;padding:24px;">
<tr><td>
  <h1 style="margin:0 0 4px;font-size:26px;letter-spacing:2px;">VINILO</h1>
  <p style="margin:0 0 20px;color:#666;">Reporte generado con el asistente (MCP)</p>
  <h2 style="margin:0 0 12px;font-size:20px;">{html.escape(asunto)}</h2>
  <div style="font-size:14px;line-height:1.6;">{cuerpo}</div>
</td></tr></table>
<p style="text-align:center;color:#888;font-size:12px;">Este correo se envio solo a los administradores de Vinilo.</p>
</body></html>"""


@mcp.tool()
async def enviar_reporte_admins(asunto: str, contenido: str, admin: str = "") -> dict:
    """Envia un reporte por correo (Brevo) UNICAMENTE a usuarios con rol ADMIN.
    Usala despues de generar el texto de un reporte cuando el usuario pida mandarlo por correo.
    asunto: titulo corto del correo. contenido: texto completo del reporte.
    admin: opcional. Nombre o correo de UN admin especifico; vacio = todos los admins."""
    if not BREVO_API_KEY or not BREVO_SENDER_EMAIL:
        return {"enviado": False, "error": "Falta BREVO_API_KEY o BREVO_SENDER_EMAIL en back/.env"}

    admin = (admin or "").strip()
    if admin:
        admins = await consultar(
            """SELECT nombre, email FROM usuarios
               WHERE rol = 'ADMIN' AND (LOWER(email) = LOWER(:a) OR nombre ILIKE :n)
               ORDER BY id""",
            {"a": admin, "n": f"%{admin}%"},
        )
        if not admins:
            todos = await consultar("SELECT nombre, email FROM usuarios WHERE rol = 'ADMIN' ORDER BY id")
            return {
                "enviado": False,
                "error": f"No hay ningun admin que coincida con '{admin}'",
                "admins_disponibles": [f"{a['nombre']} <{a['email']}>" for a in todos],
            }
    else:
        admins = await consultar("SELECT nombre, email FROM usuarios WHERE rol = 'ADMIN' ORDER BY id")
        if not admins:
            return {"enviado": False, "error": "No hay usuarios con rol ADMIN"}

    payload = {
        "sender": {"name": BREVO_SENDER_NAME, "email": BREVO_SENDER_EMAIL},
        "to": [{"email": a["email"], "name": a["nombre"]} for a in admins],
        "subject": f"Vinilo | {asunto}"[:150],
        "htmlContent": _html_reporte(asunto, contenido),
    }
    codigo, respuesta = await asyncio.to_thread(_enviar, payload)
    if codigo >= 300:
        print("Error Brevo:", codigo, respuesta, file=sys.stderr)  # nunca print a stdout en un MCP stdio
        return {"enviado": False, "error": f"Brevo respondio {codigo}: {respuesta[:200]}"}
    return {"enviado": True, "destinatarios": [a["email"] for a in admins]}

@mcp.tool()
async def reporte_ganancias(dias: int = 7) -> dict:
    """Ganancias de los ultimos 'dias' dias contando solo pedidos PAGADO o ENVIADO."""
    dias = max(1, min(dias, 365))
    r = (await consultar(
        """SELECT COUNT(*) AS pedidos, COALESCE(SUM(total), 0) AS ingresos, COALESCE(AVG(total), 0) AS ticket
           FROM pedidos
           WHERE status IN ('PAGADO', 'ENVIADO') AND fecha >= NOW() - make_interval(days => :dias)""",
        {"dias": dias},
    ))[0]
    por_dia = await consultar(
        """SELECT to_char(fecha, 'YYYY-MM-DD') AS dia, COUNT(*) AS pedidos, SUM(total) AS ingresos
           FROM pedidos
           WHERE status IN ('PAGADO', 'ENVIADO') AND fecha >= NOW() - make_interval(days => :dias)
           GROUP BY dia ORDER BY dia""",
        {"dias": dias},
    )
    return {
        "periodo_dias": dias,
        "pedidos_pagados": r["pedidos"],
        "ganancias_mxn": float(r["ingresos"]),
        "ticket_promedio_mxn": round(float(r["ticket"]), 2),
        "por_dia": [{"dia": d["dia"], "pedidos": d["pedidos"], "ingresos_mxn": float(d["ingresos"])} for d in por_dia],
    }


@mcp.prompt()
def reporte_ganancias_correo(dias: str = "7") -> str:
    return (
        f"Usa la herramienta reporte_ganancias con dias={dias} y redacta un reporte de ganancias claro: "
        "periodo, pedidos pagados, ganancias totales, ticket promedio, el mejor dia y una conclusion breve. "
        "Muestramelo y despues envialo con la herramienta enviar_reporte_admins usando un asunto corto."
    )

if __name__ == "__main__":
    mcp.run()