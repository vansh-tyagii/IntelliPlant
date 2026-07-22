"""Train and evaluate the CatBoost industrial Fusion Engine."""

from pathlib import Path
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import shap
from catboost import CatBoostClassifier
from sklearn.metrics import accuracy_score, average_precision_score, classification_report, confusion_matrix, precision_recall_curve, precision_recall_fscore_support
from sklearn.model_selection import train_test_split

ROOT = Path(__file__).resolve().parent
DATA_PATH = ROOT / "fusion_training_data.csv"
MODEL_PATH = ROOT / "engines" / "fusion_model.cbm"
SHAP_PATH = ROOT / "shap_summary_plot.png"


def main() -> None:
    data = pd.read_csv(DATA_PATH)
    features, target = data.drop(columns="is_critical"), data["is_critical"]
    categorical = ["failure_type", "swat_status", "permit_type"]
    
    X_train_full, X_test, y_train_full, y_test = train_test_split(features, target, test_size=0.20, random_state=42, stratify=target)
    X_train, X_validation, y_train, y_validation = train_test_split(X_train_full, y_train_full, test_size=0.1875, random_state=42, stratify=y_train_full)
    
    model = CatBoostClassifier(
        iterations=1500,
        learning_rate=0.1,
        depth=8,
        l2_leaf_reg=3,
        loss_function="Logloss",
        eval_metric="Logloss",
        cat_features=categorical,
        random_seed=42,
        verbose=100,
        allow_writing_files=False
    )
    
    model.fit(X_train, y_train, eval_set=(X_validation, y_validation), early_stopping_rounds=80)
    
    decision_threshold = 0.05
    test_probabilities = model.predict_proba(X_test)[:, 1]
    predictions = (test_probabilities >= decision_threshold).astype(int)
    
    precision, recall, f1, _ = precision_recall_fscore_support(y_test, predictions, average="binary", zero_division=0)
    
    print({
        "decision_threshold": round(decision_threshold, 4), 
        "accuracy": round(accuracy_score(y_test, predictions), 4), 
        "precision": round(precision, 4), 
        "recall": round(recall, 4), 
        "f1": round(f1, 4), 
        "pr_auc": round(average_precision_score(y_test, test_probabilities), 4), 
        "confusion_matrix": confusion_matrix(y_test, predictions).tolist()
    })
    
    print(classification_report(y_test, predictions, target_names=["Normal", "Critical"], zero_division=0))
    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    model.save_model(str(MODEL_PATH))
    
    explainer = shap.TreeExplainer(model)
    plt.figure(figsize=(10, 6))
    shap.summary_plot(explainer.shap_values(X_test), X_test, show=False)
    plt.tight_layout()
    plt.savefig(SHAP_PATH, dpi=150)
    plt.close()


if __name__ == "__main__":
    main()