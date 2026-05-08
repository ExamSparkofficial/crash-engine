from __future__ import annotations

from datetime import datetime
from typing import Any

import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from scipy import stats
from sklearn.cluster import KMeans
from sklearn.ensemble import IsolationForest, RandomForestRegressor

DISCLAIMER = "Probability estimate only — not guaranteed prediction."

app = FastAPI(
    title="CrashPulse AI Analytics Service",
    version="1.0.0",
    description="Optional ML analytics service for crash-style multiplier history.",
)


class RoundIn(BaseModel):
    round_id: str = Field(..., min_length=1, max_length=120)
    multiplier: float = Field(..., ge=1, le=10000)
    timestamp: datetime


class AnalyzeRequest(BaseModel):
    rounds: list[RoundIn] = Field(default_factory=list, max_length=5000)


def build_frame(rounds: list[RoundIn]) -> pd.DataFrame:
    if len(rounds) < 10:
        raise HTTPException(status_code=400, detail="At least 10 rounds are required.")

    frame = pd.DataFrame([round.model_dump() for round in rounds])
    frame = frame.sort_values("timestamp").reset_index(drop=True)
    frame["log_multiplier"] = np.log(frame["multiplier"].clip(lower=1.01))
    frame["rolling_mean_10"] = frame["multiplier"].rolling(10, min_periods=3).mean()
    frame["rolling_vol_10"] = frame["log_multiplier"].rolling(10, min_periods=3).std().fillna(0)
    frame["is_low"] = (frame["multiplier"] < 2).astype(int)
    frame["is_high"] = (frame["multiplier"] > 5).astype(int)
    frame["index"] = np.arange(len(frame))
    return frame.fillna(method="bfill").fillna(0)


def anomaly_detection(frame: pd.DataFrame) -> list[dict[str, Any]]:
    if len(frame) < 20:
        return []

    features = frame[["log_multiplier", "rolling_vol_10", "rolling_mean_10"]]
    model = IsolationForest(n_estimators=120, contamination="auto", random_state=42)
    scores = model.fit_predict(features)
    frame = frame.copy()
    frame["anomaly_score"] = model.decision_function(features)
    frame["is_anomaly"] = scores == -1

    anomalies = frame[frame["is_anomaly"]].tail(12)
    return [
        {
            "round_id": row.round_id,
            "multiplier": float(row.multiplier),
            "timestamp": row.timestamp.isoformat(),
            "score": float(row.anomaly_score),
        }
        for row in anomalies.itertuples()
    ]


def cluster_rounds(frame: pd.DataFrame) -> dict[str, Any]:
    if len(frame) < 12:
        return {"clusters": [], "labels": []}

    features = frame[["log_multiplier", "rolling_vol_10", "is_low", "is_high"]]
    cluster_count = min(3, len(frame))
    model = KMeans(n_clusters=cluster_count, n_init="auto", random_state=42)
    labels = model.fit_predict(features)
    frame = frame.copy()
    frame["cluster"] = labels

    clusters = []
    for cluster_id, group in frame.groupby("cluster"):
        clusters.append(
            {
                "cluster": int(cluster_id),
                "count": int(len(group)),
                "avg_multiplier": float(group["multiplier"].mean()),
                "low_rate": float(group["is_low"].mean()),
                "high_rate": float(group["is_high"].mean()),
            }
        )

    return {"clusters": clusters, "labels": labels[-60:].astype(int).tolist()}


def volatility_prediction(frame: pd.DataFrame) -> dict[str, float]:
    frame = frame.copy()
    frame["target_vol"] = frame["rolling_vol_10"].shift(-1)
    train = frame.dropna(subset=["target_vol"])

    if len(train) < 30:
        latest = float(frame["rolling_vol_10"].tail(10).mean())
        return {"next_volatility": latest, "confidence": 0.35}

    features = train[["log_multiplier", "rolling_mean_10", "rolling_vol_10", "is_low", "is_high"]]
    target = train["target_vol"]
    model = RandomForestRegressor(n_estimators=160, random_state=42, min_samples_leaf=3)
    model.fit(features, target)
    prediction = model.predict(frame[features.columns].tail(1))[0]
    confidence = max(0.4, min(0.88, 1 - float(np.std(target.tail(30)))))
    return {"next_volatility": float(max(prediction, 0)), "confidence": float(confidence)}


def trend_score(frame: pd.DataFrame) -> float:
    recent = frame.tail(min(50, len(frame)))
    slope, _, r_value, _, _ = stats.linregress(recent["index"], recent["log_multiplier"])
    score = 50 + slope * 900 + r_value * 12 - float(recent["rolling_vol_10"].mean()) * 18
    return float(np.clip(score, 0, 100))


@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "ok": True,
        "service": "crashpulse-ai-analytics",
        "timestamp": datetime.utcnow().isoformat(),
        "disclaimer": DISCLAIMER,
    }


@app.post("/analyze")
def analyze(request: AnalyzeRequest) -> dict[str, Any]:
    frame = build_frame(request.rounds)
    multipliers = frame["multiplier"]

    return {
        "disclaimer": DISCLAIMER,
        "summary": {
            "rounds": int(len(frame)),
            "mean": float(multipliers.mean()),
            "median": float(multipliers.median()),
            "std_dev": float(multipliers.std()),
            "skew": float(stats.skew(multipliers)),
            "kurtosis": float(stats.kurtosis(multipliers)),
            "low_crash_rate": float((multipliers < 2).mean()),
            "high_crash_rate": float((multipliers > 5).mean()),
        },
        "anomalies": anomaly_detection(frame),
        "clustering": cluster_rounds(frame),
        "volatility_prediction": volatility_prediction(frame),
        "trend_score": trend_score(frame),
        "generated_at": datetime.utcnow().isoformat(),
    }
