import uvicorn
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from strawberry.fastapi import GraphQLRouter

from schema import schema
from jwt_service import decodificar
import resolvers.pago as pago
from imagenes import router as imagenes_router, crear_tabla_imagenes


# request existe en peticiones HTTP y ws en conexiones WebSocket (subscriptions del backoffice)
async def get_context(request: Request = None, ws: WebSocket = None):
    usuario = None
    expirado = False

    header = request.headers.get("Authorization") if request else None
    if header and header.startswith("Bearer "):
        datos = decodificar(header[7:])
        if datos is None:
            expirado = True
        elif datos.get("tipo") == "access":
            usuario = datos

    return {"usuario": usuario, "expirado": expirado}


@asynccontextmanager
async def lifespan(app: FastAPI):
    await crear_tabla_imagenes()
    yield


app = FastAPI(title="Vinillos Ecommerce", lifespan=lifespan)

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


# Webhook de Mercado Pago: funciona con la API de Orders (type=order) o con la de Payments (type=payment)
@app.post("/webhook/mercadopago")
async def webhook_mercadopago(request: Request):
    params = request.query_params
    try:
        body = await request.json()
    except Exception:
        body = {}

    tipo = body.get("type") or params.get("type") or params.get("topic")
    recurso_id = (body.get("data") or {}).get("id") or params.get("data.id") or params.get("id")

    try:
        if tipo == "order" and recurso_id and hasattr(pago, "procesar_order"):
            await pago.procesar_order(recurso_id)
        elif tipo == "payment" and recurso_id and hasattr(pago, "procesar_pago"):
            await pago.procesar_pago(recurso_id)
    except Exception as e:
        print("Error en webhook:", e)

    return {"ok": True}


app.include_router(imagenes_router)
app.include_router(GraphQLRouter(schema, path="/", context_getter=get_context))

if __name__ == '__main__':
    uvicorn.run("main:app", host="localhost", port=4000, reload=True)
