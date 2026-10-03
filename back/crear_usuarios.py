import asyncio

from db import ejecutar, consultar
from resolvers.usuario import pwd_context


async def main():
    await ejecutar("UPDATE usuarios SET password = :password WHERE email = '1@gmail'", {"password": pwd_context.hash("123456")})
    await ejecutar("UPDATE usuarios SET password = :password WHERE email = 'admin@gmail'", {"password": pwd_context.hash("admin123")})

    filas = await consultar("SELECT * FROM usuarios ORDER BY id")
    print("1@gmail:", pwd_context.verify("123456", filas[0]["password"]))
    print("admin@gmail:", pwd_context.verify("admin123", filas[1]["password"]))


asyncio.run(main())
