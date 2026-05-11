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


@api_router.get("/ledger/{scan_id}")
async def get_ledger(scan_id: str):
    row = await db.scans.find_one({"id": scan_id}, {"_id": 0})
    if not row:
        raise HTTPException(status_code=404, detail="Scan not found")
    return row


# ============ PDF REPORT (Crack #2) ============
class ReportRequest(BaseModel):
    bpm: Optional[float] = None
    asymmetry: float = 0.0
    acoustic: Optional[dict] = None  # {intensity, status, level}
    fingerprint: Optional[dict] = None  # {pattern, blood_type}
    battery_score: int = 0
    emf_intensity: Optional[float] = None
    notes: Optional[str] = None


@api_router.post("/report")
async def generate_report(payload: ReportRequest):
    """Generate a gold-on-obsidian PDF medic report with QR code linking to the ledger."""
    from reportlab.pdfgen import canvas
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import mm
    from reportlab.lib.colors import HexColor
    import qrcode

    # 1. Persist a ledger row first so the QR can point to it
    scan_id = str(uuid.uuid4())
    ledger_doc = ScanRecord(
        id=scan_id,
        kind="report",
        payload=payload.model_dump(),
    ).model_dump()
    await db.scans.insert_one(ledger_doc)

    # Public base URL — use REACT_APP_BACKEND_URL pattern; fall back to localhost
    public_base = os.environ.get("PUBLIC_BASE_URL", "")
    if not public_base:
        # The frontend already knows its backend URL; we just need the path.
        public_base = "/api"
    qr_target = f"{public_base}/ledger/{scan_id}" if public_base.startswith("http") else f"{public_base}/ledger/{scan_id}"

    qr_img = qrcode.make(qr_target)
    qr_buf = io.BytesIO()
    qr_img.save(qr_buf, format="PNG")
    qr_buf.seek(0)

    pdf_buf = io.BytesIO()
    c = canvas.Canvas(pdf_buf, pagesize=A4)
    width, height = A4

    GOLD = HexColor("#D4AF37")
    GOLD_DIM = HexColor("#AA8C2C")
    OBSIDIAN = HexColor("#050505")
    WHITE = HexColor("#FFFFFF")
    RED = HexColor("#FF3B30")

    # Black background
    c.setFillColor(OBSIDIAN)
    c.rect(0, 0, width, height, fill=1, stroke=0)

    # Gold border frame
    c.setStrokeColor(GOLD)
    c.setLineWidth(1.2)
    c.rect(10 * mm, 10 * mm, width - 20 * mm, height - 20 * mm, fill=0, stroke=1)
    c.setLineWidth(0.4)
    c.rect(13 * mm, 13 * mm, width - 26 * mm, height - 26 * mm, fill=0, stroke=1)

    # Header
    c.setFillColor(GOLD)
    c.setFont("Times-Roman", 22)
    c.drawString(20 * mm, height - 28 * mm, "BIORACLE  V12")
    c.setFont("Courier", 8)
    c.drawString(20 * mm, height - 33 * mm, "SOVEREIGN  CLINICAL  REPORT")
    c.setFillColor(WHITE)
    c.setFont("Courier", 8)
    c.drawRightString(width - 20 * mm, height - 28 * mm, datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC"))
    c.drawRightString(width - 20 * mm, height - 33 * mm, f"SCAN ID: {scan_id[:13]}")

    # Divider
    c.setStrokeColor(GOLD_DIM)
    c.line(20 * mm, height - 38 * mm, width - 20 * mm, height - 38 * mm)

    # Sovereign Charge block
    y = height - 50 * mm
    c.setFillColor(GOLD)
    c.setFont("Courier-Bold", 9)
    c.drawString(20 * mm, y, "SOVEREIGN  CHARGE")
    c.setFillColor(RED if payload.battery_score < 30 else WHITE)
    c.setFont("Times-Roman", 36)
    c.drawString(20 * mm, y - 14 * mm, f"{payload.battery_score}%")

    # Critical banner
    critical = payload.battery_score < 30 or payload.asymmetry > 0.3 or (
        payload.acoustic and payload.acoustic.get("level") in ("Critical", "High")
    )
    if critical:
        c.setFillColor(RED)
        c.rect(70 * mm, y - 12 * mm, 110 * mm, 10 * mm, fill=1, stroke=0)
        c.setFillColor(WHITE)
        c.setFont("Courier-Bold", 10)
        c.drawCentredString(125 * mm, y - 9 * mm, "CRITICAL  SIGNAL  DETECTED")

    # Sensor table
    y = height - 80 * mm
    c.setStrokeColor(GOLD_DIM)
    c.line(20 * mm, y + 2 * mm, width - 20 * mm, y + 2 * mm)
    c.setFillColor(GOLD)
    c.setFont("Courier-Bold", 9)
    c.drawString(20 * mm, y - 4 * mm, "SENSOR  READOUT")
    c.setFont("Courier", 9)
    c.setFillColor(WHITE)
    rows = []
    if payload.bpm is not None:
        rows.append(("Heart Rate (PPG)", f"{payload.bpm:.0f} bpm"))
    rows.append(("Vascular Asymmetry", f"{payload.asymmetry:.3f}"))
    if payload.acoustic:
        rows.append(("Acoustic Intensity", f"{payload.acoustic.get('intensity', 0):.3f}"))
        rows.append(("Acoustic Status", payload.acoustic.get("status", "—")))
        rows.append(("Acoustic Level", payload.acoustic.get("level", "—")))
    if payload.fingerprint:
        rows.append(("Fingerprint Pattern", payload.fingerprint.get("pattern", "—")))
        rows.append(("Blood Type (ABO)", payload.fingerprint.get("blood_type", "—")))
    if payload.emf_intensity is not None:
        rows.append(("EMF Magnitude (µT)", f"{payload.emf_intensity:.1f}"))
    rows.append(("Sovereign Charge", f"{payload.battery_score}/100"))

    rh = 6 * mm
    for i, (k, v) in enumerate(rows):
        ry = y - 12 * mm - i * rh
        c.setFillColor(GOLD_DIM)
        c.drawString(22 * mm, ry, k.upper())
        c.setFillColor(WHITE)
        c.drawRightString(width - 22 * mm, ry, str(v))
        c.setStrokeColor(HexColor("#1a1a1a"))
        c.setLineWidth(0.2)
        c.line(20 * mm, ry - 2 * mm, width - 20 * mm, ry - 2 * mm)

    # Oracle notes
    if payload.notes:
        ny = y - 12 * mm - len(rows) * rh - 10 * mm
        c.setFillColor(GOLD)
        c.setFont("Courier-Bold", 9)
        c.drawString(20 * mm, ny, "ORACLE  INTERPRETATION")
        c.setFillColor(WHITE)
        c.setFont("Times-Italic", 10)
        # Word-wrap
        from textwrap import wrap
        for j, line in enumerate(wrap(payload.notes, 80)):
            c.drawString(20 * mm, ny - 6 * mm - j * 5 * mm, line)

    # QR code bottom-right
    from reportlab.lib.utils import ImageReader
    qr_buf.seek(0)
    qr_reader = ImageReader(qr_buf)
    qr_size = 35 * mm
    c.drawImage(qr_reader, width - 20 * mm - qr_size, 22 * mm, qr_size, qr_size, mask='auto')
    c.setFillColor(GOLD_DIM)
    c.setFont("Courier", 6)
    c.drawRightString(width - 20 * mm, 18 * mm, "SCAN FOR RAW LEDGER")

    # Footer
    c.setFillColor(GOLD_DIM)
    c.setFont("Courier", 6)
    c.drawString(20 * mm, 15 * mm, "BIORACLE V12  /  SOVEREIGN INSTRUMENT  /  NOT A SUBSTITUTE FOR MEDICAL DIAGNOSIS")

    c.showPage()
    c.save()
    pdf_buf.seek(0)

    from fastapi.responses import StreamingResponse
    return StreamingResponse(
        pdf_buf,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="bioracle-{scan_id[:8]}.pdf"',
            "X-Scan-Id": scan_id,
        },
    )


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
