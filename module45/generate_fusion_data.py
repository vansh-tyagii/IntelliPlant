"""Generate realistic summarized input data for the CatBoost Fusion Engine."""

from pathlib import Path

import numpy as np
import pandas as pd


RANDOM_SEED = 42
N_SAMPLES = 25_000
OUTPUT_PATH = Path(__file__).with_name("fusion_training_data.csv")


def _sigmoid(value: np.ndarray) -> np.ndarray:
    return 1.0 / (1.0 + np.exp(-np.clip(value, -30, 30)))


def main() -> None:
    """Simulate upstream summaries and operational context with deterministic signal."""
    rng = np.random.default_rng(RANDOM_SEED)
    asset_condition = rng.beta(1.8, 5.2, N_SAMPLES)
    process_instability = rng.beta(1.7, 4.4, N_SAMPLES)
    work_intensity = rng.beta(2.1, 4.0, N_SAMPLES)

    failure_probability_proxy = _sigmoid(-4.0 + 6.0 * asset_condition + 1.5 * work_intensity)
    ai41_prediction = np.where(failure_probability_proxy > 0.60, rng.choice([1, 2, 3, 4, 5], N_SAMPLES), 0)
    failure_labels = np.array(["No Failure", "Tool Wear Failure", "Heat Dissipation Failure", "Power Failure", "Overstrain Failure", "Random Failure"])
    failure_type = failure_labels[ai41_prediction]
    ai41_confidence = np.where(ai41_prediction > 0, np.clip(rng.beta(8.0, 1.5, N_SAMPLES), 0.70, 0.995), np.clip(rng.beta(2.0, 5.0, N_SAMPLES), 0.10, 0.40))

    sensor_anomaly = _sigmoid(-4.5 + 7.0 * process_instability + 1.5 * work_intensity)
    swat_status = np.where(sensor_anomaly >= 0.75, "Critical", np.where(sensor_anomaly >= 0.40, "Warning", "Normal"))

    permit_type = rng.choice(["NONE", "ELECTRICAL", "HOT_WORK", "CONFINED_SPACE"], N_SAMPLES, p=[0.47, 0.21, 0.19, 0.13])
    permit_active = (permit_type != "NONE").astype(int)
    worker_mean = np.select([permit_type == "NONE", permit_type == "ELECTRICAL", permit_type == "HOT_WORK"], [1.5, 2.8, 5.0], default=3.6)
    workers_in_zone = np.clip(rng.poisson(worker_mean + work_intensity), 0, 18)
    
    maintenance_active = rng.binomial(1, _sigmoid(-2.0 + 4.0 * failure_probability_proxy + 2.0 * sensor_anomaly))
    isolation_verified = rng.binomial(1, _sigmoid(-1.0 + 5.0 * maintenance_active - 1.5 * work_intensity))
    supervisor_present = rng.binomial(1, _sigmoid(3.0 - 0.2 * workers_in_zone - 1.5 * maintenance_active))
    shift_change = rng.binomial(1, _sigmoid(-2.5 + 1.5 * permit_active + 0.2 * workers_in_zone))
    
    permit_conflict = _sigmoid(-5.0 + 3.0 * permit_active + 2.0 * maintenance_active - 2.5 * isolation_verified + 0.2 * workers_in_zone + 1.0 * shift_change)
    shift_context = _sigmoid(-3.0 + 3.0 * shift_change + 0.2 * workers_in_zone - 2.0 * supervisor_present + 1.5 * maintenance_active)

    ppe_base_risk = _sigmoid(-4.0 + 2.5 * work_intensity + 1.5 * shift_context)
    helmet_missing = rng.binomial(1, np.clip(ppe_base_risk * 0.85, 0, 1.0))
    vest_missing = rng.binomial(1, np.clip(ppe_base_risk * 0.65, 0, 1.0))
    mask_missing = rng.binomial(1, np.clip(ppe_base_risk * 0.45, 0, 1.0))
    
    worker_count = np.maximum(workers_in_zone + rng.integers(-1, 2, N_SAMPLES), 0)
    vehicle_count = rng.poisson(0.3 + 0.22 * work_intensity)
    machinery_count = rng.poisson(0.8 + 1.0 * maintenance_active + 0.5 * work_intensity)
    ppe_risk = np.minimum(1.0, (helmet_missing + vest_missing + mask_missing) / np.maximum(worker_count, 1))
    compliance_score = 1.0 - ppe_risk

    failure_event = (ai41_prediction != 0).astype(int)
    
    critical_logit = (-7.0 
                      + 4.5 * failure_event 
                      + 2.0 * ai41_confidence * failure_event 
                      + 4.0 * sensor_anomaly 
                      + 3.5 * ppe_risk
                      + 2.5 * permit_conflict 
                      + 2.0 * shift_context
                      + 5.0 * (permit_type == "HOT_WORK") * sensor_anomaly
                      + 6.0 * maintenance_active * failure_event * (1 - isolation_verified)
                      + 5.5 * (permit_type == "CONFINED_SPACE") * ppe_risk * (1 - supervisor_present)
                      + 2.5 * permit_active * (1 - supervisor_present) 
                      + 0.2 * workers_in_zone)
                      
    critical_probability = _sigmoid(critical_logit)
    is_critical = np.where(critical_probability > 0.40, 1, 0)

    pd.DataFrame({
        "ai41_prediction": ai41_prediction, "failure_type": failure_type, "ai41_confidence": ai41_confidence,
        "sensor_anomaly_score": sensor_anomaly, "swat_status": swat_status,
        "ppe_risk_score": ppe_risk, "helmet_missing": helmet_missing, "vest_missing": vest_missing,
        "mask_missing": mask_missing, "worker_count": worker_count, "vehicle_count": vehicle_count,
        "machinery_count": machinery_count, "compliance_score": compliance_score,
        "permit_conflict_score": permit_conflict, "shift_context_score": shift_context,
        "permit_type": permit_type, "permit_active": permit_active, "maintenance_active": maintenance_active,
        "isolation_verified": isolation_verified, "workers_in_zone": workers_in_zone,
        "supervisor_present": supervisor_present, "shift_change_flag": shift_change,
        "is_critical": is_critical,
    }).to_csv(OUTPUT_PATH, index=False)
    print(f"Generated {N_SAMPLES:,} deterministic industrial records at {OUTPUT_PATH}")


if __name__ == "__main__":
    main()