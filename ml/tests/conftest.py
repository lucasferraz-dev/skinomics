import numpy as np
import pandas as pd
import pytest

from ml.train import KEY_ITEM, TrainingConfig


@pytest.fixture
def history():
    days = 240
    dates = pd.date_range("2020-01-01", periods=days)
    return pd.concat(
        [
            pd.DataFrame(
                {
                    "observation_date": dates,
                    "market_hash_name": item,
                    "price": scale * np.exp(0.04 * np.sin(np.arange(days) / 4 + index)),
                    "volume": 100 + np.arange(days) % 50,
                    "is_filled": 0,
                    "days_since_first_obs": np.arange(days),
                    "scrape_timestamp_utc": "2021-01-01T12:00:00Z",
                }
            )
            for index, (item, scale) in enumerate((("Case A", 0.5), ("Case B", 2), (KEY_ITEM, 10)))
        ],
        ignore_index=True,
    )


@pytest.fixture
def csv_path(tmp_path, history):
    path = tmp_path / "historico.csv"
    history.to_csv(path, index=False)
    return path


@pytest.fixture
def config():
    return TrainingConfig(test_days=30, calibration_days=30, cv_folds=2, fold_days=30, n_jobs=1)
