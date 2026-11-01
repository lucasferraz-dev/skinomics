"""Faixas nominais de 80% para a média futura, calibradas fora do treino.

O quantil conformal corrige o tamanho finito da amostra. Em séries temporais,
a dependência e mudanças de regime impedem garantir a cobertura futura.
"""

import math

import numpy as np

CONFIDENCE = 0.8
MIN_CALIBRATION_ROWS = 30
HIGH_UNCERTAINTY_WIDTH = 0.5


def calibrate(actual, prediction):
    actual, prediction = np.asarray(actual), np.asarray(prediction)
    if actual.shape != prediction.shape or actual.ndim != 1:
        raise ValueError("Alvos e previsões de calibração devem ter o mesmo tamanho.")
    scores = np.abs(actual - prediction)
    if len(scores) < MIN_CALIBRATION_ROWS or not np.isfinite(scores).all():
        raise ValueError("Calibração exige ao menos 30 resíduos finitos fora do treino.")
    rank = math.ceil((len(scores) + 1) * CONFIDENCE)
    return {
        "method": "temporal_split_absolute_log_residual",
        "confidence": CONFIDENCE,
        "radius_log": float(np.sort(scores)[rank - 1]),
        "n": len(scores),
    }


def validate_interval(interval):
    if (
        not isinstance(interval, dict)
        or interval.get("method") != "temporal_split_absolute_log_residual"
        or interval.get("confidence") != CONFIDENCE
        or type(interval.get("n")) is not int
        or interval["n"] < MIN_CALIBRATION_ROWS
        or type(interval.get("radius_log")) not in (int, float)
        or not np.isfinite(interval["radius_log"])
        or interval["radius_log"] < 0
    ):
        raise ValueError("Calibração do intervalo inválida; treine uma nova versão.")


def interval_metrics(actual, prediction, price, interval):
    validate_interval(interval)
    radius = interval["radius_log"]
    actual, prediction, price = map(np.asarray, (actual, prediction, price))
    low, high = price * np.exp(prediction - radius), price * np.exp(prediction + radius)
    return {
        "n": len(actual),
        "coverage": float(np.mean(np.abs(actual - prediction) <= radius)),
        "mean_width_usd": float(np.mean(high - low)),
        "mean_relative_width": float(np.mean((high - low) / (price * np.exp(prediction)))),
    }


def add_intervals(forecast, interval=None):
    forecast = forecast.copy()
    # Versões antigas continuam válidas, mas não recebem uma faixa inventada.
    forecast["intervalo_inferior"] = None
    forecast["intervalo_superior"] = None
    forecast["nivel_confianca"] = None
    forecast["incerteza_elevada"] = forecast["historico_curto"].astype(bool)
    if interval is None:
        return forecast
    validate_interval(interval)
    radius = interval["radius_log"]
    with np.errstate(over="ignore", under="ignore"):
        low = forecast["preco_previsto"] * np.exp(-radius)
        high = forecast["preco_previsto"] * np.exp(radius)
    if (
        not np.isfinite(low).all()
        or not np.isfinite(high).all()
        or (low < 1e-8).any()
        or (high >= 1e12).any()
    ):
        raise ValueError("Intervalo fora da precisão do banco; previsões não publicadas.")
    forecast["intervalo_inferior"] = low
    forecast["intervalo_superior"] = high
    forecast["nivel_confianca"] = CONFIDENCE
    forecast["incerteza_elevada"] |= (high - low) / forecast[
        "preco_previsto"
    ] > HIGH_UNCERTAINTY_WIDTH
    return forecast
