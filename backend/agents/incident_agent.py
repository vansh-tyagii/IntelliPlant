"""Incident Agent - generates a structured, regulator-facing incident
report from whatever agent outputs are available (fresh or from memory).

Reuses the Compliance Agent internally for "which regulations were
violated" and "what are the emergency actions" instead of duplicating any
RAG logic here.
"""
from __future__ import annotations

import json
import re
import uuid
from datetime import datetime, timezone
from typing import Any, Mapping, Optional

from core.config import INCIDENT_STORE_DIR
from core.logger import get_logger

from agents.compliance_agent import ComplianceAgent

LOGGER = get_logger("agent.incident")

_LABEL_RE = re.compile(r"^\*\*(.+?):\*\*\s*(.*)$")


class IncidentAgent:
    name = "incident"

    def __init__(self) -> None:
        self._compliance = ComplianceAgent()

    def generate(
        self,
        *,
        zone: str,
        fusion: Mapping[str, Any],
        swat: Optional[Mapping[str, Any]] = None,
        ai4i: Optional[Mapping[str, Any]] = None,
        ppe: Optional[Mapping[str, Any]] = None,
        permit: Optional[Mapping[str, Any]] = None,
        shift: Optional[Mapping[str, Any]] = None,
        fetch_compliance: bool = True,
    ) -> dict[str, Any]:
        incident_id = f"INC-{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')}-{uuid.uuid4().hex[:6].upper()}"
        risk_level = str(fusion.get("status", "unknown")).upper()
        top_contributors = fusion.get("top_contributors", [])
        root_cause = self._root_cause(top_contributors, swat, ai4i, ppe, permit, shift)

        compliance_answer = None
        violated_regulations: list[str] = []
        emergency_actions: list[str] = []
        if fetch_compliance:
            question = (
                f"A compound risk event was flagged in {zone} with root cause: {root_cause}. "
                "Which specific regulations were violated, and what are the immediate "
                "emergency response actions and worker instructions?"
            )
            try:
                compliance = self._compliance.run(question=question, fusion_context=fusion)
                compliance_answer = compliance.get("answer")
                violated_regulations, emergency_actions = self._parse_compliance(compliance_answer)
            except Exception as exc:  # noqa: BLE001
                LOGGER.exception("Compliance lookup failed while generating incident %s", zone)
                compliance_answer = None
                violated_regulations, emergency_actions = [], []

        report = {
            "incident_id": incident_id,
            "timestamp_utc": datetime.now(timezone.utc).isoformat(),
            "zone": zone,
            "risk_level": risk_level,
            "confidence": fusion.get("critical_probability"),
            "compound_risk_score": fusion.get("compound_risk"),
            "gas_status": (swat or {}).get("status"),
            "machine_status": (ai4i or {}).get("failure_type") if ai4i else None,
            "permit": (permit or {}).get("raw"),
            "workers": (ppe or {}).get("workers"),
            "root_cause": root_cause,
            "top_contributors": top_contributors,
            "violated_regulations": violated_regulations,
            "emergency_actions": emergency_actions,
            "compliance_answer": compliance_answer,
        }
        self._persist(report)
        return report

    @staticmethod
    def _root_cause(
        top_contributors: list[Mapping[str, Any]],
        swat: Optional[Mapping[str, Any]],
        ai4i: Optional[Mapping[str, Any]],
        ppe: Optional[Mapping[str, Any]],
        permit: Optional[Mapping[str, Any]],
        shift: Optional[Mapping[str, Any]],
    ) -> str:
        if top_contributors:
            top = top_contributors[0]
            return f"{top['feature']} = {top['value']} was the dominant driver of the compound risk score."

        parts = []
        if swat and swat.get("status") == "critical":
            parts.append("gas/sensor anomaly")
        if ai4i and ai4i.get("status") in ("warning", "critical"):
            parts.append(f"predicted {ai4i.get('failure_type')}")
        if ppe and ppe.get("violations"):
            parts.append("PPE non-compliance")
        if permit and permit.get("status") in ("warning", "critical"):
            parts.append("permit conflict")
        if shift and shift.get("status") in ("warning", "critical"):
            parts.append("shift/supervision gap")
        return "; ".join(parts) or "Not enough agent output to isolate a single root cause."

    @staticmethod
    def _parse_compliance(answer: Optional[str]) -> tuple[list[str], list[str]]:
        """Parse the frozen RAG's own fixed output format:

            **Regulation Cited:** ...
            **Explanation:** ...
            **Recommended Action:** ...

        This relies on rag_agent.py's existing prompt_template, which is
        never modified - so this parsing stays valid as long as that
        template is unchanged.
        """
        if not answer:
            return [], []
        regulations: list[str] = []
        actions: list[str] = []
        for line in answer.splitlines():
            match = _LABEL_RE.match(line.strip())
            if not match:
                continue
            label, value = match.group(1).strip().lower(), match.group(2).strip()
            if not value:
                continue
            if label.startswith("regulation"):
                regulations.append(value)
            elif label.startswith("recommended action"):
                actions.append(value)
        return regulations, actions

    @staticmethod
    def _persist(report: Mapping[str, Any]) -> None:
        path = INCIDENT_STORE_DIR / f"{report['incident_id']}.json"
        with open(path, "w", encoding="utf-8") as handle:
            json.dump(report, handle, indent=2, default=str)
        LOGGER.info("Persisted incident report to %s", path)

    @staticmethod
    def list_recent(limit: int = 20) -> list[dict[str, Any]]:
        files = sorted(INCIDENT_STORE_DIR.glob("INC-*.json"), reverse=True)[:limit]
        reports = []
        for file in files:
            with open(file, "r", encoding="utf-8") as handle:
                reports.append(json.load(handle))
        return reports
