import strawberry
from enum import Enum
from passlib.context import CryptContext

from db import consultar, ejecutar
from jwt_service import crear_access, crear_refresh, decodificar

pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")


#TYPES


@strawberry.type
class Usuario:
    id: strawberry.ID
    nombre: str
    email: str
    rol: "RolUsuario"

@strawberry.type
class Sesion:
    accessToken: str
    refreshToken: str
    usuario: Usuario


def crear_usuario(f):
    return Usuario(id=f["id"], nombre=f["nombre"], email=f["email"], rol=RolUsuario(f["rol"]))

async def crear_sesion(f):
    access = crear_access(f["id"], f["rol"])
    refresh, jti = crear_refresh(f["id"], f["rol"])
    await ejecutar("INSERT INTO refresh_tokens (usuario_id, jti) VALUES (:usuario, :jti)", {"usuario": f["id"], "jti": jti})
    return Sesion(accessToken=access, refreshToken=refresh, usuario=crear_usuario(f))




# MUTATIONS

@strawberry.type
class UsuarioMutations:
    @strawberry.field
    async def crearUsuario(self, datos: "UsuarioInput") -> Usuario:
        filas = await ejecutar(
            "INSERT INTO usuarios (nombre, email, password) VALUES (:nombre, :email, :password) RETURNING *",
            {"nombre": datos.nombre, "email": datos.email.lower(), "password": pwd_context.hash(datos.password)},
        )
        return crear_usuario(filas[0])

    @strawberry.field
    async def login(self, datos: "LoginInput") -> Sesion:
        filas = await consultar("SELECT * FROM usuarios WHERE email = :email", {"email": datos.email.lower()})
        if len(filas) == 0 or not pwd_context.verify(datos.password, filas[0]["password"]):
            raise Exception("Correo o contrasena incorrectos")
        return await crear_sesion(filas[0])

    @strawberry.field
    async def refrescarToken(self, refreshToken: str) -> Sesion:
        datos = decodificar(refreshToken)
        if datos is None or datos.get("tipo") != "refresh":
            raise Exception("Refresh token invalido")

        guardado = await consultar("SELECT * FROM refresh_tokens WHERE jti = :jti", {"jti": datos["jti"]})
        if len(guardado) == 0:
            raise Exception("Refresh token invalido")

        # si ya se uso, cerramos todas las sesiones del usuario
        if guardado[0]["usado"]:
            await ejecutar("UPDATE refresh_tokens SET usado = TRUE WHERE usuario_id = :id", {"id": datos["usuario_id"]})
            raise Exception("Refresh token ya utilizado, inicia sesion otra vez")

        await ejecutar("UPDATE refresh_tokens SET usado = TRUE WHERE jti = :jti", {"jti": datos["jti"]})
        usuarios = await consultar("SELECT * FROM usuarios WHERE id = :id", {"id": datos["usuario_id"]})
        return await crear_sesion(usuarios[0])

    @strawberry.field
    async def logout(self, refreshToken: str) -> bool:
        datos = decodificar(refreshToken)
        if datos is None or datos.get("tipo") != "refresh":
            raise Exception("Refresh token invalido")
        await ejecutar("UPDATE refresh_tokens SET usado = TRUE WHERE jti = :jti", {"jti": datos["jti"]})
        return True





# INPUT


@strawberry.input
class UsuarioInput:
    nombre: str
    email: str
    password: str

@strawberry.input
class LoginInput:
    email: str
    password: str






# ENUMS


@strawberry.enum
class RolUsuario(Enum):
    CLIENTE = "CLIENTE"
    ADMIN = "ADMIN"
