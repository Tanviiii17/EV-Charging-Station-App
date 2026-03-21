"""Booking API routes with real-time availability sync."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from .. import models, schemas, auth
from ..ws_manager import manager

router = APIRouter(prefix="/api/bookings", tags=["Bookings"])


@router.post("/", response_model=schemas.BookingOut)
async def create_booking(
    data: schemas.BookingCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    # Validate station exists and has available slots
    station = db.query(models.Station).filter(models.Station.id == data.station_id).first()
    if not station:
        raise HTTPException(status_code=404, detail="Station not found")
    if station.available_slots <= 0:
        raise HTTPException(status_code=400, detail="No available slots at this station")
    if data.slot_number > station.total_slots:
        raise HTTPException(status_code=400, detail="Invalid slot number")
    if data.start_time >= data.end_time:
        raise HTTPException(status_code=400, detail="End time must be after start time")

    # Check for conflicting bookings on the same slot
    conflict = db.query(models.Booking).filter(
        models.Booking.station_id == data.station_id,
        models.Booking.slot_number == data.slot_number,
        models.Booking.status == "confirmed",
        models.Booking.start_time < data.end_time,
        models.Booking.end_time > data.start_time,
    ).first()
    if conflict:
        raise HTTPException(status_code=400, detail="This slot is already booked for the selected time")

    booking = models.Booking(
        user_id=current_user.id,
        station_id=data.station_id,
        slot_number=data.slot_number,
        start_time=data.start_time,
        end_time=data.end_time,
        vehicle_number=data.vehicle_number,
        status="confirmed",
    )
    db.add(booking)

    # Decrease available slots
    station.available_slots = max(0, station.available_slots - 1)
    db.commit()
    db.refresh(booking)

    # Broadcast real-time update
    await manager.broadcast_station_update({
        "id": station.id,
        "name": station.name,
        "available_slots": station.available_slots,
        "total_slots": station.total_slots,
        "is_active": station.is_active,
    })

    return booking


@router.get("/my", response_model=list[schemas.BookingOut])
def get_my_bookings(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    bookings = (
        db.query(models.Booking)
        .filter(models.Booking.user_id == current_user.id)
        .order_by(models.Booking.created_at.desc())
        .all()
    )
    # Eagerly load station for each booking
    for b in bookings:
        _ = b.station
    return bookings


@router.delete("/{booking_id}")
async def cancel_booking(
    booking_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    booking = db.query(models.Booking).filter(
        models.Booking.id == booking_id,
        models.Booking.user_id == current_user.id,
    ).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking.status != "confirmed":
        raise HTTPException(status_code=400, detail="Only confirmed bookings can be cancelled")

    booking.status = "cancelled"

    # Restore available slot
    station = db.query(models.Station).filter(models.Station.id == booking.station_id).first()
    if station:
        station.available_slots = min(station.total_slots, station.available_slots + 1)

    db.commit()

    if station:
        await manager.broadcast_station_update({
            "id": station.id,
            "name": station.name,
            "available_slots": station.available_slots,
            "total_slots": station.total_slots,
            "is_active": station.is_active,
        })

    return {"message": "Booking cancelled successfully"}
