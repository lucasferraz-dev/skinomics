import sys

import pytest
from lightgbm import LGBMRegressor
from lightgbm.basic import LightGBMError

from ml import experiments, train
from ml.models import check_lightgbm_device, get_models
from ml.train import TrainingConfig


@pytest.mark.parametrize("device", ["cpu", "gpu", "cuda"])
def test_backend_is_applied_to_both_lightgbm_variants_only(device):
    models = get_models(device=device)
    for name in ("lightgbm", "lightgbm_ema"):
        params = models[name].estimator.get_params()
        assert params["device_type"] == device
        if device == "cpu":
            assert params["deterministic"] is True
            assert params["force_col_wise"] is True
        else:
            assert "deterministic" not in params
            assert "force_col_wise" not in params
    assert "device_type" not in models["hgb"].estimator.get_params()


@pytest.mark.parametrize(
    "kwargs",
    [
        {"device": "invalid"},
        {"device": "gpu", "gpu_device_id": -2},
        {"device": "gpu", "gpu_platform_id": -2},
        {"device": "cpu", "gpu_device_id": 0},
        {"device": "cpu", "gpu_platform_id": 0},
        {"device": "cuda", "gpu_platform_id": 0},
    ],
)
def test_invalid_backend_configuration_is_rejected(kwargs):
    with pytest.raises(ValueError):
        TrainingConfig(**kwargs)


def test_cpu_skips_gpu_probe(monkeypatch):
    def unexpected_fit(*args, **kwargs):
        pytest.fail("O backend CPU não deve executar o teste de GPU.")

    monkeypatch.setattr(LGBMRegressor, "fit", unexpected_fit)
    check_lightgbm_device(get_models()["lightgbm"].estimator)


def test_gpu_probe_preserves_device_ids_and_does_not_modify_candidate(monkeypatch):
    observed = []

    def fit(self, features, target):
        observed.append(self.get_params())
        assert len(features) == len(target) == 64
        return self

    monkeypatch.setattr(LGBMRegressor, "fit", fit)
    candidate = get_models(device="gpu", gpu_platform_id=2, gpu_device_id=3)["lightgbm"].estimator
    check_lightgbm_device(candidate)
    assert observed[0]["device_type"] == "gpu"
    assert observed[0]["gpu_platform_id"] == 2
    assert observed[0]["gpu_device_id"] == 3
    assert observed[0]["n_estimators"] == 1
    assert candidate.n_estimators == 600


def test_unavailable_gpu_has_actionable_error_without_cpu_fallback(monkeypatch):
    calls = []

    def fail(self, features, target):
        calls.append(self.get_params()["device_type"])
        raise LightGBMError("GPU Tree Learner was not enabled in this build.")

    monkeypatch.setattr(LGBMRegressor, "fit", fail)
    with pytest.raises(ValueError, match="--device cpu.*GPU Tree Learner"):
        check_lightgbm_device(get_models(device="gpu")["lightgbm"].estimator)
    assert calls == ["gpu"]


@pytest.mark.parametrize("experiment", [False, True])
def test_train_cli_forwards_device_options_to_both_workflows(monkeypatch, experiment):
    captured = []

    def run(csv_path, output_dir, config, *args, **kwargs):
        captured.append(config)

    monkeypatch.setattr(train, "train_and_save", run)
    monkeypatch.setattr(experiments, "run_experiment", run)
    argv = ["train.py", "--device", "gpu", "--gpu-platform-id", "2", "--gpu-device-id", "3"]
    if experiment:
        argv.append("--sarima-experiment")
    monkeypatch.setattr(sys, "argv", argv)
    train.main()
    assert len(captured) == 1
    assert captured[0].device == "gpu"
    assert captured[0].gpu_platform_id == 2
    assert captured[0].gpu_device_id == 3
