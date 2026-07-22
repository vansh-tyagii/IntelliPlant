"""Planner - decides which agents a query actually needs.

This is what makes the platform agentic rather than a fixed sequential
pipeline: given a natural-language question, the Planner picks the
smallest set of agents that can answer it, and marks which of those should
be re-used from memory instead of re-run.

Two layers, in order:
  1. A fast, deterministic rule-set covering the exact query patterns the
     hackathon brief calls out ("why is Zone B critical", "can hot work
     continue", "generate incident report", ...). Fast, free, reliable.
  2. An LLM fallback (reusing the same Groq client the frozen Compliance
     RAG already depends on - no new LLM dependency) for open-ended
     questions the rule-set doesn't recognise. Its output is validated
     against the fixed agent set before it is trusted, so a hallucinated
     agent name can never reach the Executor.
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from typing import Optional

from orchestrator.router import ALLOWED_AGENTS
from core.logger import get_logger

LOGGER = get_logger("orchestrator.planner")

# Fixed dependency order: fusion needs everything upstream of it, compliance
# needs fusion, incident needs both.
DEPENDENCY_ORDER = ["swat", "ai4i", "ppe", "permit", "shift", "fusion", "compliance", "incident"]


@dataclass
class Plan:
    agents: list[str]
    use_cache: dict[str, bool] = field(default_factory=dict)
    reasoning: str = ""

    def ordered_agents(self) -> list[str]:
        return [name for name in DEPENDENCY_ORDER if name in self.agents]


_RULES: list[tuple[re.Pattern, list[str], dict[str, bool], str]] = [
    (
        re.compile(r"\b(analyz|full scan|complete (check|analysis)|overall status)\b", re.I),
        ["swat", "ai4i", "ppe", "permit", "shift", "fusion", "compliance", "incident"],
        {},
        "Full-plant query - every agent must run fresh.",
    ),
    (
        re.compile(r"\bwhy\b.*\bcritical\b|\bwhy is\b.*\brisk\b", re.I),
        ["fusion", "compliance", "incident"],
        {"fusion": True},
        "Root-cause question - reuse the latest cached fusion result instead of re-running sensors.",
    ),
    (
        re.compile(r"\bhot work\b|\bcan .*work continue\b|\bcontinue (work|operations)\b", re.I),
        ["permit", "swat", "fusion", "compliance"],
        {},
        "Permit-safety question - needs live permit status plus current sensor/fusion risk.",
    ),
    (
        re.compile(r"\bincident report\b|\bgenerate (a |the )?report\b", re.I),
        ["incident"],
        {"fusion": True},
        "Direct incident-report request - reuse cached fusion/compliance context.",
    ),
    (
        re.compile(r"\bshap\b|\bwhich (model|agent|factor) contributed\b|\bwhat drove\b", re.I),
        ["fusion"],
        {"fusion": False},
        "Explainability question - re-score fusion so SHAP attribution is available.",
    ),
    (
        re.compile(r"\bproduction continue\b|\bresume production\b", re.I),
        ["permit", "fusion", "compliance"],
        {"fusion": True},
        "Production-continuity question - permit status plus current cached fusion risk.",
    ),
    (
        re.compile(r"\bwhat should workers do\b|\bemergency (procedure|action)\b|\bworkers do\b", re.I),
        ["compliance"],
        {},
        "Worker-guidance question - regulatory/compliance answer only.",
    ),
    (
        re.compile(r"\bregulation\b|\blaw\b|\bviolat", re.I),
        ["compliance"],
        {},
        "Regulatory question - compliance agent only.",
    ),
]


def plan_from_rules(query: str) -> Optional[Plan]:
    for pattern, agents, cache, reason in _RULES:
        if pattern.search(query):
            return Plan(agents=list(agents), use_cache=dict(cache), reasoning=reason)
    return None


def plan_with_llm(query: str) -> Plan:
    """LLM fallback planner for queries the fast rule-set doesn't recognise.

    Reuses langchain_groq.ChatGroq - already a dependency of the frozen
    rag_agent.py - so this introduces no new model provider.
    """
    try:
        from langchain_groq import ChatGroq
    except ImportError as exc:
        raise RuntimeError(
            "langchain_groq is required for the LLM planner fallback (it is "
            "already a dependency of the existing Compliance RAG)."
        ) from exc

    llm = ChatGroq(model_name="llama-3.1-8b-instant", temperature=0.0)
    system = (
        "You are the planner of an industrial safety agent platform. "
        f"Choose only from this exact set of agent names: {sorted(ALLOWED_AGENTS)}. "
        "Return strict JSON only, no prose, in this exact shape: "
        '{"agents": ["..."], "reasoning": "..."}. '
        "Pick the smallest set of agents that actually answers the question. "
        "Never invent agent names outside the given set."
    )
    response = llm.invoke([("system", system), ("human", query)])
    content = response.content if hasattr(response, "content") else str(response)

    try:
        parsed = json.loads(content)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", content, re.S)
        parsed = json.loads(match.group(0)) if match else {"agents": ["compliance"], "reasoning": "fallback"}

    agents = [name for name in parsed.get("agents", []) if name in ALLOWED_AGENTS]
    if not agents:
        agents = ["compliance"]
    return Plan(agents=agents, use_cache={}, reasoning=parsed.get("reasoning", "LLM planner decision."))


class Planner:
    def plan(self, query: str) -> Plan:
        rule_plan = plan_from_rules(query)
        if rule_plan is not None:
            LOGGER.info("Rule-based plan for %r: %s", query, rule_plan.agents)
            return rule_plan

        LOGGER.info("No rule matched %r - falling back to the LLM planner.", query)
        try:
            return plan_with_llm(query)
        except Exception as exc:  # noqa: BLE001
            LOGGER.warning("LLM planner failed (%s); defaulting to compliance-only.", exc)
            return Plan(agents=["compliance"], reasoning="LLM planner unavailable - safe default.")
