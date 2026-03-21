"""Generate synthetic dataset for EV charging station wait-time prediction."""

import pandas as pd
import numpy as np
import os

np.random.seed(42)

N_SAMPLES = 5000

hours = np.random.randint(0, 24, N_SAMPLES)
days = np.random.randint(0, 7, N_SAMPLES)
is_weekend = (days >= 5).astype(int)
is_peak = ((hours >= 8) & (hours <= 10) | (hours >= 17) & (hours <= 20)).astype(int)

station_capacity = np.random.choice([3, 4, 5, 6, 8, 10, 12], N_SAMPLES)

# Active chargers depend on time — more during peak, less at night
base_occupancy = np.random.uniform(0.1, 0.5, N_SAMPLES)
peak_boost = is_peak * np.random.uniform(0.2, 0.5, N_SAMPLES)
weekend_offset = is_weekend * np.random.uniform(-0.1, 0.15, N_SAMPLES)
occupancy_rate = np.clip(base_occupancy + peak_boost + weekend_offset, 0.0, 1.0)

active_chargers = np.round(station_capacity * occupancy_rate).astype(int)
active_chargers = np.clip(active_chargers, 0, station_capacity)

queue_length = np.maximum(0, np.round(
    (occupancy_rate - 0.7) * station_capacity + np.random.normal(0, 1, N_SAMPLES)
)).astype(int)

# Wait time model: depends on queue, occupancy, peak, capacity
wait_time = (
    queue_length * np.random.uniform(6, 12, N_SAMPLES)  # ~6-12 min per person in queue
    + is_peak * np.random.uniform(3, 8, N_SAMPLES)       # peak surcharge
    + (active_chargers / np.maximum(station_capacity, 1)) * np.random.uniform(2, 10, N_SAMPLES)
    + np.random.normal(0, 2, N_SAMPLES)                   # noise
)
wait_time = np.clip(wait_time, 0, 90).round(1)

df = pd.DataFrame({
    "hour": hours,
    "day_of_week": days,
    "is_weekend": is_weekend,
    "is_peak_hour": is_peak,
    "station_capacity": station_capacity,
    "active_chargers": active_chargers,
    "queue_length": queue_length,
    "wait_time_minutes": wait_time,
})

out_dir = os.path.dirname(__file__)
out_path = os.path.join(out_dir, "dataset.csv")
df.to_csv(out_path, index=False)
print(f"✅ Generated {N_SAMPLES} samples → {out_path}")
print(df.describe().round(2))
