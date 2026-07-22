import os
import json
from collections import deque

import numpy as np
import pandas as pd

os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "2")
os.environ.setdefault(
    "MPLCONFIGDIR",
    os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".cache", "matplotlib")),
)
os.makedirs(os.environ["MPLCONFIGDIR"], exist_ok=True)


class SwatAnomalyDetector:
    SENSOR_COLUMNS = [
        "FIT101",
        "LIT101",
        "AIT201",
        "AIT202",
        "AIT203",
        "FIT201",
        "DPIT301",
        "FIT301",
        "LIT301",
        "AIT401",
        "AIT402",
        "FIT401",
        "LIT401",
        "AIT501",
        "AIT502",
        "AIT503",
        "AIT504",
        "FIT501",
        "FIT502",
        "FIT503",
        "FIT504",
        "PIT501",
        "PIT502",
        "PIT503",
        "FIT601",
    ]
    KEY_SENSORS = SENSOR_COLUMNS[:6]
    ROLLING_WINDOW = 10
    SEQUENCE_LENGTH = 5
    HISTORY_SIZE = ROLLING_WINDOW + SEQUENCE_LENGTH

    def __init__(self, models_dir=None):
        """
        Loads the trained SWaT LSTM autoencoder, scaler, and anomaly thresholds.
        """
        if models_dir is None:
            package_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
            models_dir = os.path.join(package_root, "models")

        scaler_path = os.path.join(models_dir, "scaler.pkl")
        scaler_stats_path = os.path.join(models_dir, "scaler_stats.json")
        model_path = os.path.join(models_dir, "swat_lstm_ae.keras")
        thresholds_path = os.path.join(models_dir, "thresholds.pkl")
        thresholds_stats_path = os.path.join(models_dir, "thresholds_stats.json")

        missing = [
            path
            for path in (model_path,)
            if not os.path.exists(path)
        ]
        if not os.path.exists(scaler_stats_path) and not os.path.exists(scaler_path):
            missing.append(scaler_stats_path)
        if not os.path.exists(thresholds_stats_path) and not os.path.exists(thresholds_path):
            missing.append(thresholds_stats_path)
        if missing:
            raise FileNotFoundError(
                "Missing SWaT model artifacts: " + ", ".join(missing)
            )

        try:
            from tensorflow.keras.models import load_model
        except ImportError as exc:
            raise ImportError(
                "TensorFlow is required to load swat_lstm_ae.keras. "
                "Install tensorflow in the active environment."
            ) from exc

        self.scaler = self._load_scaler(scaler_stats_path, scaler_path)
        self.model = load_model(model_path, compile=False)
        self.thresholds = self._load_thresholds(thresholds_stats_path, thresholds_path)
        self.threshold_95 = float(self.thresholds["th95"])
        self.threshold_99 = float(self.thresholds["th99"])
        self.feature_columns = self._build_feature_columns()
        self.raw_history = deque(maxlen=self.HISTORY_SIZE)
        self.last_valid_values = {}

        if len(self.feature_columns) != self.scaler["n_features_in"]:
            raise ValueError(
                "Feature count mismatch: module builds "
                f"{len(self.feature_columns)} features but scaler expects "
                f"{self.scaler['n_features_in']}."
            )

        expected_shape = self.model.input_shape
        if expected_shape[1:] != (self.SEQUENCE_LENGTH, len(self.feature_columns)):
            raise ValueError(
                "Model input shape mismatch: model expects "
                f"{expected_shape}, but inference builds "
                f"(None, {self.SEQUENCE_LENGTH}, {len(self.feature_columns)})."
            )

    def _load_json(self, path):
        with open(path, "r", encoding="utf-8") as file:
            return json.load(file)

    def _load_joblib(self, path):
        try:
            import joblib
        except ImportError as exc:
            raise ImportError(
                f"{path} requires joblib/sklearn to load. Use the JSON artifact instead."
            ) from exc
        return joblib.load(path)

    def _load_scaler(self, scaler_stats_path, scaler_path):
        if os.path.exists(scaler_stats_path):
            stats = self._load_json(scaler_stats_path)
            return {
                "mean": np.asarray(stats["mean"], dtype=np.float32),
                "scale": np.asarray(stats["scale"], dtype=np.float32),
                "n_features_in": int(stats["n_features_in"]),
            }

        scaler = self._load_joblib(scaler_path)
        return {
            "mean": np.asarray(scaler.mean_, dtype=np.float32),
            "scale": np.asarray(scaler.scale_, dtype=np.float32),
            "n_features_in": int(scaler.n_features_in_),
        }

    def _load_thresholds(self, thresholds_stats_path, thresholds_path):
        if os.path.exists(thresholds_stats_path):
            return self._load_json(thresholds_stats_path)
        return self._load_joblib(thresholds_path)

    def _build_feature_columns(self):
        engineered = []
        for sensor in self.KEY_SENSORS:
            engineered.extend([f"{sensor}_rm10", f"{sensor}_diff"])
        return self.SENSOR_COLUMNS + engineered

    def _to_dataframe(self, live_sensor_data):
        if isinstance(live_sensor_data, dict):
            return pd.DataFrame([live_sensor_data])
        if isinstance(live_sensor_data, list):
            return pd.DataFrame(live_sensor_data)
        if isinstance(live_sensor_data, pd.DataFrame):
            return live_sensor_data.copy()
        raise ValueError(
            "Input data must be a dictionary, list of dictionaries, or pandas DataFrame."
        )

    def _validate_columns(self, df):
        missing_sensors = [col for col in self.SENSOR_COLUMNS if col not in df.columns]
        if missing_sensors:
            raise ValueError(
                "Missing required SWaT sensor columns: " + ", ".join(missing_sensors)
            )

    def _clean_raw_frame(self, df):
        self._validate_columns(df)
        df = df[self.SENSOR_COLUMNS].apply(pd.to_numeric, errors="coerce")
        return df.ffill().bfill().fillna(0).astype(np.float32)

    def _build_features_from_raw_frame(self, raw_df):
        df = raw_df.copy()

        for sensor in self.KEY_SENSORS:
            df[f"{sensor}_rm10"] = (
                df[sensor]
                .rolling(self.ROLLING_WINDOW, min_periods=1)
                .mean()
                .astype(np.float32)
            )
            df[f"{sensor}_diff"] = df[sensor].diff().fillna(0).astype(np.float32)

        return df[self.feature_columns].astype(np.float32)

    def preprocess_live_data(self, live_sensor_data):
        """
        Mirrors the Kaggle notebook feature logic with enough raw history:
        clean raw sensors -> rolling(10) and diff over the history buffer
        -> keep only the latest 5 feature rows for the LSTM sequence.
        """
        df = self._to_dataframe(live_sensor_data)
        if len(df) < self.HISTORY_SIZE:
            raise ValueError(
                f"At least {self.HISTORY_SIZE} consecutive raw SWaT readings are "
                "required for a valid live score: 10-step rolling context plus "
                "5-step LSTM sequence context."
            )

        raw_df = self._clean_raw_frame(df)
        feature_df = self._build_features_from_raw_frame(raw_df)
        return feature_df.tail(self.SEQUENCE_LENGTH)

    def _scale(self, df):
        values = df.to_numpy(dtype=np.float32)
        scale = np.where(self.scaler["scale"] == 0, 1.0, self.scaler["scale"])
        return ((values - self.scaler["mean"]) / scale).astype(np.float32)

    def _make_latest_sequence(self, scaled_data):
        if len(scaled_data) != self.SEQUENCE_LENGTH:
            raise ValueError(
                f"Exactly {self.SEQUENCE_LENGTH} feature rows are required for "
                "the latest SWaT LSTM sequence."
            )
        return np.asarray([scaled_data], dtype=np.float32)

    def _risk_from_mse(self, mse):
        eps = 1e-12
        if mse <= self.threshold_95:
            return min(0.49, 0.49 * mse / max(self.threshold_95, eps))
        if mse <= self.threshold_99:
            span = max(self.threshold_99 - self.threshold_95, eps)
            return 0.50 + 0.29 * ((mse - self.threshold_95) / span)

        span = max(self.threshold_99, eps)
        return min(1.0, 0.80 + 0.20 * ((mse - self.threshold_99) / span))

    def _score_feature_sequence(self, feature_df):
        scaled_data = self._scale(feature_df)
        sequence = self._make_latest_sequence(scaled_data)

        reconstructed = self.model.predict(sequence, verbose=0)
        reconstruction_error = float(np.mean(np.square(sequence - reconstructed)))
        risk_score = float(self._risk_from_mse(reconstruction_error))

        if reconstruction_error > self.threshold_99:
            status = "Critical"
        elif reconstruction_error > self.threshold_95:
            status = "Warning"
        else:
            status = "Normal"

        return {
            "module_name": "IoT_SCADA_Sensor_Intelligence",
            "anomaly_probability": round(risk_score, 4),
            "reconstruction_error": round(reconstruction_error, 6),
            "threshold_95": round(self.threshold_95, 6),
            "threshold_99": round(self.threshold_99, 6),
            "status": status,
            "history_rows_used": self.HISTORY_SIZE,
            "sequence_length": self.SEQUENCE_LENGTH,
            "rolling_window": self.ROLLING_WINDOW,
        }

    def _normalize_stream_reading(self, reading):
        row = self._to_dataframe(reading)
        if len(row) != 1:
            raise ValueError("Streaming update expects exactly one raw sensor reading.")
        self._validate_columns(row)

        row = row[self.SENSOR_COLUMNS].apply(pd.to_numeric, errors="coerce")
        values = {}
        for sensor in self.SENSOR_COLUMNS:
            value = row.iloc[0][sensor]
            if pd.isna(value):
                if sensor in self.last_valid_values:
                    value = self.last_valid_values[sensor]
                else:
                    value = np.nan
            else:
                value = float(value)
                self.last_valid_values[sensor] = value
            values[sensor] = value
        return values

    def reset(self):
        self.raw_history.clear()
        self.last_valid_values.clear()

    def is_ready(self):
        return len(self.raw_history) >= self.HISTORY_SIZE

    def update(self, reading):
        """
        Streaming API: push one new raw IoT row. Returns a warm-up response until
        enough history exists, then returns a valid latest anomaly score.
        """
        self.raw_history.append(self._normalize_stream_reading(reading))

        if not self.is_ready():
            return {
                "module_name": "IoT_SCADA_Sensor_Intelligence",
                "status": "WarmingUp",
                "anomaly_probability": None,
                "reconstruction_error": None,
                "history_rows_collected": len(self.raw_history),
                "history_rows_required": self.HISTORY_SIZE,
            }

        return self.predict_latest()

    def predict_latest(self):
        if not self.is_ready():
            raise ValueError(
                f"Detector has {len(self.raw_history)} readings; "
                f"{self.HISTORY_SIZE} are required before scoring."
            )
        raw_df = self._clean_raw_frame(pd.DataFrame(list(self.raw_history)))
        feature_df = self._build_features_from_raw_frame(raw_df).tail(
            self.SEQUENCE_LENGTH
        )
        return self._score_feature_sequence(feature_df)

    def predict(self, live_sensor_data):
        """
        Batch/history API: pass at least 15 consecutive raw readings. The method
        computes rolling/diff features on that raw context and scores the latest
        5-step sequence. For real IoT streams, prefer update(reading).
        """
        processed_df = self.preprocess_live_data(live_sensor_data)
        return self._score_feature_sequence(processed_df)
