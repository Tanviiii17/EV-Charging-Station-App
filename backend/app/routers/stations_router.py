"""Station CRUD API routes with real-time availability updates, smart recommendations,
and optional real-world data from OpenChargeMap.
"""

from dataclasses import dataclass
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime, timezone
from ..database import get_db
from .. import models, schemas, auth
from ..ws_manager import manager
import os, sys

# Add ml/ directory to path for wait-time prediction in recommendations
_ML_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "ml")
if _ML_DIR not in sys.path:
    sys.path.insert(0, _ML_DIR)

router = APIRouter(prefix="/api/stations", tags=["Stations"])


# ── Lightweight proxy object so scoring functions work on external dicts ───────

@dataclass
class _StationProxy:
    """Minimal Station-like object for ML scoring of external stations."""
    total_slots: int
    available_slots: int
    price_per_kwh: float
    capacity_kw: float
    rating: float


# ── List Stations (local / external / all) ─────────────────────────────────────

@router.get("/", response_model=list[schemas.StationOut])
async def list_stations(
    location: Optional[str] = Query(None),
    area: Optional[str] = Query(None),
    available_only: bool = Query(False),
    connector_type: Optional[str] = Query(None),
    source: str = Query("local", regex="^(local|external|all)$"),
    db: Session = Depends(get_db),
):
    """List stations with optional filters. source=local|external|all."""

    results: list[schemas.StationOut] = []

    # ── Local DB stations ──
    if source in ("local", "all"):
        query = db.query(models.Station).filter(models.Station.is_active == True)
        if location:
            query = query.filter(models.Station.location.ilike(f"%{location}%"))
        if area:
            query = query.filter(models.Station.area.ilike(f"%{area}%"))
        if available_only:
            query = query.filter(models.Station.available_slots > 0)
        if connector_type:
            query = query.filter(models.Station.connector_type == connector_type)

        for s in query.order_by(models.Station.rating.desc()).all():
            out = schemas.StationOut.model_validate(s)
            out.source = "local"
            results.append(out)

    # ── External API stations ──
    if source in ("external", "all"):
        from ..services.external_api import fetch_external_stations
        external_raw = await fetch_external_stations(max_results=20)
        for d in external_raw:
            # Apply client-side filters to external data
            if available_only and d["available_slots"] == 0:
                continue
            if connector_type and d["connector_type"] != connector_type:
                continue
            if location and location.lower() not in (d["location"] + d["area"]).lower():
                continue
            if area and area.lower() not in (d["location"] + d["area"]).lower():
                continue
            results.append(schemas.ExternalStationOut(**d))

    return results


# ── External Stations (dedicated endpoint) ─────────────────────────────────────

@router.get("/external", response_model=list[schemas.ExternalStationOut])
async def list_external_stations():
    """Fetch real-world EV charging stations from OpenChargeMap API (India)."""
    from ..services.external_api import fetch_external_stations
    raw = await fetch_external_stations(max_results=20)
    return [schemas.ExternalStationOut(**d) for d in raw]


# ── Smart Recommendation Engine ───────────────────────────────────────────────

def _predict_wait(station, hour: int, day_of_week: int) -> float:
    """Get predicted wait time for a station using ML model with fallback."""
    try:
        from predict import predict_wait_time as ml_predict
        result = ml_predict(
            hour=hour,
            day_of_week=day_of_week,
            station_capacity=station.total_slots,
            active_chargers=station.total_slots - station.available_slots,
            queue_length=max(0, (station.total_slots - station.available_slots) - station.total_slots + 1),
        )
        return result["predicted_wait_minutes"]
    except Exception:
        occupancy = (station.total_slots - station.available_slots) / max(station.total_slots, 1)
        is_peak = hour in range(8, 11) or hour in range(17, 21)
        return round(occupancy * 30 * (1.5 if is_peak else 1.0), 1)


def _score_station(station, wait_mins: float, all_stations: list) -> dict:
    """Score a station from 0-100 using weighted multi-factor ranking.

    Weights:
        availability  35% — ratio of available_slots / total_slots
        wait_time     30% — inverse of predicted wait (lower is better)
        price         20% — inverse of price relative to max price (cheaper is better)
        capacity      15% — power capacity relative to max in set
    """
    max_price = max(s.price_per_kwh for s in all_stations) or 1
    max_capacity = max(s.capacity_kw for s in all_stations) or 1

    avail_score = (station.available_slots / max(station.total_slots, 1)) * 100
    wait_score = max(0, 100 - (wait_mins * 3))  # 0 min → 100, 33+ min → 0
    price_score = (1 - station.price_per_kwh / max_price) * 100 if max_price > 0 else 50
    capacity_score = (station.capacity_kw / max_capacity) * 100

    breakdown = {
        "availability": round(avail_score, 1),
        "wait_time": round(wait_score, 1),
        "price": round(price_score, 1),
        "capacity": round(capacity_score, 1),
    }

    W_AVAIL, W_WAIT, W_PRICE, W_CAPACITY = 0.35, 0.30, 0.20, 0.15
    total = (
        avail_score * W_AVAIL +
        wait_score * W_WAIT +
        price_score * W_PRICE +
        capacity_score * W_CAPACITY
    )

    return {"score": round(total, 1), "breakdown": breakdown}


def _generate_reason(station, breakdown: dict, wait_mins: float) -> str:
    """Generate a human-readable reason why this station is recommended."""
    reasons = []
    if breakdown["availability"] >= 80:
        reasons.append(f"high availability ({station.available_slots}/{station.total_slots} slots)")
    if breakdown["wait_time"] >= 80:
        reasons.append(f"minimal wait (~{wait_mins:.0f} min)")
    if breakdown["price"] >= 60:
        reasons.append(f"competitive pricing (₹{station.price_per_kwh}/kWh)")
    if breakdown["capacity"] >= 70:
        reasons.append(f"fast charging ({station.capacity_kw} kW)")
    if station.rating >= 4.5:
        reasons.append(f"top-rated (⭐ {station.rating})")
    if not reasons:
        reasons.append("good overall balance of availability, price, and speed")
    return "Recommended for " + ", ".join(reasons)


@router.get("/recommend", response_model=schemas.RecommendationResponse)
def recommend_stations(
    hour: Optional[int] = Query(None, ge=0, le=23),
    day_of_week: Optional[int] = Query(None, ge=0, le=6),
    db: Session = Depends(get_db),
):
    """AI-powered station recommendations ranked by a multi-factor scoring engine."""
    now = datetime.now(timezone.utc)
    h = hour if hour is not None else now.hour
    dow = day_of_week if day_of_week is not None else now.weekday()

    all_active = db.query(models.Station).filter(models.Station.is_active == True).all()
    if not all_active:
        raise HTTPException(status_code=404, detail="No active stations found")

    scored = []
    for station in all_active:
        wait = _predict_wait(station, h, dow)
        result = _score_station(station, wait, all_active)
        reason = _generate_reason(station, result["breakdown"], wait)
        scored.append(schemas.RecommendedStation(
            station=schemas.StationOut.model_validate(station),
            score=result["score"],
            predicted_wait_minutes=round(wait, 1),
            score_breakdown=result["breakdown"],
            reason=reason,
        ))

    scored.sort(key=lambda x: x.score, reverse=True)

    return schemas.RecommendationResponse(best=scored[0], ranked=scored)

@router.get("/{station_id}", response_model=schemas.StationOut)
def get_station(station_id: int, db: Session = Depends(get_db)):
    station = db.query(models.Station).filter(models.Station.id == station_id).first()
    if not station:
        raise HTTPException(status_code=404, detail="Station not found")
    return station


@router.post("/", response_model=schemas.StationOut)
def create_station(
    data: schemas.StationCreate,
    db: Session = Depends(get_db),
    admin: models.User = Depends(auth.require_admin),
):
    station = models.Station(
        **data.model_dump(),
        available_slots=data.total_slots,
    )
    db.add(station)
    db.commit()
    db.refresh(station)
    return station


@router.patch("/{station_id}", response_model=schemas.StationOut)
async def update_station(
    station_id: int,
    data: schemas.StationUpdate,
    db: Session = Depends(get_db),
    admin: models.User = Depends(auth.require_admin),
):
    station = db.query(models.Station).filter(models.Station.id == station_id).first()
    if not station:
        raise HTTPException(status_code=404, detail="Station not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(station, field, value)

    db.commit()
    db.refresh(station)

    # Broadcast real-time update
    await manager.broadcast_station_update({
        "id": station.id,
        "name": station.name,
        "available_slots": station.available_slots,
        "total_slots": station.total_slots,
        "is_active": station.is_active,
    })

    return station
