"""Stable inference contract for the trained Module 4/5 CatBoost model."""

from __future__ import annotations
from pathlib import Path
from typing import Any, Mapping
import pandas as pd
from catboost import CatBoostClassifier

FUSION_FEATURES = [
    "ai41_prediction", "failure_type", "ai41_confidence",
    "sensor_anomaly_score", "swat_status",
    "ppe_risk_score", "helmet_missing", "vest_missing", "mask_missing",
    "worker_count", "vehicle_count", "machinery_count", "compliance_score",
    "permit_conflict_score", "shift_context_score", "permit_type",
    "permit_active", "maintenance_active", "isolation_verified",
    "workers_in_zone", "supervisor_present", "shift_change_flag",
]
SAFE_MAX_PROBABILITY = 0.30
WARNING_MAX_PROBABILITY = 0.65
CRITICAL_DECISION_THRESHOLD = 0.05


class FusionEngine:
    """Loads the frozen fusion model and scores one complete feature record."""

    def __init__(self, model_path: str | Path | None = None) -> None:
        path = Path(model_path) if model_path else Path(__file__).with_name("engines") / "fusion_model.cbm"
        if not path.is_file():
            raise FileNotFoundError(f"Fusion model not found: {path}")
        self.model = CatBoostClassifier()
        self.model.load_model(str(path))
        self.model_path = path
        if self.model.feature_names_ != FUSION_FEATURES:
            raise ValueError("Saved fusion model feature order does not match the integration contract.")

    @staticmethod
    def validate(features: Mapping[str, Any]) -> dict[str, Any]:
        missing = [name for name in FUSION_FEATURES if name not in features or features[name] is None]
        extra = [name for name in features if name not in FUSION_FEATURES]
        if missing:
            raise ValueError("Missing required fusion inputs: " + ", ".join(missing))
        if extra:
            raise ValueError("Unexpected fusion inputs: " + ", ".join(extra))
        return {name: features[name] for name in FUSION_FEATURES}

    def predict(self, features: Mapping[str, Any]) -> dict[str, Any]:
        record = self.validate(features)
        probability = float(self.model.predict_proba(pd.DataFrame([record]))[0, 1])
        if probability <= SAFE_MAX_PROBABILITY:
            risk_level = "SAFE"
        elif probability <= WARNING_MAX_PROBABILITY:
            risk_level = "WARNING"
        else:
            risk_level = "CRITICAL"
        return {
            "module_name": "Module45_Industrial_Fusion",
            "critical_probability": round(probability, 4),
            "is_critical": int(probability >= CRITICAL_DECISION_THRESHOLD),
            "risk_level": risk_level,
            "decision_threshold": CRITICAL_DECISION_THRESHOLD,
            "model_path": str(self.model_path),
            "features_used": record,
        }
