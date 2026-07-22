"""Copilot - the single chatbot entry point.

handle_message() is the only function the /chat endpoint calls. It runs
Planner -> Executor and then composes a natural-language answer out of
whatever agents actually ran, so the wording always reflects real numbers
from real agent output - never a templated guess.
"""
from __future__ import annotations

from typing import Any, Mapping

from orchestrator.planner import Planner
from orchestrator.executor import Executor
from core.logger import get_logger

LOGGER = get_logger("chat.copilot")


class Copilot:
    def __init__(self) -> None:
        self._planner = Planner()
        self._executor = Executor()

    def handle_message(self, query: str, context: Mapping[str, Any]) -> dict[str, Any]:
        payload = dict(context)
        payload["query"] = query

        plan = self._planner.plan(query)
        execution = self._executor.run(plan, payload)
        answer = self._compose_answer(execution["results"])

        return {
            "query": query,
            "plan": execution["plan"],
            "answer": answer,
            "agent_results": execution["results"],
        }

    @staticmethod
    def _compose_answer(results: Mapping[str, Any]) -> str:
        parts: list[str] = []

        fusion = results.get("fusion")
        if fusion:
            parts.append(f"Compound risk is {fusion['compound_risk']}/100 ({fusion['status'].upper()}).")
            top = fusion.get("top_contributors") or []
            if top:
                driver = top[0]
                parts.append(f"The main driver is {driver['feature']} = {driver['value']}.")

        permit = results.get("permit")
        if permit:
            parts.append(permit["reason"])

        shift = results.get("shift")
        if shift:
            parts.append(shift["reason"])

        compliance = results.get("compliance")
        if compliance and compliance.get("answer"):
            parts.append(compliance["answer"])

        incident = results.get("incident")
        if incident:
            parts.append(f"Incident report {incident['incident_id']} has been generated for {incident['zone']}.")

        if not parts:
            return (
                "I do not have enough live agent output yet to answer that - "
                "run /analyze for this zone first, or include the relevant reading in this request."
            )
        return " ".join(parts)


COPILOT = Copilot()
