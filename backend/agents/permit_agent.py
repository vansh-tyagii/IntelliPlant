"""Permit Agent - deterministic permit-to-work rule engine.

There is no trained permit model anywhere in the uploaded project. The
fusion engine was trained on synthetic permit-conflict proxies (see
module45/generate_fusion_data.py: permit_conflict is a sigmoid formula, not
a learned relationship from real permit logs). Faking a "Permit Agent" that
pretends to be an ML model would misrepresent the system, so this agent is
an explicit, auditable rule engine instead - real logic, not a fabricated
score.

Output includes a `fusion_features` block whose keys line up 1:1 with the
frozen CatBoost fusion model's feature contract (see
module45/fusion_inference.FUSION_FEATURES), so its output slots directly
into the Fusion Agent without any translation layer.
"""
from __future__ import annotations

from typing import Any, Mapping, Sequence

from core.logger import get_logger

LOGGER = get_logger("agent.permit")

# The frozen fusion model was trained on exactly these four categorical
# permit types. Anything else (e.g. GAS_TESTING) is still evaluated for
# real conflicts below, but is mapped to "NONE" for the fusion feature so
# we never feed the frozen model a category it has never seen trained data
# for.
FUSION_SAFE_PERMIT_TYPES = {"NONE", "ELECTRICAL", "HOT_WORK", "CONFINED_SPACE"}


class PermitAgent:
    name = "permit"

    def run(
        self,
        permits: Sequence[Mapping[str, Any]],
        context: Mapping[str, Any] | None = None,
    ) -> dict[str, Any]:
        context = context or {}
        zone = context.get("zone")
        maintenance_active = bool(context.get("maintenance_active", False))
        sensor_anomaly = float(context.get("sensor_anomaly_score", 0.0) or 0.0)

        relevant = [p for p in permits if zone is None or p.get("zone") == zone]

        if not relevant:
            return {
                "agent": "permit",
                "status": "normal",
                "risk_score": 0.0,
                "reason": "No active permits in scope.",
                "recommendation": "No permit-related action required.",
                "fusion_features": {
                    "permit_type": "NONE",
                    "permit_active": 0,
                    "maintenance_active": int(maintenance_active),
                    "isolation_verified": 0,
                    "permit_conflict_score": 0.0,
                    "workers_in_zone": 0,
                },
                "raw": {"permits": list(permits), "context": dict(context)},
            }

        evaluations = [self._evaluate_permit(p, maintenance_active, sensor_anomaly) for p in relevant]
        dominant = max(evaluations, key=lambda item: item["score"])

        risk_score = round(min(dominant["score"], 100), 1)
        status = "critical" if risk_score >= 70 else "warning" if risk_score >= 30 else "normal"

        all_reasons = [reason for item in evaluations for reason in item["reasons"]]
        workers_in_zone = sum(int(p.get("workers_assigned", 0) or 0) for p in relevant)
        isolation_verified = any(bool(p.get("isolation_verified", False)) for p in relevant)
        fusion_type = dominant["type"] if dominant["type"] in FUSION_SAFE_PERMIT_TYPES else "NONE"

        return {
            "agent": "permit",
            "status": status,
            "risk_score": risk_score,
            "reason": " ".join(all_reasons) if all_reasons else f"{dominant['type']} permit active, no conflicts detected.",
            "recommendation": self._recommendation(status),
            "fusion_features": {
                "permit_type": fusion_type,
                "permit_active": 1,
                "maintenance_active": int(maintenance_active),
                "isolation_verified": int(isolation_verified),
                "permit_conflict_score": round(risk_score / 100, 4),
                "workers_in_zone": workers_in_zone,
            },
            "raw": {"permits": list(permits), "context": dict(context), "evaluations": evaluations},
        }

    @staticmethod
    def _evaluate_permit(
        permit: Mapping[str, Any], maintenance_active: bool, sensor_anomaly: float
    ) -> dict[str, Any]:
        ptype = str(permit.get("type", "NONE")).upper()
        score = 0.0
        reasons: list[str] = []

        if ptype == "HOT_WORK":
            score += 30
            if sensor_anomaly >= 0.5:
                score += 45
                reasons.append(
                    f"Hot work permit {permit.get('permit_id')} is active while the sensor "
                    f"anomaly score is {sensor_anomaly:.2f} - elevated gas/process risk in the same area."
                )
            if not permit.get("gas_test_passed", False):
                score += 20
                reasons.append(f"Hot work permit {permit.get('permit_id')} has no recorded passed gas test.")
        elif ptype == "CONFINED_SPACE":
            score += 25
            if not permit.get("isolation_verified", False):
                score += 35
                reasons.append(f"Confined space entry {permit.get('permit_id')} without verified isolation.")
            if not permit.get("gas_test_passed", False):
                score += 25
                reasons.append(f"Confined space entry {permit.get('permit_id')} without a passed gas test.")
            if not permit.get("supervisor_assigned", False):
                score += 15
                reasons.append(f"Confined space entry {permit.get('permit_id')} has no supervisor assigned.")
        elif ptype == "ELECTRICAL":
            score += 20
            if maintenance_active and not permit.get("isolation_verified", False):
                score += 40
                reasons.append(
                    f"Electrical permit {permit.get('permit_id')} active during maintenance without "
                    "verified lockout/tagout isolation."
                )
        elif ptype == "GAS_TESTING":
            score += 10
            if not permit.get("gas_test_passed", False):
                reasons.append(f"Gas testing permit {permit.get('permit_id')} still pending a passed result.")
        else:
            score += 5

        return {"permit_id": permit.get("permit_id"), "type": ptype, "score": score, "reasons": reasons}

    @staticmethod
    def _recommendation(status: str) -> str:
        if status == "critical":
            return "Stop work under this permit immediately and escalate to the shift supervisor before resuming."
        if status == "warning":
            return "Do not start additional permits in this zone until the flagged conditions are resolved."
        return "Continue standard permit monitoring."
