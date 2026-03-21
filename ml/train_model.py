"""Train a RandomForestRegressor for wait-time prediction."""

import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, r2_score
import joblib
import os

# ── Load Data ─────────────────────────────────────────────────────────────────

data_path = os.path.join(os.path.dirname(__file__), "dataset.csv")
if not os.path.exists(data_path):
    print("❌ dataset.csv not found. Run generate_dataset.py first.")
    exit(1)

df = pd.read_csv(data_path)

FEATURES = [
    "hour", "day_of_week", "is_weekend", "is_peak_hour",
    "station_capacity", "active_chargers", "queue_length",
]
TARGET = "wait_time_minutes"

X = df[FEATURES]
y = df[TARGET]

# ── Split & Train ─────────────────────────────────────────────────────────────

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

model = RandomForestRegressor(
    n_estimators=100,
    max_depth=12,
    min_samples_split=5,
    random_state=42,
    n_jobs=-1,
)
model.fit(X_train, y_train)

# ── Evaluate ──────────────────────────────────────────────────────────────────

y_pred = model.predict(X_test)
mae = mean_absolute_error(y_test, y_pred)
r2 = r2_score(y_test, y_pred)

print(f"📊 Model Performance:")
print(f"   MAE  : {mae:.2f} minutes")
print(f"   R²   : {r2:.4f}")

# Feature importance
importance = dict(zip(FEATURES, model.feature_importances_))
print(f"\n🔑 Feature Importance:")
for feat, imp in sorted(importance.items(), key=lambda x: -x[1]):
    print(f"   {feat}: {imp:.3f}")

# ── Save Model ────────────────────────────────────────────────────────────────

model_dir = os.path.join(os.path.dirname(__file__), "model")
os.makedirs(model_dir, exist_ok=True)
model_path = os.path.join(model_dir, "wait_time_model.joblib")
joblib.dump(model, model_path)
print(f"\n✅ Model saved → {model_path}")
