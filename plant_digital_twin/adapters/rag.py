"""Adapter around the existing RAG bridge. It never alters RAG behaviour."""
from __future__ import annotations

from typing import Any


class RagAdapter:
    def recommend(self, zone: dict[str, Any]) -> str | None:
        try:
            from backend.rag.rag_bridge import query_compliance
        except ImportError:
            try:
                from rag.rag_bridge import query_compliance
            except ImportError:
                return None
        fusion = {"status": zone.get("fusion_status"), "compound_risk": zone.get("risk_level")}
        result: dict[str, Any] = query_compliance(
            f"Provide a concise safety action for {zone['zone_name']} with {zone['risk_level']} risk.", fusion
        )
        return result.get("answer")
