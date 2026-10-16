import asyncio
from typing import AsyncGenerator, List, Optional

import strawberry

from db import consultar, ejecutar
from auth import requerir_admin
from jwt_service import decodificar
from resolvers.usuario import Usuario, RolUsuario, crear_usuario, pwd_context
from resolvers.producto import Producto, crear_producto
from resolvers.pedido import Pedido, crear_pedido, StatusPedido

# ---------- AUTH PARA SUBSCRIPTIONS ----------
# El navegador no puede mandar headers en un WebSocket, asi que el token
# llega en el mensaje "connection_init" (info.context["connection_params"]).
def requerir_admin_ws(info):
    params = info.context.get("connection_params") or {}
    header = params.get("Authorization", "")
    if not header.startswith("Bearer "):
        raise Exception("Debes iniciar sesion")
    datos = decodificar(header[7:])
    if datos is None:
        raise Exception("TOKEN_EXPIRADO")
    if datos.get("tipo") != "access" or datos.get("rol") != "ADMIN":
        raise Exception("No tienes permiso")
    return datos


# Consulta la BD cada 2s y solo emite cuando algo cambio.
async def en_vivo(sql, crear):
    ultima = None
    while True:
        filas = await consultar(sql)
        firma = repr([dict(f) for f in filas])
        if firma != ultima:
            ultima = firma
            yield [crear(f) for f in filas]
        await asyncio.sleep(2)


# ---------- INPUTS ----------
@strawberry.input
class UsuarioAdminInput:
    nombre: str
    email: str
    password: str
    rol: RolUsuario = RolUsuario.CLIENTE


@strawberry.input
class UsuarioAdminUpdate:
    nombre: Optional[str] = None
    email: Optional[str] = None
    password: Optional[str] = None
    rol: Optional[RolUsuario] = None


# ---------- SUBSCRIPTIONS ----------
@strawberry.type
class AdminSubscriptions:
    @strawberry.subscription
    async def usuariosEnVivo(self, info: strawberry.Info) -> AsyncGenerator[List[Usuario], None]:
        requerir_admin_ws(info)
        async for lista in en_vivo("SELECT id, nombre, email, rol FROM usuarios ORDER BY id", crear_usuario):
            yield lista

    @strawberry.subscription
    async def productosEnVivo(self, info: strawberry.Info) -> AsyncGenerator[List[Producto], None]:
        requerir_admin_ws(info)
        async for lista in en_vivo("SELECT * FROM productos ORDER BY id", crear_producto):
            yield lista

    @strawberry.subscription
    async def pedidosEnVivo(self, info: strawberry.Info) -> AsyncGenerator[List[Pedido], None]:
        requerir_admin_ws(info)
        async for lista in en_vivo("SELECT * FROM pedidos ORDER BY fecha DESC", crear_pedido):
            yield lista


# ---------- MUTATIONS (CRUD de usuarios) ----------
@strawberry.type
class AdminMutations:
    @strawberry.field
    async def adminCrearUsuario(self, info: strawberry.Info, datos: UsuarioAdminInput) -> Usuario:
        requerir_admin(info)
        email = datos.email.strip().lower()
        if await consultar("SELECT id FROM usuarios WHERE LOWER(email) = :email", {"email": email}):
            raise Exception("este correo ya esta en uso!")
        filas = await ejecutar(
            """INSERT INTO usuarios (nombre, email, password, rol)
               VALUES (:nombre, :email, :password, CAST(:rol AS rol_usuario_enum))
               RETURNING *""",
            {"nombre": datos.nombre, "email": email, "password": pwd_context.hash(datos.password), "rol": datos.rol.value},
        )
        return crear_usuario(filas[0])

    @strawberry.field
    async def adminActualizarUsuario(self, info: strawberry.Info, id: strawberry.ID, datos: UsuarioAdminUpdate) -> Usuario:
        admin = requerir_admin(info)
        if int(id) == int(admin["usuario_id"]) and datos.rol is not None and datos.rol != RolUsuario.ADMIN:
            raise Exception("No puedes quitarte el rol de admin a ti mismo")

        email = datos.email.strip().lower() if datos.email else None
        if email and await consultar("SELECT id FROM usuarios WHERE LOWER(email) = :email AND id <> :id", {"email": email, "id": int(id)}):
            raise Exception("este correo ya esta en uso!")

        filas = await ejecutar(
            """UPDATE usuarios SET
                 nombre = COALESCE(:nombre, nombre),
                 email = COALESCE(:email, email),
                 password = COALESCE(:password, password),
                 rol = COALESCE(CAST(:rol AS rol_usuario_enum), rol)
               WHERE id = :id RETURNING *""",
            {
                "nombre": datos.nombre or None,
                "email": email,
                "password": pwd_context.hash(datos.password) if datos.password else None,
                "rol": datos.rol.value if datos.rol else None,
                "id": int(id),
            },
        )
        if not filas:
            raise Exception("Usuario no encontrado")
        return crear_usuario(filas[0])

    @strawberry.field
    async def adminEliminarUsuario(self, info: strawberry.Info, id: strawberry.ID) -> bool:
        admin = requerir_admin(info)
        if int(id) == int(admin["usuario_id"]):
            raise Exception("No puedes eliminarte a ti mismo")
        if await consultar("SELECT 1 FROM pedidos WHERE usuario_id = :id LIMIT 1", {"id": int(id)}):
            raise Exception("No se puede eliminar: el usuario tiene pedidos")
        await ejecutar("DELETE FROM usuarios WHERE id = :id", {"id": int(id)})
        return True


    
    @strawberry.field
    async def adminCambiarEstadoPedido(self, info: strawberry.Info, id: strawberry.ID, status: StatusPedido) -> Pedido:
        requerir_admin(info)
        filas = await consultar("SELECT status FROM pedidos WHERE id = :id", {"id": int(id)})
        if not filas:
            raise Exception("Pedido no encontrado")
        actual = str(filas[0]["status"])
        nuevo = status.value
        orden = ["PENDIENTE", "PAGADO", "ENVIADO"]
        if actual in ("ENVIADO", "CANCELADO"):
            raise Exception(f"El pedido ya esta {actual.lower()} y no se puede cambiar")
        if nuevo != "CANCELADO" and orden.index(nuevo) <= orden.index(actual):
            raise Exception("No se puede regresar a un estado anterior")
        filas = await ejecutar(
            "UPDATE pedidos SET status = CAST(:status AS status_pedido_enum) WHERE id = :id RETURNING *",
            {"status": nuevo, "id": int(id)},
        )
        return crear_pedido(filas[0])