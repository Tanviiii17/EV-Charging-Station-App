"""Analytics API route — aggregated statistics for the dashboard."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from collections import defaultdict
from ..database import get_db
from .. import models
import os, sys

router = APIRouter(prefix="/api/analytics", tags=["Analytics"])

# ML path for wait-time predictions
_ML_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "ml")
if _ML_DIR not in sys.path:
    sys.path.insert(0, _ML_DIR)


def _predict_wait_for_hour(station, hour: int, dow: int) -> float:
    """Get predicted wait for a station at a given hour."""
    try:
        from predict import predict_wait_time as ml_predict
        result = ml_predict(
            hour=hour,
            day_of_week=dow,
            station_capacity=station.total_slots,
            active_chargers=station.total_slots - station.available_slots,
            queue_length=max(0, (station.total_slots - station.available_slots) - station.total_slots + 1),
        )
        return result["predicted_wait_minutes"]
    except Exception:
        occupancy = (station.total_slots - station.available_slots) / max(station.total_slots, 1)
        is_peak = hour in range(8, 11) or hour in range(17, 21)
        return round(occupancy * 30 * (1.5 if is_peak else 1.0), 1)


@router.get("/overview")
def analytics_overview(db: Session = Depends(get_db)):
    """Return aggregated analytics data for the dashboard."""

    stations = db.query(models.Station).filter(models.Station.is_active == True).all()
    all_bookings = db.query(models.Booking).all()

    # ── Bookings per station ──────────────────────────────────────────────────
    bookings_per_station = defaultdict(int)
    for b in all_bookings:
        bookings_per_station[b.station_id] += 1

    station_name_map = {s.id: s.name for s in stations}
    bookings_chart = [
        {"station": station_name_map.get(sid, f"Station #{sid}"), "bookings": count}
        for sid, count in sorted(bookings_per_station.items(), key=lambda x: -x[1])
    ]

    # If no bookings yet, still show stations with 0
    if not bookings_chart:
        bookings_chart = [
            {"station": s.name, "bookings": 0}
            for s in sorted(stations, key=lambda s: -s.rating)[:8]
        ]

    # ── Peak hour distribution (ML-predicted average wait across stations) ────
    peak_hours = []
    for hour in range(24):
        avg_wait = 0
        if stations:
            waits = [_predict_wait_for_hour(s, hour, 2) for s in stations]  # Wednesday as typical day
            avg_wait = round(sum(waits) / len(waits), 1)
        peak_hours.append({"hour": hour, "label": f"{hour:02d}:00", "avg_wait_minutes": avg_wait})

    # ── Average wait time (current hour) ─────────────────────────────────────
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc)
    current_waits = [_predict_wait_for_hour(s, now.hour, now.weekday()) for s in stations] if stations else [0]
    avg_wait_now = round(sum(current_waits) / len(current_waits), 1)

    # ── Most used station ────────────────────────────────────────────────────
    if bookings_per_station:
        most_used_id = max(bookings_per_station, key=bookings_per_station.get)
        most_used_station = station_name_map.get(most_used_id, "Unknown")
        most_used_count = bookings_per_station[most_used_id]
    else:
        # Fall back to highest-rated station
        top = max(stations, key=lambda s: s.rating) if stations else None
        most_used_station = top.name if top else "N/A"
        most_used_count = 0

    # ── Summary stats ────────────────────────────────────────────────────────
    total_bookings = len(all_bookings)
    active_bookings = sum(1 for b in all_bookings if b.status == "confirmed")
    total_stations = len(stations)
    total_slots = sum(s.total_slots for s in stations)
    available_slots = sum(s.available_slots for s in stations)
    avg_rating = round(sum(s.rating for s in stations) / len(stations), 1) if stations else 0

    return {
        "bookings_per_station": bookings_chart,
        "peak_hours": peak_hours,
        "avg_wait_minutes": avg_wait_now,
        "most_used_station": most_used_station,
        "most_used_count": most_used_count,
        "summary": {
            "total_bookings": total_bookings,
            "active_bookings": active_bookings,
            "total_stations": total_stations,
            "total_slots": total_slots,
            "available_slots": available_slots,
            "avg_rating": avg_rating,
        },
    }
