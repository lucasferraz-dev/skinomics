from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.api import auth, health, itens, minha_lista, oportunidades
from app.core.config import get_settings


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title=settings.app_name, version="0.3.1")

    @app.middleware("http")
    async def impedir_cache_compartilhado(request: Request, call_next):
        response = await call_next(request)
        # Sessões, listas pessoais e previsões publicadas não devem ficar no CDN.
        response.headers["Cache-Control"] = "no-store"
        return response

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(health.router)
    app.include_router(auth.router)
    app.include_router(itens.router)
    app.include_router(minha_lista.router)
    app.include_router(oportunidades.router)
    return app


app = create_app()
