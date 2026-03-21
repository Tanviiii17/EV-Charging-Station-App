"""Pydantic schemas for request/response validation."""

from pydantic import BaseModel, EmailStr, Field
from datetime import datetime
from typing import Optional


# ── Auth Schemas ──────────────────────────────────────────────────────────────

class UserRegister(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    email: str = Field(..., min_length=5, max_length=255)
    mobile: str = Field("", max_length=20)
    password: str = Field(..., min_length=4, max_length=128)


class UserLogin(BaseModel):
    email: str
    password: str


class UserOut(BaseModel):
    id: int
    name: str
    email: str
    mobile: str
    role: str
    created_at: datetime

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# ── Station Schemas ───────────────────────────────────────────────────────────

class StationCreate(BaseModel):
    name: str = Field(..., min_length=2)
    location: str
    area: str
    latitude: float = 0.0
    longitude: float = 0.0
    total_slots: int = Field(4, ge=1, le=100)
    capacity_kw: float = Field(50.0, gt=0)
    connector_type: str = "CCS2"
    price_per_kwh: float = Field(12.0, gt=0)
    image_url: str = ""


class StationOut(BaseModel):
    id: int
    name: str
    location: str
    area: str
    latitude: float
    longitude: float
    total_slots: int
    available_slots: int
    capacity_kw: float
    connector_type: str
    price_per_kwh: float
    rating: float
    is_active: bool
    image_url: str
    created_at: datetime
    source: str = "local"

    class Config:
        from_attributes = True


class ExternalStationOut(StationOut):
    """Station data sourced from OpenChargeMap — availability/price are simulated."""
    source: str = "external"


class StationUpdate(BaseModel):
    name: Optional[str] = None
    location: Optional[str] = None
    area: Optional[str] = None
    total_slots: Optional[int] = None
    available_slots: Optional[int] = None
    is_active: Optional[bool] = None
    price_per_kwh: Optional[float] = None


# ── Booking Schemas ───────────────────────────────────────────────────────────

class BookingCreate(BaseModel):
    station_id: int
    slot_number: int = Field(..., ge=1)
    start_time: datetime
    end_time: datetime
    vehicle_number: str = ""


class BookingOut(BaseModel):
    id: int
    user_id: int
    station_id: int
    slot_number: int
    start_time: datetime
    end_time: datetime
    status: str
    vehicle_number: str
    created_at: datetime
    station: Optional[StationOut] = None

    class Config:
        from_attributes = True


# ── Prediction Schemas ────────────────────────────────────────────────────────

class WaitTimePredictionRequest(BaseModel):
    station_id: int
    hour: int = Field(..., ge=0, le=23)
    day_of_week: int = Field(..., ge=0, le=6)


class WaitTimePredictionResponse(BaseModel):
    station_name: str
    predicted_wait_minutes: float
    confidence: str
    recommendations: list[str]


# ── Recommendation Schemas ────────────────────────────────────────────────────

class RecommendedStation(BaseModel):
    station: StationOut
    score: float
    predicted_wait_minutes: float
    score_breakdown: dict[str, float]
    reason: str

    class Config:
        from_attributes = True


class RecommendationResponse(BaseModel):
    best: RecommendedStation
    ranked: list[RecommendedStation]
