from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI(title="BiOracle Sovereign Ledger")
api_router = APIRouter(prefix="/api")


# ============================================================
# Models
# ============================================================

class StatusCheck(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class StatusCheckCreate(BaseModel):
    client_name: str


class AcousticPayload(BaseModel):
    state: str
    bpm: float
    spectral_centroid: float
    irritation_index: float


class BloodPayload(BaseModel):
    group: str
    rh: str
    confidence: float
    rationale: Optional[str] = None


class VerdictPayload(BaseModel):
    level: str
    score: float
    flags: List[str]
    critical: bool
    directive: str
    timestamp: str


class TriageScanIn(BaseModel):
    """Raw sensor data + verdict, written to the sovereign ledger."""
    lectin: float
    vascular_asymmetry: float
    emf: float
    acoustic: Optional[AcousticPayload] = None
    heart_rate: Optional[float] = 0.0
    blood: Optional[BloodPayload] = None
    verdict: VerdictPayload
    raw: Optional[Dict[str, Any]] = None  # optional PPG waveform, mag samples, etc.


class TriageScanOut(BaseModel):
    id: str
    created_at: str
    critical: bool
    level: str
    ledger_url: str


# ============================================================
# Routes
# ============================================================

@api_router.get("/")
async def root():
    return {"message": "BiOracle ledger online", "service": "sovereign-triage", "version": "0.1.0"}


@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_obj = StatusCheck(**input.model_dump())
    doc = status_obj.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    await db.status_checks.insert_one(doc)
    return status_obj


@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    status_checks = await db.status_checks.find({}, {"_id": 0}).to_list(1000)
    for check in status_checks:
        if isinstance(check.get('timestamp'), str):
            check['timestamp'] = datetime.fromisoformat(check['timestamp'])
    return status_checks


@api_router.post("/triage/scan", response_model=TriageScanOut)
async def create_triage_scan(scan: TriageScanIn):
    """Commit a sovereign scan to the ledger. Returns an id that the QR code on the
    Gold-on-Obsidian PDF report will point at."""
    scan_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": scan_id,
        "created_at": now,
        "lectin": scan.lectin,
        "vascular_asymmetry": scan.vascular_asymmetry,
        "emf": scan.emf,
        "heart_rate": scan.heart_rate or 0.0,
        "acoustic": scan.acoustic.model_dump() if scan.acoustic else None,
        "blood": scan.blood.model_dump() if scan.blood else None,
        "verdict": scan.verdict.model_dump(),
        "raw": scan.raw,
    }
    await db.triage_scans.insert_one(doc)
    return TriageScanOut(
        id=scan_id,
        created_at=now,
        critical=scan.verdict.critical,
        level=scan.verdict.level,
        ledger_url=f"/api/ledger/{scan_id}",
    )


@api_router.get("/triage/scan")
async def list_triage_scans(limit: int = 50):
    docs = await db.triage_scans.find({}, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return docs


@api_router.get("/ledger/{scan_id}")
async def get_ledger_entry(scan_id: str):
    """Public ledger endpoint that the QR code on the medic-handoff PDF resolves to."""
    doc = await db.triage_scans.find_one({"id": scan_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="ledger entry not found")
    return doc


# ============================================================
# App wiring
# ============================================================

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
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
