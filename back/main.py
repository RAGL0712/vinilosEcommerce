import uvicorn
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from strawberry.fastapi import GraphQLRouter

from schema import schema
from jwt_service import decodificar


async def get_context(request: Request):
    usuario = None
    expirado = False

    header = request.headers.get("Authorization")
    if header and header.startswith("Bearer "):
        datos = decodificar(header[7:])
        if datos is None:
            expirado = True
        elif datos.get("tipo") == "access":
            usuario = datos

    return {"usuario": usuario, "expirado": expirado}


app = FastAPI(title="Vinillos Ecommerce")

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

app.include_router(GraphQLRouter(schema, path="/", context_getter=get_context))

if __name__ == '__main__':
    uvicorn.run("main:app", host="localhost", port=4000, reload=True)
