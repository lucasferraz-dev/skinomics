"""Regressores de log-retorno usados na previsão de preços."""

import numpy as np
from lightgbm import LGBMRegressor
from sklearn.base import BaseEstimator, RegressorMixin, clone
from sklearn.dummy import DummyRegressor
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.utils.validation import check_is_fitted

NAIVE = "ingenuo"
EMA = "ema_10"


class RatioBaseline(RegressorMixin, BaseEstimator):
    """Prevê a volta à média: a coluna contém média/preço atual - 1."""

    def __init__(self, col="ema_10_rel"):
        self.col = col

    def fit(self, X, y=None):  # noqa: N803 - interface do scikit-learn
        self.n_features_in_ = X.shape[1]
        self.feature_names_in_ = np.asarray(X.columns, dtype=object)
        return self

    def predict(self, X):  # noqa: N803
        return np.nan_to_num(np.log1p(X[self.col].to_numpy(dtype=float)))


class EMABlend(RegressorMixin, BaseEstimator):
    """Corta os alvos de treino e mistura a previsão com a baseline EMA 10."""

    def __init__(self, estimator, ema_weight=0.5, clip=0.7):
        self.estimator = estimator
        self.ema_weight = ema_weight
        self.clip = clip

    def fit(self, X, y):  # noqa: N803
        if not 0 <= self.ema_weight <= 1:
            raise ValueError("ema_weight deve estar entre 0 e 1.")
        if not np.isfinite(self.clip) or self.clip <= 0:
            raise ValueError("clip deve ser finito e positivo.")
        self.model_ = clone(self.estimator).fit(X, np.clip(y, -self.clip, self.clip))
        self.n_features_in_ = X.shape[1]
        self.feature_names_in_ = np.asarray(X.columns, dtype=object)
        return self

    def predict(self, X):  # noqa: N803
        check_is_fitted(self, "model_")
        prediction = self.model_.predict(X)
        if self.ema_weight == 0:
            return prediction
        ema = RatioBaseline().predict(X)
        return (1 - self.ema_weight) * prediction + self.ema_weight * ema


def get_models(random_state=42, *, ema_weight=0.5, target_clip=0.7, n_jobs=-1):
    """Baselines e boosting, com parâmetros conservadores do notebook."""
    hgb = HistGradientBoostingRegressor(
        loss="absolute_error",
        learning_rate=0.03,
        max_leaf_nodes=7,
        min_samples_leaf=200,
        max_iter=600,
        early_stopping=True,
        validation_fraction=0.1,
        n_iter_no_change=30,
        random_state=random_state,
    )
    lightgbm = LGBMRegressor(
        objective="regression_l1",
        learning_rate=0.03,
        num_leaves=7,
        min_child_samples=200,
        n_estimators=600,
        random_state=random_state,
        n_jobs=n_jobs,
        deterministic=True,
        force_col_wise=True,
        verbosity=-1,
    )
    return {
        NAIVE: DummyRegressor(strategy="constant", constant=0.0),
        EMA: RatioBaseline(),
        "hgb": EMABlend(hgb, ema_weight=0.0, clip=target_clip),
        "hgb_ema": EMABlend(hgb, ema_weight=ema_weight, clip=target_clip),
        "lightgbm": EMABlend(lightgbm, ema_weight=0.0, clip=target_clip),
        "lightgbm_ema": EMABlend(lightgbm, ema_weight=ema_weight, clip=target_clip),
    }
