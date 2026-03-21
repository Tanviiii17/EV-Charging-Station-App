"""Seed script to populate the database with sample stations and an admin user."""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.database import SessionLocal, engine, Base
from app.models import User, Station
from app.auth import hash_password

Base.metadata.create_all(bind=engine)
db = SessionLocal()

# ── Seed Admin ────────────────────────────────────────────────────────────────

if not db.query(User).filter(User.email == "admin@evcharge.com").first():
    admin = User(
        name="Admin",
        email="admin@evcharge.com",
        mobile="9876543210",
        hashed_password=hash_password("admin123"),
        role="admin",
    )
    db.add(admin)
    print("✅ Admin user created (admin@evcharge.com / admin123)")

# ── Seed Stations ─────────────────────────────────────────────────────────────

STATIONS = [
    {
        "name": "PowerGrid EV Hub — Connaught Place",
        "location": "New Delhi",
        "area": "Connaught Place",
        "latitude": 28.6315,
        "longitude": 77.2167,
        "total_slots": 8,
        "capacity_kw": 100.0,
        "connector_type": "CCS2",
        "price_per_kwh": 14.0,
        "rating": 4.7,
        "image_url": "",
    },
    {
        "name": "Tata EV Station — Bandra",
        "location": "Mumbai",
        "area": "Bandra West",
        "latitude": 19.0600,
        "longitude": 72.8362,
        "total_slots": 6,
        "capacity_kw": 50.0,
        "connector_type": "CCS2",
        "price_per_kwh": 12.0,
        "rating": 4.5,
        "image_url": "",
    },
    {
        "name": "BESCOM Charge Point — Koramangala",
        "location": "Bangalore",
        "area": "Koramangala",
        "latitude": 12.9352,
        "longitude": 77.6245,
        "total_slots": 10,
        "capacity_kw": 150.0,
        "connector_type": "CHAdeMO",
        "price_per_kwh": 10.0,
        "rating": 4.8,
        "image_url": "",
    },
    {
        "name": "ChargeZone — Hitech City",
        "location": "Hyderabad",
        "area": "Hitech City",
        "latitude": 17.4435,
        "longitude": 78.3772,
        "total_slots": 5,
        "capacity_kw": 60.0,
        "connector_type": "Type2",
        "price_per_kwh": 11.5,
        "rating": 4.3,
        "image_url": "",
    },
    {
        "name": "EESL Station — Anna Nagar",
        "location": "Chennai",
        "area": "Anna Nagar",
        "latitude": 13.0850,
        "longitude": 80.2101,
        "total_slots": 4,
        "capacity_kw": 50.0,
        "connector_type": "CCS2",
        "price_per_kwh": 13.0,
        "rating": 4.1,
        "image_url": "",
    },
    {
        "name": "Ather Grid — Salt Lake",
        "location": "Kolkata",
        "area": "Salt Lake City",
        "latitude": 22.5809,
        "longitude": 88.4186,
        "total_slots": 6,
        "capacity_kw": 22.0,
        "connector_type": "Type2",
        "price_per_kwh": 9.0,
        "rating": 4.4,
        "image_url": "",
    },
    {
        "name": "Fortum Charge — Sector 62",
        "location": "Noida",
        "area": "Sector 62",
        "latitude": 28.6273,
        "longitude": 77.3654,
        "total_slots": 12,
        "capacity_kw": 200.0,
        "connector_type": "CCS2",
        "price_per_kwh": 15.0,
        "rating": 4.9,
        "image_url": "",
    },
    {
        "name": "CESC Green Station — Alipore",
        "location": "Kolkata",
        "area": "Alipore",
        "latitude": 22.5324,
        "longitude": 88.3333,
        "total_slots": 3,
        "capacity_kw": 30.0,
        "connector_type": "Type2",
        "price_per_kwh": 8.5,
        "rating": 3.9,
        "image_url": "",
    },
]

existing_count = db.query(Station).count()
if existing_count == 0:
    for s_data in STATIONS:
        station = Station(**s_data, available_slots=s_data["total_slots"])
        db.add(station)
    print(f"✅ {len(STATIONS)} stations seeded")
else:
    print(f"ℹ️  {existing_count} stations already exist, skipping seed")

db.commit()
db.close()
print("🎉 Database seeding complete!")
