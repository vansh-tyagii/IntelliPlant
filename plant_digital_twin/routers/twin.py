from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request
from ..schemas.requests import ScenarioLoadRequest, ZoneUpdateRequest

router = APIRouter(prefix="/api/v1", tags=["plant-digital-twin"])

def service(request: Request): return request.app.state.twin

@router.get("/zones")
def zones(request: Request): return {"zones": service(request).list_zones()}

@router.get("/zones/timeline")
def all_timelines(request: Request):
    return {"timelines": {zone["zone_id"]: zone["timeline"] for zone in service(request).list_zones()}}

@router.get("/zones/{zone_id}")
def zone(zone_id: str, request: Request):
    result = service(request).zone(zone_id)
    if result is None: raise HTTPException(404, "Unknown zone")
    return result

@router.post("/zones/update")
def update(body: ZoneUpdateRequest, request: Request):
    try: return service(request).update(**body.model_dump())
    except KeyError as exc: raise HTTPException(404, f"No configured zone for '{exc.args[0]}'") from exc

@router.get("/zones/{zone_id}/timeline")
def timeline(zone_id: str, request: Request):
    zone = service(request).zone(zone_id)
    if zone is None: raise HTTPException(404, "Unknown zone")
    return {"zone_id": zone_id, "timeline": zone["timeline"]}

@router.get("/incidents")
def incidents(request: Request): return {"incidents": service(request).incidents.list()}

@router.get("/incidents/{incident_id}")
def incident(incident_id: str, request: Request):
    result = service(request).incidents.get(incident_id)
    if result is None: raise HTTPException(404, "Unknown incident")
    return result

@router.post("/scenario/load")
def scenario_load(body: ScenarioLoadRequest, request: Request):
    try: return service(request).load_scenario(**body.model_dump())
    except KeyError: raise HTTPException(404, "Unknown scenario")

@router.post("/scenario/reset")
def scenario_reset(request: Request): service(request).reset(); return {"status": "reset"}

@router.post("/runtime/sync/{runtime_zone}")
def runtime_sync(runtime_zone: str, request: Request, request_recommendation: bool = False):
    return {"runtime_zone": runtime_zone, "updates": service(request).sync_runtime(runtime_zone, request_recommendation)}

@router.get("/plant/status")
def plant_status(request: Request): return {"status": "ready", **service(request).summary()}

@router.get("/plant/summary")
def plant_summary(request: Request): return service(request).summary()
