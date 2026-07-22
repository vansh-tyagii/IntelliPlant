from __future__ import annotations

from fastapi import FastAPI
from .routers.twin import router
from .services.twin_service import TwinService

def create_app() -> FastAPI:
    app = FastAPI(title="ETAI Plant Digital Twin API", version="2.0.0", description="Read-only consumer of existing industrial safety runtime outputs.")
    app.state.twin = TwinService()
    app.include_router(router)

    @app.get("/", tags=["service"])
    def root() -> dict[str, str]:
        return {"service": "ETAI Plant Digital Twin API", "status": "ready", "docs": "/docs", "api_prefix": "/api/v1"}

    return app

app = create_app()
