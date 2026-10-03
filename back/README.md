## Requisitos

- Postgres
- Python
- FastAPI
- Strawberry
- GraphQL

## 1. Base de datos


```env
DB_CONFIG=postgresql+asyncpg:// USUARIO : CONTRASEÑA @localhost:5433/vinillosEcommerce

```

## 2. Back

```bash
cd back
python3 -m venv venv
source venv/bin/activate
pip install uvicorn fastapi sqlalchemy[asyncio]
pip install -r requirements.txt
python crear_usuarios.py
uvicorn main:app --port 4000 --reload
```

El back en `http://localhost:4000`.

## 3. Front

```bash
cd front
npm install
npm run dev
```

El front en `http://localhost:4321`.

## Usuarios de prueba

1@gmail 123456 
admin@gmail admin123