"""Prediction API route — integrates with the ML module."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from .. import models, schemas
import os, sys

router = APIRouter(prefix="/api/predict", tags=["AI Predictions"])

# Add ml/ directory to path so we can import the predictor
ML_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "ml")
if ML_DIR not in sys.path:
    sys.path.insert(0, ML_DIR)


@router.post("/wait-time", response_model=schemas.WaitTimePredictionResponse)
def predict_wait_time(
    data: schemas.WaitTimePredictionRequest,
    db: Session = Depends(get_db),
):
    station = db.query(models.Station).filter(models.Station.id == data.station_id).first()
    if not station:
        raise HTTPException(status_code=404, detail="Station not found")

    try:
        from predict import predict_wait_time as ml_predict

        result = ml_predict(
            hour=data.hour,
            day_of_week=data.day_of_week,
            station_capacity=station.total_slots,
            active_chargers=station.total_slots - station.available_slots,
            queue_length=max(0, (station.total_slots - station.available_slots) - station.total_slots + 1),
        )
    except Exception:
        # Fallback heuristic if model isn't trained yet
        occupancy = (station.total_slots - station.available_slots) / max(station.total_slots, 1)
        is_peak = data.hour in range(8, 11) or data.hour in range(17, 21)
        base_wait = occupancy * 30
        result = {
            "predicted_wait_minutes": round(base_wait * (1.5 if is_peak else 1.0), 1),
        }

    wait_mins = result["predicted_wait_minutes"]

    # Generate smart recommendations
    recommendations = []
    if wait_mins > 20:
        recommendations.append("⏰ Consider visiting during off-peak hours (11 AM - 4 PM)")
    if wait_mins > 10:
        recommendations.append("🔋 Pre-book a slot to guarantee availability")
    if station.available_slots <= 1:
        recommendations.append("⚡ This station is nearly full — check nearby alternatives")
    if wait_mins <= 5:
        recommendations.append("✅ Great time to charge! Minimal wait expected")
    recommendations.append(f"💰 Estimated cost: ₹{station.price_per_kwh * 15:.0f} for a typical 15 kWh charge")

    confidence = "high" if wait_mins < 15 else ("medium" if wait_mins < 30 else "low")

    return schemas.WaitTimePredictionResponse(
        station_name=station.name,
        predicted_wait_minutes=round(wait_mins, 1),
        confidence=confidence,
        recommendations=recommendations,
    )
