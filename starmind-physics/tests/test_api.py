"""HTTP API tests. Flux-heavy cases are marked aep8 and skip when it is absent."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

fastapi = pytest.importorskip("fastapi")
from fastapi.testclient import TestClient

from starmind_physics.api import create_app
from starmind_physics.jsonutil import json_safe

SAMPLE = Path(__file__).parent / "data" / "sample.oem"


def test_json_safe_nonfinite():
    import math

    import numpy as np

    assert json_safe({"a": math.inf, "b": math.nan, "c": np.float64(1.5)}) == {
        "a": None,
        "b": None,
        "c": 1.5,
    }


@pytest.fixture
def data_dir(tmp_path: Path) -> Path:
    pareto = {
        "pareto_front": [
            {
                "id": "P01",
                "config": {
                    "altitude_km": 800,
                    "inclination": "sso",
                    "ltan_hours": 6,
                    "shield_mm_Al": 5,
                    "chip_preset": "commercial",
                },
                "lifetime_years": 9.0,
                "mean_power_kW": 60.0,
                "shielding_cost": 100.0,
                "limiting_mode": "tid",
            }
        ],
        "evaluated": [],
        "disclaimer": "test",
    }
    saa = {
        "altitude_km": 550.0,
        "particle": "p",
        "solar": "max",
        "lat_deg": [-30.0, 0.0],
        "lon_deg": [-45.0, 0.0],
        "flux_cm2_s": [[10.0, 1.0], [2.0, 0.5]],
        "flux_cm2_s_max": 10.0,
    }
    sensitivity = {
        "baseline": {"lifetime_years": 9.0},
        "bars": [{"label": "shield +3 mm Al", "delta_years": 1.0}],
        "disclaimer": "test",
    }
    (tmp_path / "pareto_front.json").write_text(json.dumps(pareto), encoding="utf-8")
    (tmp_path / "saa_flux_grid.json").write_text(json.dumps(saa), encoding="utf-8")
    (tmp_path / "sensitivity.json").write_text(json.dumps(sensitivity), encoding="utf-8")
    return tmp_path


@pytest.fixture
def client(data_dir: Path):
    app = create_app(data_dir)
    with TestClient(app) as test_client:
        yield test_client


def test_health_params_and_chips(client: TestClient):
    health = client.get("/api/health")
    assert health.status_code == 200
    assert health.json()["ok"] is True

    params = client.get("/api/params")
    assert params.status_code == 200
    assert params.json()["defaults"]["altitude_km"] == 800.0

    chips = client.get("/api/chips")
    assert chips.status_code == 200
    ids = {row["id"] for row in chips.json()["chips"]}
    assert "google_trillium_tpu_v6e" in ids
    assert "bae_rad750" in ids


def test_track_shape(client: TestClient):
    response = client.get("/api/track", params={"altitude_km": 800, "inclination": "sso", "n_samples": 32})
    assert response.status_code == 200
    body = response.json()
    assert len(body["lat_deg"]) == 32
    assert len(body["lon_deg"]) == len(body["times_s"]) == 32
    assert body["alt_km"] == 800.0
    assert body["inclination_deg"] == pytest.approx(98.603, abs=0.01)
    assert 90 < body["period_min"] < 110
    assert body["source"] == "ground_track"


def test_track_rejects_bad_altitude(client: TestClient):
    response = client.get("/api/track", params={"altitude_km": 100})
    assert response.status_code == 400


def test_optimize_and_saa_and_sensitivity_from_files(client: TestClient):
    pareto = client.get("/api/optimize")
    assert pareto.status_code == 200
    assert pareto.json()["pareto_front"][0]["id"] == "P01"

    grid = client.get("/api/saa-grid")
    assert grid.status_code == 200
    assert grid.json()["flux_cm2_s_max"] == 10.0

    sense = client.get("/api/sensitivity")
    assert sense.status_code == 200
    assert sense.json()["bars"][0]["label"].startswith("shield")


def test_sensitivity_missing(tmp_path: Path):
    app = create_app(tmp_path)
    with TestClient(app) as test_client:
        response = test_client.get("/api/sensitivity")
    assert response.status_code == 404


def test_evaluate_strips_oem_path(client: TestClient, monkeypatch: pytest.MonkeyPatch):
    seen: dict = {}

    def fake(config):
        seen.update(config)
        return {
            "lifetime_years": 1.25,
            "mean_power_kW": 10.0,
            "radiator_area_m2": 4.0,
            "shield_mass_kg": 2.0,
            "limiting_mode": "tid",
            "assumptions_note": "estimated",
            "thermal": {"lifetime_thermal_years": float("inf"), "delta_T_K": 0.0, "cycles_per_year": 0.0},
        }

    monkeypatch.setattr("starmind_physics.api.evaluate", fake)
    response = client.post(
        "/api/evaluate",
        json={"altitude_km": 800, "oem_path": "/etc/passwd", "chip_preset": "commercial"},
    )
    assert response.status_code == 200
    body = response.json()
    assert "oem_path" not in seen
    assert body["value_status"] == "derived"
    assert body["lifetime_years"] == 1.25
    assert body["thermal"]["lifetime_thermal_years"] is None


def test_evaluate_unknown_chip(client: TestClient):
    response = client.post("/api/evaluate", json={"chip_id": "not-a-chip"})
    assert response.status_code == 400
    assert "chip" in response.json()["detail"].lower() or "Unknown" in response.json()["detail"]


def test_evaluate_oem_rejects_bad_text(client: TestClient):
    response = client.post(
        "/api/evaluate-oem",
        files={"file": ("bad.oem", b"this is not an oem", "text/plain")},
        data={"config": "{}"},
    )
    assert response.status_code == 422


def test_evaluate_oem_returns_track(client: TestClient, monkeypatch: pytest.MonkeyPatch):
    def fake(_config):
        return {
            "lifetime_years": 2.0,
            "mean_power_kW": 3.0,
            "radiator_area_m2": 1.0,
            "shield_mass_kg": 1.0,
            "limiting_mode": "power",
            "assumptions_note": "window mean",
        }

    monkeypatch.setattr("starmind_physics.api.evaluate", fake)
    response = client.post(
        "/api/evaluate-oem",
        files={"file": ("sample.oem", SAMPLE.read_bytes(), "text/plain")},
        data={"config": json.dumps({"altitude_km": 800, "chip_preset": "commercial"})},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["result"]["value_status"] == "derived"
    assert body["result"]["lifetime_years"] == 2.0
    assert len(body["track"]["lat_deg"]) >= 2
    assert body["track"]["source"] == "oem"
    assert "OEM window" in body["disclaimer"] or "window" in body["disclaimer"]


@pytest.mark.aep8
def test_evaluate_live(client: TestClient):
    pytest.importorskip("aep8")
    response = client.post(
        "/api/evaluate",
        json={
            "altitude_km": 800,
            "inclination": "sso",
            "ltan_hours": 6,
            "shield_mm_Al": 5,
            "chip_preset": "commercial",
            "n_samples": 40,
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["value_status"] == "derived"
    assert body["lifetime_years"] > 0
    assert body["limiting_mode"]
    assert "assumptions_note" in body
    assert "oem_path" not in body.get("config_resolved", {})
