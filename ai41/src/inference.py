import joblib
import pandas as pd
from pathlib import Path

# MODEL_PATH = "D:\\etai\\ai41\\model\\random_forest_model.pkl"
# SCALER_PATH = "D:\\etai\\ai41\\model\\minmax_scaler.pkl"

_MODEL_DIR = Path(__file__).resolve().parents[1] / "model"
MODEL_PATH = _MODEL_DIR / "random_forest_model.pkl"
SCALER_PATH = _MODEL_DIR / "minmax_scaler.pkl"

model = joblib.load(MODEL_PATH)
scaler = joblib.load(SCALER_PATH)


CLASS_NAMES = {
    0: "No Failure",
    1: "Tool Wear Failure",
    2: "Heat Dissipation Failure",
    3: "Power Failure",
    4: "Overstrain Failure",
    5: "Random Failure"
}


def preprocess(
    air_temp,
    process_temp,
    rpm,
    torque,
    tool_wear,
    machine_type,
):

    power = rpm * torque

    power_wear = power * tool_wear

    temperature_difference = process_temp - air_temp

    if power == 0:
        temperature_power = 0
    else:
        temperature_power = temperature_difference / power

    type_l = 1 if machine_type.upper() == "L" else 0
    type_m = 1 if machine_type.upper() == "M" else 0

    df = pd.DataFrame([{
        "Air temperature [K]": air_temp,
        "Process temperature [K]": process_temp,
        "Rotational speed [rpm]": rpm,
        "Torque [Nm]": torque,
        "Tool wear [min]": tool_wear,
        "Power": power,
        "Power wear": power_wear,
        "Temperature difference": temperature_difference,
        "Temperature power": temperature_power,
        "Type_L": type_l,
        "Type_M": type_m
    }])

    return df


def predict_failure(
    air_temp,
    process_temp,
    rpm,
    torque,
    tool_wear,
    machine_type,
):

    X = preprocess(
        air_temp,
        process_temp,
        rpm,
        torque,
        tool_wear,
        machine_type
    )

    X = scaler.transform(X)

    prediction = model.predict(X)[0]

    probabilities = model.predict_proba(X)[0]

    confidence = probabilities.max()

    return {
        "prediction": int(prediction),
        "failure_type": CLASS_NAMES[prediction],
        "confidence": round(float(confidence), 4)
    }


if __name__ == "__main__":

    result = predict_failure(
        air_temp=300,
        process_temp=310,
        rpm=1500,
        torque=40,
        tool_wear=20,
        machine_type="L"
    )

    print(result)
