from dataclasses import replace

import numpy as np
import pandas as pd
import pytest

from ml.intervals import add_intervals, calibrate, interval_metrics, validate_interval
from ml.train import calibration_split, prepare_data


def test_quantile_uses_finite_sample_rank_and_unclipped_residuals():
    interval = calibrate(np.arange(30), np.zeros(30))
    assert interval["radius_log"] == 24  # ceil(31 * 0.8) = 25, índice 24.
    assert interval["confidence"] == 0.8


@pytest.mark.parametrize("values", [np.zeros(29), np.full(30, np.nan), np.full(30, np.inf)])
def test_invalid_calibration_fails_instead_of_fabricating_interval(values):
    with pytest.raises(ValueError, match="30 resíduos finitos"):
        calibrate(values, np.zeros(len(values)))


@pytest.mark.parametrize("radius", [-1, float("inf"), float("nan"), "0.1", True])
def test_rejects_invalid_serialized_radius(radius):
    interval = calibrate(np.zeros(30), np.zeros(30))
    interval["radius_log"] = radius
    with pytest.raises(ValueError, match="Calibração"):
        validate_interval(interval)


@pytest.mark.parametrize("horizon", [7, 15, 30])
def test_all_horizons_embargo_targets_between_train_calibration_test(csv_path, config, horizon):
    config = replace(config, horizon=horizon)
    labeled, _, _ = prepare_data(csv_path, config)
    train, calibration, test = calibration_split(labeled, config)
    gap = pd.Timedelta(days=config.gap_days)
    assert train.observation_date.max() + gap < calibration.observation_date.min()
    assert calibration.observation_date.max() + gap < test.observation_date.min()
    assert not set(train.index) & set(calibration.index) & set(test.index)
    # Mexer nos alvos de teste não pode mudar a calibração.
    modified = labeled.copy()
    modified.loc[test.index, "target_logret"] = 100
    _, repeated, _ = calibration_split(modified, config)
    pd.testing.assert_frame_equal(calibration, repeated)


def test_bounds_scale_by_price_and_flag_width_or_short_history():
    frame = pd.DataFrame({"preco_previsto": [0.2, 10], "historico_curto": [False, True]})
    narrow = calibrate(np.full(30, 0.1), np.zeros(30))
    result = add_intervals(frame, narrow)
    np.testing.assert_allclose(result.intervalo_inferior, frame.preco_previsto * np.exp(-0.1))
    np.testing.assert_allclose(result.intervalo_superior, frame.preco_previsto * np.exp(0.1))
    assert result.incerteza_elevada.tolist() == [False, True]
    assert (result.nivel_confianca == 0.8).all()
    wide = calibrate(np.full(30, 0.3), np.zeros(30))
    assert add_intervals(frame, wide).incerteza_elevada.all()
    assert add_intervals(frame).intervalo_inferior.isna().all()
    assert add_intervals(frame).nivel_confianca.isna().all()


def test_interval_overflow_rejected_and_coverage_computed_on_unseen_targets():
    interval = calibrate(np.full(30, 0.1), np.zeros(30))
    result = interval_metrics([0, 0.09, 0.11, -0.2], np.zeros(4), np.ones(4), interval)
    assert result["coverage"] == 0.5
    assert result["n"] == 4
    interval["radius_log"] = 1000
    with pytest.raises(ValueError, match="precisão"):
        add_intervals(pd.DataFrame({"preco_previsto": [1], "historico_curto": [False]}), interval)
