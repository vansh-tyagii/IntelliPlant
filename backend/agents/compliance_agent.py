"""Compliance Agent - the only caller of rag_bridge.query_compliance().

Per the platform contract: the Planner never calls the RAG directly, it
always goes through this agent, so there is exactly one place that knows
how to compose fusion context into a compliance question.
"""
from __future__ import annotations

from typing import Any, Mapping, Optional

from core.logger import get_logger

from rag.rag_bridge import query_compliance

LOGGER = get_logger("agent.compliance")


class ComplianceAgent:
    name = "compliance"

    def run(self, question: str, fusion_context: Optional[Mapping[str, Any]] = None) -> dict[str, Any]:
        result = query_compliance(question=question, fusion_context=fusion_context)
        return {
            "agent": "compliance",
            "status": "answered" if result.get("answer") else "error",
            "answer": result.get("answer"),
            "sources": result.get("sources", []),
            "context_used": result.get("context_used"),
            "raw": result,
        }
