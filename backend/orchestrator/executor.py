"""Executor - runs a Plan produced by the Planner against real request data.

This is the only place that knows how to translate each agent's standard
output into the frozen fusion model's exact 22-key feature contract
(module45.fusion_inference.FUSION_FEATURES). If an upstream agent didn't
run and isn't cached, Fusion/Incident are skipped rather than fed
placeholder numbers.
"""
from __future__ import annotations

from typing import Any, Mapping, Optional

from orchestrator.planner import Plan
from orchestrator.router import get_agent
from orchestrator.memory import MEMORY
from core.logger import get_logger

LOGGER = get_logger("orchestrator.executor")


class Executor:
    def run(self, plan: Plan, payload: Mapping[str, Any]) -> dict[str, Any]:
        zone = payload.get("zone", "default")
        results: dict[str, Any] = {}

        for agent_name in plan.ordered_agents():
            if plan.use_cache.get(agent_name):
                cached = MEMORY.get(zone, agent_name)
                if cached is not None:
                    LOGGER.info("Reusing cached %s result for zone %s.", agent_name, zone)
                    results[agent_name] = cached
                    continue
                LOGGER.warning("No cached %s result for zone %s; running it fresh instead.", agent_name, zone)

            result = self._run_agent(agent_name, zone, payload, results)
            if result is not None:
                results[agent_name] = result
                MEMORY.update(zone, agent_name, result)

        return {"zone": zone, "plan": {"agents": plan.agents, "reasoning": plan.reasoning}, "results": results}

    def _run_agent(
        self, name: str, zone: str, payload: Mapping[str, Any], results: dict[str, Any]
    ) -> Optional[dict[str, Any]]:
        agent = get_agent(name)

        if name == "swat":
            swat_input = payload.get("swat") or {}
            if swat_input.get("history"):
                return agent.run_batch(swat_input["history"], zone=zone)
            if swat_input.get("reading"):
                return agent.update_stream(swat_input["reading"], zone=zone)
            LOGGER.warning("SWaT requested but no reading/history supplied; skipping.")
            return None

        if name == "ai4i":
            ai4i_input = payload.get("ai4i")
            if not ai4i_input:
                LOGGER.warning("AI4I requested but no input supplied; skipping.")
                return None
            return agent.run(**ai4i_input)

        if name == "ppe":
            ppe_input = payload.get("ppe") or {}
            if ppe_input.get("report"):
                return agent.run_from_report(ppe_input["report"])
            if ppe_input.get("frame") is not None:
                return agent.run_from_frame(ppe_input["frame"])
            LOGGER.warning("PPE requested but no report/frame supplied; skipping.")
            return None

        if name == "permit":
            permit_input = dict(payload.get("permit") or {})
            context = dict(permit_input.get("context") or {})
            # The live sensor score is an input to the permit rule engine,
            # not a replacement for permit data. Prefer an explicitly sent
            # UI value, otherwise carry the fresh SWaT score from this run.
            if context.get("sensor_anomaly_score") is None and results.get("swat"):
                context["sensor_anomaly_score"] = results["swat"].get("anomaly_probability") or 0.0
            return agent.run(
                permits=permit_input.get("permits", []),
                context=context,
            )

        if name == "shift":
            shift_input = payload.get("shift") or {}
            return agent.run(shift_input)

        if name == "fusion":
            features = self._assemble_fusion_features(zone, results)
            if features is None:
                missing = self._missing_fusion_modules(zone, results)
                raise ValueError(f"Fusion requires completed module outputs: {', '.join(missing)}")
            return agent.run(features)

        if name == "compliance":
            question = payload.get("query") or "Summarise the current safety risk and required actions."
            fusion_context = results.get("fusion") or MEMORY.get(zone, "fusion")
            return agent.run(question=question, fusion_context=fusion_context)

        if name == "incident":
            fusion_result = results.get("fusion") or MEMORY.get(zone, "fusion")
            if fusion_result is None:
                LOGGER.warning("Incident requested but no fusion result is available yet; skipping.")
                return None
            return agent.generate(
                zone=zone,
                fusion=fusion_result,
                swat=results.get("swat") or MEMORY.get(zone, "swat"),
                ai4i=results.get("ai4i") or MEMORY.get(zone, "ai4i"),
                ppe=results.get("ppe") or MEMORY.get(zone, "ppe"),
                permit=results.get("permit") or MEMORY.get(zone, "permit"),
                shift=results.get("shift") or MEMORY.get(zone, "shift"),
            )

        raise ValueError(f"Executor has no handler for agent '{name}'.")

    @staticmethod
    def _missing_fusion_modules(zone: str, results: dict[str, Any]) -> list[str]:
        required = ("ai4i", "swat", "ppe", "permit", "shift")
        return [name for name in required if not (results.get(name) or MEMORY.get(zone, name))]

    @staticmethod
    def _assemble_fusion_features(zone: str, results: dict[str, Any]) -> Optional[dict[str, Any]]:
        ai4i = results.get("ai4i") or MEMORY.get(zone, "ai4i")
        swat = results.get("swat") or MEMORY.get(zone, "swat")
        ppe = results.get("ppe") or MEMORY.get(zone, "ppe")
        permit = results.get("permit") or MEMORY.get(zone, "permit")
        shift = results.get("shift") or MEMORY.get(zone, "shift")

        if not all([ai4i, swat, ppe, permit, shift]):
            return None
        if swat.get("status") == "warming_up":
            return None

        return {
            "ai41_prediction": ai4i["prediction"],
            "failure_type": ai4i["failure_type"],
            "ai41_confidence": ai4i["confidence"],
            "sensor_anomaly_score": swat["anomaly_probability"],
            "swat_status": swat["raw"]["status"],
            **ppe["fusion_features"],
            **permit["fusion_features"],
            **shift["fusion_features"],
        }
