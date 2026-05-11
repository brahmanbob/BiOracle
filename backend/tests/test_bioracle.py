"""BiOracle V12 Backend Tests"""
import os
import base64
import io
import pytest
import requests
from PIL import Image

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://fingerprint-abo.preview.emergentagent.com').rstrip('/')
API = f"{BASE_URL}/api"


def make_png_b64(w=64, h=64, color=128):
    img = Image.new('L', (w, h), color)
    # Add some noise/pattern
    for x in range(0, w, 4):
        for y in range(0, h):
            img.putpixel((x, y), 30)
    buf = io.BytesIO()
    img.save(buf, format='PNG')
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()


# Root
def test_root():
    r = requests.get(f"{API}/")
    assert r.status_code == 200
    data = r.json()
    assert "BiOracle V12 Sovereign API online" in data["message"]


# Acoustic
def test_acoustic_lectin():
    r = requests.post(f"{API}/analyze-acoustic", json={"intensity": 0.85, "interpret": True}, timeout=60)
    assert r.status_code == 200
    d = r.json()
    assert d["status"] == "Lectin Inflammation"
    assert d["level"] == "High"
    assert isinstance(d["battery_score"], int)
    assert isinstance(d["interpretation"], str) and len(d["interpretation"]) > 0


def test_acoustic_mmc():
    r = requests.post(f"{API}/analyze-acoustic", json={"intensity": 0.2, "interpret": False}, timeout=30)
    assert r.status_code == 200
    d = r.json()
    assert d["status"] == "MMC Stagnation"
    assert d["level"] == "Critical"
    assert d["interpretation"] is None


def test_acoustic_optimal():
    r = requests.post(f"{API}/analyze-acoustic", json={"intensity": 0.55, "interpret": False}, timeout=30)
    assert r.status_code == 200
    d = r.json()
    assert "Optimal" in d["status"]
    assert d["level"] == "Stable"


# Fingerprint
def test_fingerprint_valid():
    img_b64 = make_png_b64()
    r = requests.post(f"{API}/analyze-fingerprint", json={"image_base64": img_b64}, timeout=30)
    assert r.status_code == 200
    d = r.json()
    assert d["pattern"] in ["loop", "whorl", "arch"]
    assert d["blood_type"] in ["O", "A", "B"]
    mapping = {"loop": "O", "whorl": "A", "arch": "B"}
    assert d["blood_type"] == mapping[d["pattern"]]
    assert "confidence" in d and "ridge_density" in d


def test_fingerprint_empty():
    # Pydantic validates min_length not set, so empty triggers our 400 path
    r = requests.post(f"{API}/analyze-fingerprint", json={"image_base64": ""}, timeout=15)
    assert r.status_code == 400


# Triage
def test_triage_critical():
    r = requests.post(f"{API}/triage", json={"asymmetry": 0.5}, timeout=15)
    assert r.status_code == 200
    d = r.json()
    assert d["critical"] is True
    assert "CRITICAL" in d["status"]


def test_triage_stable():
    r = requests.post(f"{API}/triage", json={"asymmetry": 0.1}, timeout=15)
    assert r.status_code == 200
    d = r.json()
    assert d["critical"] is False
    assert "Vascular Integrity: Stable" in d["status"]


# Stealth
def test_stealth_high():
    r = requests.post(f"{API}/stealth", json={"rssi": -40}, timeout=15)
    assert r.status_code == 200
    d = r.json()
    assert d["shield_active"] is True


def test_stealth_optimized():
    r = requests.post(f"{API}/stealth", json={"rssi": -80}, timeout=15)
    assert r.status_code == 200
    d = r.json()
    assert d["shield_active"] is False
    assert "Stealth Optimized" in d["status"]


# History
def test_history():
    r = requests.get(f"{API}/history", timeout=15)
    assert r.status_code == 200
    assert isinstance(r.json(), list)
