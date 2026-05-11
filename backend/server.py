from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import uuid
import base64
import io
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
from datetime import datetime, timezone

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Emergent LLM key
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', '')

app = FastAPI(title="BiOracle V12 Sovereign API")
api_router = APIRouter(prefix="/api")


# ============ MODELS ============
class StatusCheck(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class StatusCheckCreate(BaseModel):
    client_name: str


class AcousticInput(BaseModel):
    intensity: float = Field(..., ge=0.0, le=1.0, description="Normalized acoustic intensity 0-1")
    interpret: bool = Field(default=True)


class AcousticResult(BaseModel):
    intensity: float
    status: str
    level: str
    battery_score: int
    interpretation: Optional[str] = None


class FingerprintInput(BaseModel):
    image_base64: str = Field(..., description="Base64-encoded fingerprint image (data URL or raw)")


class FingerprintResult(BaseModel):
    pattern: str  # loop | whorl | arch
    blood_type: str  # O | A | B
    confidence: float
    ridge_density: float


class TriageInput(BaseModel):
    asymmetry: float = Field(..., ge=0.0, le=1.0)


class TriageResult(BaseModel):
    asymmetry: float
    status: str
    critical: bool


class StealthInput(BaseModel):
    rssi: float


class StealthResult(BaseModel):
    rssi: float
    status: str
    shield_active: bool


class ScanRecord(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    kind: str  # acoustic | fingerprint | triage | stealth
    payload: dict
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


# ============ SOVEREIGN LOGIC (mirrors SovereignLogic.ts) ============
def analyze_acoustics_rule(intensity: float) -> dict:
    if intensity > 0.8:
        return {"status": "Lectin Inflammation", "level": "High"}
    if intensity < 0.3:
        return {"status": "MMC Stagnation", "level": "Critical"}
    return {"status": "Digestive Rhythm: Optimal", "level": "Stable"}


def infer_blood_type_rule(pattern: str) -> str:
    mapping = {"loop": "O", "whorl": "A", "arch": "B"}
    return mapping.get(pattern, "O")


def emergency_triage_rule(asymmetry: float) -> dict:
    if asymmetry > 0.3:
        return {"status": "CRITICAL: Internal Hemorrhage Suspected", "critical": True}
    return {"status": "Vascular Integrity: Stable", "critical": False}


def stealth_mode_rule(rssi: float) -> dict:
    if rssi > -50:
        return {"status": "EMF Signature High - Shielding Active", "shield_active": True}
    return {"status": "Stealth Optimized", "shield_active": False}


def acoustic_battery_score(intensity: float, status: str) -> int:
    # Optimal middle band -> high battery. Extremes -> low battery.
    if "Optimal" in status:
        # Distance from center 0.55 (range ~0.3-0.8)
        center = 0.55
        return max(60, int(100 - abs(intensity - center) * 120))
    if "Lectin" in status:
        return max(15, int(50 - (intensity - 0.8) * 200))
    # MMC stagnation
    return max(10, int(40 + intensity * 100))  # lower intensity -> lower score


# ============ FINGERPRINT IMAGE HEURISTIC ============
def analyze_fingerprint_image(image_b64: str) -> dict:
    """Naive heuristic: compute brightness variance & edge density of the image
    to classify into loop/whorl/arch. Uses PIL+numpy already in env."""
    try:
        # Strip data URL prefix if present
        if "," in image_b64:
            image_b64 = image_b64.split(",", 1)[1]
        raw = base64.b64decode(image_b64)
        from PIL import Image
        import numpy as np

        img = Image.open(io.BytesIO(raw)).convert("L")
        # Resize for fast analysis
        img = img.resize((128, 128))
        arr = np.array(img, dtype=np.float32) / 255.0

        # Ridge density: standard deviation of gradient magnitudes
        gx = np.diff(arr, axis=1)
        gy = np.diff(arr, axis=0)
        ridge_density = float(np.std(gx[:-1, :]) + np.std(gy[:, :-1])) / 2.0

        # Radial symmetry: compare quadrants
        h, w = arr.shape
        q1 = arr[: h // 2, : w // 2].mean()
        q2 = arr[: h // 2, w // 2 :].mean()
        q3 = arr[h // 2 :, : w // 2].mean()
        q4 = arr[h // 2 :, w // 2 :].mean()
        symmetry = 1.0 - float(np.std([q1, q2, q3, q4]))

        # Classification heuristic
        if ridge_density > 0.10 and symmetry > 0.97:
            pattern = "whorl"
            conf = 0.78
        elif ridge_density < 0.06:
            pattern = "arch"
            conf = 0.72
        else:
            pattern = "loop"
            conf = 0.81

        return {
            "pattern": pattern,
            "confidence": conf,
            "ridge_density": round(ridge_density, 4),
        }
    except Exception as e:
        logger.warning(f"Fingerprint analysis fallback: {e}")
        # Deterministic fallback based on payload hash
        import hashlib
        h = int(hashlib.md5(image_b64.encode()).hexdigest(), 16)
        pattern = ["loop", "whorl", "arch"][h % 3]
        return {"pattern": pattern, "confidence": 0.55, "ridge_density": 0.0}


# ============ ROUTES ============
@api_router.get("/")
async def root():
    return {"message": "BiOracle V12 Sovereign API online", "version": "12.0"}


@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_obj = StatusCheck(**input.model_dump())
    doc = status_obj.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    await db.status_checks.insert_one(doc)
    return status_obj


@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    rows = await db.status_checks.find({}, {"_id": 0}).to_list(1000)
    for c in rows:
        if isinstance(c['timestamp'], str):
            c['timestamp'] = datetime.fromisoformat(c['timestamp'])
    return rows


@api_router.post("/analyze-acoustic", response_model=AcousticResult)
async def analyze_acoustic(payload: AcousticInput):
    rule = analyze_acoustics_rule(payload.intensity)
    battery = acoustic_battery_score(payload.intensity, rule["status"])
    interpretation = None
    if payload.interpret:
        interpretation = await gemini_interpret_acoustic(
            payload.intensity, rule["status"], rule["level"]
        )
    result = AcousticResult(
        intensity=payload.intensity,
        status=rule["status"],
        level=rule["level"],
        battery_score=battery,
        interpretation=interpretation,
    )
    await db.scans.insert_one(
        ScanRecord(kind="acoustic", payload=result.model_dump()).model_dump()
    )
    return result


@api_router.post("/analyze-fingerprint", response_model=FingerprintResult)
async def analyze_fingerprint(payload: FingerprintInput):
    if not payload.image_base64:
        raise HTTPException(status_code=400, detail="image_base64 required")
    analysis = analyze_fingerprint_image(payload.image_base64)
    blood = infer_blood_type_rule(analysis["pattern"])
    result = FingerprintResult(
        pattern=analysis["pattern"],
        blood_type=blood,
        confidence=analysis["confidence"],
        ridge_density=analysis["ridge_density"],
    )
    await db.scans.insert_one(
        ScanRecord(kind="fingerprint", payload=result.model_dump()).model_dump()
    )
    return result


@api_router.post("/triage", response_model=TriageResult)
async def triage(payload: TriageInput):
    r = emergency_triage_rule(payload.asymmetry)
    result = TriageResult(asymmetry=payload.asymmetry, status=r["status"], critical=r["critical"])
    await db.scans.insert_one(ScanRecord(kind="triage", payload=result.model_dump()).model_dump())
    return result


@api_router.post("/stealth", response_model=StealthResult)
async def stealth(payload: StealthInput):
    r = stealth_mode_rule(payload.rssi)
    result = StealthResult(rssi=payload.rssi, status=r["status"], shield_active=r["shield_active"])
    await db.scans.insert_one(ScanRecord(kind="stealth", payload=result.model_dump()).model_dump())
    return result


@api_router.get("/history")
async def history(limit: int = 20):
    rows = await db.scans.find({}, {"_id": 0}).sort("timestamp", -1).to_list(limit)
    return rows


# ============ GEMINI INTERPRETATION ============
async def gemini_interpret_acoustic(intensity: float, status: str, level: str) -> str:
    """Use Gemini via emergentintegrations to produce a sovereign-tone interpretation."""
    if not EMERGENT_LLM_KEY:
        return f"[Local] {status} at intensity {intensity:.2f} ({level})."
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage

        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"bioracle-{uuid.uuid4().hex[:8]}",
            system_message=(
                "You are BiOracle V12, a sovereign biometric oracle. Speak with precise, "
                "calm authority — 2-3 short sentences. Reference the gut's enteric nervous "
                "system, lectin response, and migrating motor complex (MMC) when relevant. "
                "Never prescribe medication. Output plain text only."
            ),
        ).with_model("gemini", "gemini-2.5-flash")

        prompt = (
            f"Stomach acoustic scan complete.\n"
            f"Intensity: {intensity:.2f} (0-1 scale)\n"
            f"Rule-based status: {status}\n"
            f"Severity level: {level}\n\n"
            f"Provide a brief sovereign interpretation and one supportive ritual or breath/posture cue."
        )
        msg = UserMessage(text=prompt)
        response = await chat.send_message(msg)
        return str(response).strip()
    except Exception as e:
        logger.error(f"Gemini interpretation failed: {e}")
        return f"[Oracle silent] {status} at intensity {intensity:.2f}. ({level})"


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
)
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
