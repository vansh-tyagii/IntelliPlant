"""Fusion Agent - thin wrapper around the frozen, trained CatBoost fusion
model (module45/fusion_inference.py). Never retrains or modifies the model.

Per-instance SHAP attribution reuses the same `shap` library already used
in module45/train_fusion.py (which only produced one static global summary
plot at training time). Running shap.TreeExplainer against the same frozen
.cbm file at inference time is a real computation on the real model - not a
fabricated importance score.
"""
from __future__ import annotations

from typing import Any, Mapping

import pandas as pd
import shap

from core.config import PROJECT_ROOT, FUSION_MODEL_PATH  # noqa: F401
from core.logger import get_logger

from module45.fusion_inference import FusionEngine, FUSION_FEATURES

LOGGER = get_logger("agent.fusion")

_engine: FusionEngine | None = None
_explainer = None

# Presentation-only mapping for SHAP attributions.  The frozen model still
# receives and scores its original 22-feature contract unchanged.
EXPLANATION_GROUPS = {
    "Machine Intelligence": {"ai41_prediction", "failure_type", "ai41_confidence"},
    "SCADA Intelligence": {"sensor_anomaly_score", "swat_status"},
    "PPE Intelligence": {
        "ppe_risk_score", "helmet_missing", "vest_missing", "mask_missing",
        "worker_count", "vehicle_count", "machinery_count", "compliance_score",
    },
    "Operational Context": {
        "permit_conflict_score", "shift_context_score", "permit_type",
        "permit_active", "maintenance_active", "isolation_verified",
        "workers_in_zone", "supervisor_present", "shift_change_flag",
    },
}


def _get_engine() -> FusionEngine:
    global _engine
    if _engine is None:
        LOGGER.info("Loading frozen CatBoost fusion model from %s", FUSION_MODEL_PATH)
        _engine = FusionEngine(model_path=FUSION_MODEL_PATH)
    return _engine


def _get_explainer():
    global _explainer
    if _explainer is None:
        _explainer = shap.TreeExplainer(_get_engine().model)
    return _explainer


class FusionAgent:
    name = "fusion"

    def run(self, features: Mapping[str, Any], explain: bool = True) -> dict[str, Any]:
        engine = _get_engine()
        result = engine.predict(features)
        compound_risk = round(result["critical_probability"] * 100, 1)

        response: dict[str, Any] = {
            "agent": "fusion",
            "status": result["risk_level"].lower(),
            "compound_risk": compound_risk,
            "critical_probability": result["critical_probability"],
            "is_critical": bool(result["is_critical"]),
            "raw": result,
        }
        if explain:
            response["top_contributors"] = self._explain(result["features_used"])
        return response

    @staticmethod
    def _explain(features: Mapping[str, Any], top_n: int = 4) -> list[dict[str, Any]]:
        explainer = _get_explainer()
        record = pd.DataFrame([{name: features[name] for name in FUSION_FEATURES}])
        shap_values = explainer.shap_values(record)

        # shap.TreeExplainer output shape varies across shap/catboost
        # versions for binary classifiers - handle both the "list of two
        # class arrays" and the "single positive-class array" cases rather
        # than assuming one and silently mis-attributing.
        if isinstance(shap_values, list):
            row = shap_values[-1][0]
        else:
            row = shap_values[0]
            if hasattr(row, "ndim") and row.ndim == 2:
                row = row[:, -1]

        grouped_values = {
            group: sum(float(row[FUSION_FEATURES.index(feature)]) for feature in group_features)
            for group, group_features in EXPLANATION_GROUPS.items()
        }
        pairs = sorted(grouped_values.items(), key=lambda item: abs(item[1]), reverse=True)[:top_n]
        return [
            {
                "feature": name,
                "value": "aggregated SHAP attribution",
                "shap_contribution": round(float(value), 4),
                "direction": "increases_risk" if value > 0 else "decreases_risk",
            }
            for name, value in pairs
        ]
