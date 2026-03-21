"""SQLAlchemy ORM models for the EV Charging Station application."""

from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from .database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    mobile = Column(String(20))
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(20), default="user")  # "user" or "admin"
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    bookings = relationship("Booking", back_populates="user", cascade="all, delete-orphan")


class Station(Base):
    __tablename__ = "stations"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    location = Column(String(200), nullable=False)
    area = Column(String(200), nullable=False)
    latitude = Column(Float, default=0.0)
    longitude = Column(Float, default=0.0)
    total_slots = Column(Integer, default=4)
    available_slots = Column(Integer, default=4)
    capacity_kw = Column(Float, default=50.0)
    connector_type = Column(String(50), default="CCS2")
    price_per_kwh = Column(Float, default=12.0)
    rating = Column(Float, default=4.0)
    is_active = Column(Boolean, default=True)
    image_url = Column(Text, default="")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    bookings = relationship("Booking", back_populates="station", cascade="all, delete-orphan")


class Booking(Base):
    __tablename__ = "bookings"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    station_id = Column(Integer, ForeignKey("stations.id"), nullable=False)
    slot_number = Column(Integer, nullable=False)
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=False)
    status = Column(String(20), default="confirmed")  # confirmed, completed, cancelled
    vehicle_number = Column(String(20), default="")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="bookings")
    station = relationship("Station", back_populates="bookings")
