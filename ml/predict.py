"""Load the trained model and expose a prediction function."""

import os
import joblib
import numpy as np

MODEL_PATH = os.path.join(os.path.dirname(__file__), "model", "wait_time_model.joblib")

_model = None


def _load_model():
    global _model
    if _model is None:
        if not os.path.exists(MODEL_PATH):
            raise FileNotFoundError(
                "Model not found. Run: python generate_dataset.py && python train_model.py"
            )
        _model = joblib.load(MODEL_PATH)
    return _model


def predict_wait_time(
    hour: int,
    day_of_week: int,
    station_capacity: int,
    active_chargers: int,
    queue_length: int,
) -> dict:
    """Predict wait time in minutes for given conditions.

    Returns: {"predicted_wait_minutes": float}
    """
    model = _load_model()

    is_weekend = 1 if day_of_week >= 5 else 0
    is_peak = 1 if hour in range(8, 11) or hour in range(17, 21) else 0

    features = np.array([[
        hour,
        day_of_week,
        is_weekend,
        is_peak,
        station_capacity,
        active_chargers,
        queue_length,
    ]])

    prediction = model.predict(features)[0]
    return {"predicted_wait_minutes": round(max(0, prediction), 1)}
