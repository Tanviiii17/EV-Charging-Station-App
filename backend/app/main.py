"""FastAPI application entry point with CORS, routers, and WebSocket."""

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from .database import engine, Base
from .ws_manager import manager
from .routers import auth_router, stations_router, bookings_router, predictions_router, analytics_router

# Create all database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="EV Charging Station API",
    description="AI-Powered Electric Vehicle Charging Station Management System",
    version="2.0.0",
)

# CORS — allow frontend dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount routers
app.include_router(auth_router.router)
app.include_router(stations_router.router)
app.include_router(bookings_router.router)
app.include_router(predictions_router.router)
app.include_router(analytics_router.router)


@app.get("/")
def root():
    return {
        "name": "EV Charging Station API",
        "version": "2.0.0",
        "status": "running",
        "docs": "/docs",
    }


@app.get("/api/health")
def health_check():
    return {"status": "healthy"}


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # Keep connection alive; client can send pings
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text('{"type":"pong"}')
    except WebSocketDisconnect:
        manager.disconnect(websocket)
