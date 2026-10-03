import os
from dotenv import load_dotenv
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

load_dotenv()

engine = create_async_engine(os.getenv("DB_CONFIG"))


async def consultar(sql, params={}):
    async with engine.connect() as conn:
        res = await conn.execute(text(sql), params)
        return res.mappings().all()


async def ejecutar(sql, params={}):
    async with engine.begin() as conn:
        res = await conn.execute(text(sql), params)
        return res.mappings().all() if res.returns_rows else []
