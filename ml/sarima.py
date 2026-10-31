"""Previsões ARIMA/SARIMA por item, com atualização causal e fallback explícito."""

import warnings
from dataclasses import dataclass
from time import perf_counter

import numpy as np
import pandas as pd
from scipy.special import logsumexp
from statsmodels.tsa.statespace.sarimax import SARIMAX

from ml.models import RatioBaseline


@dataclass(frozen=True)
class SarimaConfig:
    history_days: int = 730
    min_observations: int = 90
    maxiter: int = 100
    seasonal_period: int = 7

    def __post_init__(self):
        if self.seasonal_period < 2:
            raise ValueError("seasonal_period deve ser pelo menos 2.")
        if self.min_observations < 2 or self.maxiter < 1:
            raise ValueError("min_observations deve ser >= 2 e maxiter deve ser positivo.")
        if self.history_days < max(self.min_observations, 2 * self.seasonal_period):
            raise ValueError("history_days deve cobrir as observações mínimas e dois ciclos.")


def get_sarima_specs(period=7):
    """Grade pequena; a seleção usa walk-forward, nunca o período de teste."""
    return {
        "arima_111": ((1, 1, 1), (0, 0, 0, 0)),
        "sarima_111_100": ((1, 1, 1), (1, 0, 0, period)),
        "sarima_011_011": ((0, 1, 1), (0, 1, 1, period)),
    }


def daily_log_prices(history):
    """Um item por série. Mantém lacunas como NaN, sem interpolação com o futuro."""
    if history["market_hash_name"].nunique() != 1:
        raise ValueError("SARIMA espera o histórico de exatamente um item.")
    prices = history.sort_values("observation_date").set_index("observation_date")["price"]
    if prices.index.has_duplicates or not (np.isfinite(prices) & prices.gt(0)).all():
        raise ValueError("O histórico deve ter datas únicas e preços positivos e finitos.")
    return np.log(prices).asfreq("D")


def forecast_log_return(result, price_now, horizon, half_window):
    """Média aritmética dos preços esperados em H-W..H+W, convertida em log-retorno.

    Sob a distribuição gaussiana em log-preço, E[preço] = exp(mu + variância/2).
    A correção é diária; não se calcula a média dos log-preços.
    """
    if horizon < 1 or not 0 <= half_window < horizon:
        raise ValueError("Horizonte ou meia-janela inválido.")
    forecast = result.get_forecast(steps=horizon + half_window)
    start, stop = horizon - half_window - 1, horizon + half_window
    mean = np.asarray(forecast.predicted_mean)[start:stop]
    variance = np.asarray(forecast.var_pred_mean)[start:stop]
    if not np.isfinite(mean).all() or not np.isfinite(variance).all() or (variance < 0).any():
        raise ValueError("Previsão ou variância inválida.")
    log_price = logsumexp(mean + variance / 2) - np.log(len(mean))
    # Garante preço positivo e métricas quadráticas representáveis em float64.
    if not np.isfinite(log_price) or abs(log_price) > np.log(np.finfo(float).max) / 2 - 1:
        raise ValueError("Preço previsto fora do intervalo numérico suportado.")
    return float(log_price - np.log(price_now))


class ItemSarima:
    """Parâmetros fixos no fold; somente o estado é atualizado até cada data-base."""

    def __init__(self, order, seasonal_order, config):
        self.order = order
        self.seasonal_order = seasonal_order
        self.config = config
        self.result = None
        self.fit_status = "not_fitted"
        self.error = ""
        self.warning_count = 0
        self.n_observations = 0
        self.n_missing = 0
        self.fit_seconds = 0.0

    def fit(self, series, cutoff):
        self.last_date = pd.Timestamp(cutoff)
        start = self.last_date - pd.Timedelta(days=self.config.history_days - 1)
        sample = series.loc[start : self.last_date]
        self.n_observations = int(sample.notna().sum())
        self.n_missing = int(sample.isna().sum())
        minimum = max(self.config.min_observations, 2 * self.seasonal_order[3])
        self.result = None
        self.error = ""
        self.warning_count = 0
        self.fit_seconds = 0.0
        if self.n_observations < minimum:
            self.fit_status = "insufficient_history"
            return self
        # Inclui possíveis dias sem negociação até o limite do ajuste.
        sample = sample.reindex(pd.date_range(sample.index.min(), self.last_date, freq="D"))
        self.n_missing = int(sample.isna().sum())
        started = perf_counter()
        caught = []
        try:
            with warnings.catch_warnings(record=True) as caught:
                warnings.simplefilter("always")
                result = SARIMAX(
                    sample,
                    order=self.order,
                    seasonal_order=self.seasonal_order,
                    trend="n",
                    enforce_stationarity=True,
                    enforce_invertibility=True,
                ).fit(disp=False, maxiter=self.config.maxiter, cov_type="none")
            if not result.mle_retvals.get("converged", False):
                self.fit_status = "non_convergence"
                self.error = "O otimizador não convergiu; usando EMA 10 neste fold."
            elif not np.isfinite(result.params).all():
                self.fit_status = "fit_failed"
                self.error = "Parâmetros não finitos."
            else:
                self.result = result
                self.fit_status = "ok"
        except (ValueError, np.linalg.LinAlgError, FloatingPointError, OverflowError) as error:
            self.fit_status = "fit_failed"
            self.error = str(error)
        finally:
            self.fit_seconds = perf_counter() - started
            self.warning_count = len(caught)
        return self

    def predict_at(self, series, date, price_now, horizon, half_window, fallback):
        date = pd.Timestamp(date)
        if date < self.last_date:
            raise ValueError("As datas de previsão devem ser posteriores ao estado do modelo.")
        if self.result is None:
            return float(fallback), self.fit_status
        try:
            if date > self.last_date:
                dates = pd.date_range(self.last_date + pd.Timedelta(days=1), date, freq="D")
                # Nunca fornece observações posteriores à origem da previsão.
                self.result = self.result.extend(series.reindex(dates))
                self.last_date = date
            prediction = forecast_log_return(self.result, price_now, horizon, half_window)
            return prediction, ""
        except (ValueError, np.linalg.LinAlgError, FloatingPointError, OverflowError) as error:
            self.error = str(error)
            return float(fallback), "forecast_failed"


def rolling_predictions(history, observations, cutoff, spec, training_config, sarima_config):
    """Avalia um item em origens sucessivas; conserva índices para alinhar as métricas."""
    if observations.empty:
        raise ValueError("Nenhuma observação para avaliar.")
    if pd.Timestamp(cutoff) > observations["observation_date"].min():
        raise ValueError("O ajuste não pode acessar datas posteriores à primeira previsão.")
    series = daily_log_prices(history)
    model = ItemSarima(*spec, sarima_config).fit(series, cutoff)
    ordered = observations.sort_values("observation_date")
    fallback = RatioBaseline().predict(ordered)
    rows = []
    started = perf_counter()
    for (index, row), ema in zip(ordered.iterrows(), fallback, strict=True):
        prediction, reason = model.predict_at(
            series,
            row["observation_date"],
            row["price"],
            training_config.horizon,
            training_config.target_half_window,
            ema,
        )
        rows.append({"index": index, "prediction": prediction, "fallback_reason": reason})
    predictions = pd.DataFrame(rows).set_index("index").reindex(observations.index)
    diagnostics = {
        "fit_status": model.fit_status,
        "n_observations": model.n_observations,
        "n_missing": model.n_missing,
        "fit_seconds": model.fit_seconds,
        "predict_seconds": perf_counter() - started,
        "warning_count": model.warning_count,
        "forecast_failures": int(predictions["fallback_reason"].eq("forecast_failed").sum()),
        "fallback_count": int(predictions["fallback_reason"].ne("").sum()),
        "prediction_count": len(predictions),
        "error": model.error,
    }
    return predictions, diagnostics
