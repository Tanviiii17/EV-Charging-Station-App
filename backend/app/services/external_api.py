"""External EV station data service — fetches real-world data from OpenChargeMap."""

import logging
import random
from typing import Any

import httpx

from ..config import get_settings

logger = logging.getLogger(__name__)

OCM_URL = "https://api.openchargemap.io/v3/poi/"

# Connector type mapping from OCM PowerType/ConnectionType IDs → internal names
_CONNECTOR_MAP: dict[str, str] = {
    "CCS (Type 2)": "CCS2",
    "CCS (Type 1)": "CCS2",
    "CHAdeMO": "CHAdeMO",
    "Type 2 (Mennekes)": "Type2",
    "Type 2 (Socket Only)": "Type2",
    "Type 1 (J1772)": "Type2",
    "IEC 62196-2 Type 2": "Type2",
    "Tesla (Model S/X)": "CCS2",
}


def _map_connector(connection_list: list[dict]) -> str:
    """Return a normalised connector type from OCM connection list."""
    for conn in connection_list:
        ct = conn.get("ConnectionType", {})
        title = ct.get("FormalName", "") or ct.get("Title", "")
        if title in _CONNECTOR_MAP:
            return _CONNECTOR_MAP[title]
        # Fallback keyword match
        if "CCS" in title or "Combo" in title:
            return "CCS2"
        if "CHAdeMO" in title:
            return "CHAdeMO"
        if "Type 2" in title or "Mennekes" in title or "62196" in title:
            return "Type2"
    return "CCS2"  # default


def _extract_power_kw(connection_list: list[dict]) -> float:
    """Return max power (kW) from connection list or default 50 kW."""
    powers = []
    for conn in connection_list:
        kw = conn.get("PowerKW")
        if kw and isinstance(kw, (int, float)) and kw > 0:
            powers.append(float(kw))
    return round(max(powers), 1) if powers else 50.0


def normalize_station(raw: dict) -> dict:
    """Normalise a raw OCM station dict into the internal station format."""
    addr = raw.get("AddressInfo", {})
    connections = raw.get("Connections") or []

    name = addr.get("Title") or "Unknown Station"
    lat = addr.get("Latitude") or 0.0
    lng = addr.get("Longitude") or 0.0
    location = addr.get("Town") or addr.get("StateOrProvince") or "India"
    area = addr.get("StateOrProvince") or addr.get("Town") or "India"

    capacity_kw = _extract_power_kw(connections)
    connector_type = _map_connector(connections)

    # Number of usable chargers
    num_points = raw.get("NumberOfPoints") or random.randint(2, 8)
    total_slots = min(int(num_points), 20) if num_points else random.randint(2, 8)

    # Simulate dynamic fields (OCM doesn't provide real-time availability)
    available_slots = random.randint(0, total_slots)
    price_per_kwh = round(random.uniform(8.0, 18.0), 2)
    rating = round(random.uniform(3.5, 5.0), 1)

    return {
        # Use a large negative ID prefix to avoid conflicts with local DB IDs
        "id": -abs(hash(str(raw.get("ID", name)))) % 1_000_000 or -random.randint(1, 999999),
        "name": name,
        "location": location,
        "area": area,
        "latitude": float(lat),
        "longitude": float(lng),
        "total_slots": total_slots,
        "available_slots": available_slots,
        "capacity_kw": capacity_kw,
        "connector_type": connector_type,
        "price_per_kwh": price_per_kwh,
        "rating": rating,
        "is_active": True,
        "image_url": "",
        "created_at": "2024-01-01T00:00:00",
        "source": "external",
    }


async def fetch_external_stations(max_results: int = 20) -> list[dict[str, Any]]:
    """Fetch stations from OpenChargeMap API and return normalised list.

    Falls back to an empty list if the API is unavailable or the key is missing.
    """
    settings = get_settings()
    api_key = settings.OPENCHARGEMAP_API_KEY

    if not api_key or api_key == "your_api_key_here":
        logger.warning(
            "OPENCHARGEMAP_API_KEY not set — external stations unavailable. "
            "Add your key to backend/.env to enable real-world data."
        )
        return []

    params = {
        "output": "json",
        "countrycode": "IN",
        "maxresults": max_results,
        "compact": True,
        "verbose": False,
        "key": api_key,
    }

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(OCM_URL, params=params)
            response.raise_for_status()
            raw_list = response.json()

        stations = []
        for raw in raw_list:
            try:
                station = normalize_station(raw)
                # Only include stations with valid coordinates
                if station["latitude"] != 0.0 and station["longitude"] != 0.0:
                    stations.append(station)
            except Exception as exc:
                logger.debug("Skipping malformed OCM station: %s", exc)
                continue

        logger.info("Fetched %d external stations from OpenChargeMap", len(stations))
        return stations

    except httpx.HTTPStatusError as exc:
        logger.warning("OpenChargeMap API returned HTTP %s — using local data only", exc.response.status_code)
    except httpx.RequestError as exc:
        logger.warning("OpenChargeMap API unreachable (%s) — using local data only", exc)
    except Exception as exc:
        logger.warning("Unexpected error fetching external stations: %s", exc)

    return []
