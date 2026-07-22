"""Agent registry. Maps an agent name string to a singleton agent instance.

Kept deliberately dumb - the Planner decides *which* agents to call, the
Executor decides *how* to call them with real inputs, this module only
answers "give me the object for agent X".
"""
from __future__ import annotations

from agents.swat_agent import SwatAgent
from agents.ai4i_agent import Ai4iAgent
from agents.ppe_agent import PpeAgent
from agents.permit_agent import PermitAgent
from agents.shift_agent import ShiftAgent
from agents.fusion_agent import FusionAgent
from agents.compliance_agent import ComplianceAgent
from agents.incident_agent import IncidentAgent

ALLOWED_AGENTS = {"swat", "ai4i", "ppe", "permit", "shift", "fusion", "compliance", "incident"}

_BUILDERS = {
    "swat": SwatAgent,
    "ai4i": Ai4iAgent,
    "ppe": PpeAgent,
    "permit": PermitAgent,
    "shift": ShiftAgent,
    "fusion": FusionAgent,
    "compliance": ComplianceAgent,
    "incident": IncidentAgent,
}

_REGISTRY: dict[str, object] = {}


def get_agent(name: str):
    if name not in ALLOWED_AGENTS:
        raise ValueError(f"Unknown agent '{name}'. Allowed: {sorted(ALLOWED_AGENTS)}")
    if name not in _REGISTRY:
        _REGISTRY[name] = _BUILDERS[name]()
    return _REGISTRY[name]
