"""
aitutor.py
==========
LiveSage AI Tutor — Autonomous PDF-based teaching agent.

Usage (PDF Processor mode):
    python aitutor.py --process-pdf <path_to_pdf> [--session-id <id>]

Usage (LiveKit Agent mode):
    python aitutor.py start   ← runs as a LiveKit worker
"""

# ── Windows event-loop fix (must be before all imports) ──────────────────────
import sys
import asyncio

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

# ── Standard library ─────────────────────────────────────────────────────────
import argparse
import json
import logging
import os
import re
import textwrap
import time
import uuid
from pathlib import Path
from typing import Optional

# ── Third-party ───────────────────────────────────────────────────────────────
from dotenv import load_dotenv

load_dotenv(".env.local")

# ── LiveKit ───────────────────────────────────────────────────────────────────
from livekit import agents
from livekit.agents import (
    Agent,
    AgentServer,
    AgentSession,
    cli,
)
from livekit.plugins import google

# ── Bey Avatar (optional) ────────────────────────────────────────────────────
try:
    from livekit.plugins import bey
    BEY_AVAILABLE = True
except ImportError:
    BEY_AVAILABLE = False
    print("[WARNING] 'livekit-plugins-bey' not installed — avatar disabled.")

# ── Logging ───────────────────────────────────────────────────────────────────
logger = logging.getLogger("aitutor")
logging.basicConfig(level=logging.INFO)

# ── Paths ─────────────────────────────────────────────────────────────────────
_BASE_DIR      = Path(__file__).parent.resolve()
_UPLOADS_DIR   = _BASE_DIR / "uploads"
_PDF_IMAGES_DIR= _BASE_DIR / "pdf_images"
_SESSIONS_DIR  = _BASE_DIR / "tutor_sessions"
_CHROMA_DIR    = _BASE_DIR / "chroma_db"

for _d in [_UPLOADS_DIR, _PDF_IMAGES_DIR, _SESSIONS_DIR, _CHROMA_DIR]:
    _d.mkdir(exist_ok=True)


# ══════════════════════════════════════════════════════════════════════════════
# SECTION 1: PDF PROCESSOR
# ══════════════════════════════════════════════════════════════════════════════

def _emit_progress(step: str, message: str, progress: int, session_id: str) -> None:
    """Stream a JSON progress line to stdout for the Next.js route to read."""
    payload = json.dumps({
        "type": "progress",
        "step": step,
        "message": message,
        "progress": progress,
        "session_id": session_id,
    })
    print(payload, flush=True)


def _extract_chapter_title(text: str) -> Optional[str]:
    """Heuristic: detect chapter headings at the start of a text block."""
    lines = text.strip().splitlines()
    for line in lines[:5]:
        line = line.strip()
        if re.match(r"^(chapter\s+\d+|section\s+\d+|\d+\.)\s+.+", line, re.IGNORECASE):
            return line[:120]
        if len(line) < 80 and line.isupper() and len(line) > 5:
            return line[:120]
    return None


def _chunk_text(pages_data: list[dict]) -> list[dict]:
    """
    Split page text into ~1000-word chunks preserving page metadata.
    One chunk per page when possible; split only if page is very long.
    """
    chunks: list[dict] = []
    chunk_id = 0
    WORDS_PER_CHUNK = 1000  # ~1000 tokens per chunk for comprehensive teaching

    for page in pages_data:
        page_num: int = page["page_num"]
        text: str = page["text"].strip()
        image_paths: list[str] = page.get("image_paths", [])
        chapter_title: Optional[str] = page.get("chapter_title")
        page_image: Optional[str] = page.get("page_image")

        if not text and image_paths:
            text = f"[Page {page_num} — Diagram / Figure]"

        if not text:
            continue

        words = text.split()
        for i in range(0, max(1, len(words)), WORDS_PER_CHUNK):
            chunk_words = words[i: i + WORDS_PER_CHUNK]
            chunk_text = " ".join(chunk_words)
            # Attach images only to first chunk of the page
            chunk_images = image_paths if i == 0 else []

            chunks.append({
                "id": f"chunk_{chunk_id:04d}",
                "text": chunk_text,
                "page_num": page_num,
                "chapter_title": chapter_title,
                "image_paths": chunk_images,
                "page_image": page_image,
            })
            chunk_id += 1

    return chunks


class DirectEmbeddingFunction:
    """Fast direct storage — no heavy transformer model."""
    name = "direct-storage"

    def __call__(self, input: list[str]) -> list[list[float]]:
        return [[0.0] for _ in input]


def process_pdf(pdf_path: str, session_id: str) -> dict:
    """
    Full PDF processing pipeline.
    Returns the session metadata dict.
    """
    try:
        import fitz  # PyMuPDF
    except ImportError:
        raise RuntimeError("PyMuPDF is not installed. Run: uv add pymupdf")

    try:
        import chromadb
    except ImportError:
        raise RuntimeError("ChromaDB is not installed. Run: uv add chromadb")

    pdf_path_obj = Path(pdf_path)
    if not pdf_path_obj.exists():
        raise FileNotFoundError(f"PDF not found: {pdf_path}")

    session_images_dir = _PDF_IMAGES_DIR / session_id
    session_images_dir.mkdir(exist_ok=True)

    # Step 1: Open PDF
    _emit_progress("extracting_text", "Extracting text from PDF...", 10, session_id)
    doc = fitz.open(str(pdf_path_obj))
    total_pages = len(doc)
    logger.info("[aitutor] PDF opened: %s pages", total_pages)

    # Step 2: Extract text + images + render page images
    _emit_progress("extracting_images", "Extracting images from PDF...", 25, session_id)
    pages_data: list[dict] = []

    for page_num in range(total_pages):
        page = doc[page_num]
        text = page.get_text("text")

        # Extract embedded images
        image_paths: list[str] = []
        for img_index, img in enumerate(page.get_images(full=True)):
            xref = img[0]
            try:
                base_image = doc.extract_image(xref)
                img_bytes = base_image["image"]
                img_ext = base_image.get("ext", "png")
                img_filename = f"page{page_num + 1}_img{img_index + 1}.{img_ext}"
                img_path = session_images_dir / img_filename
                with open(img_path, "wb") as f:
                    f.write(img_bytes)
                image_paths.append(f"{session_id}/{img_filename}")
            except Exception as exc:
                logger.warning("[aitutor] Failed to extract image: %s", exc)

        # Render full page as PNG for frontend display
        page_image_path: Optional[str] = None
        try:
            pix = page.get_pixmap(dpi=150)
            page_img_filename = f"pdf_page_{page_num + 1}.png"
            page_img_path = session_images_dir / page_img_filename
            pix.save(str(page_img_path))
            page_image_path = f"{session_id}/{page_img_filename}"
        except Exception as exc:
            logger.warning("[aitutor] Failed to render page image: %s", exc)

        pages_data.append({
            "page_num": page_num + 1,
            "text": text,
            "image_paths": image_paths,
            "page_image": page_image_path,
            "chapter_title": _extract_chapter_title(text),
        })

    doc.close()
    logger.info("[aitutor] Extracted %d pages", total_pages)

    # Step 3: Chunk text
    _emit_progress("chunking", "Splitting text into chunks...", 40, session_id)
    chunks = _chunk_text(pages_data)
    logger.info("[aitutor] Created %d chunks", len(chunks))

    # Step 4: Store in ChromaDB
    _emit_progress("saving_chromadb", "Saving to ChromaDB...", 65, session_id)
    chroma_client = chromadb.PersistentClient(path=str(_CHROMA_DIR))
    collection_name = f"tutor_{session_id}"

    try:
        chroma_client.delete_collection(collection_name)
    except Exception:
        pass

    collection = chroma_client.create_collection(
        name=collection_name,
        embedding_function=DirectEmbeddingFunction(),
        metadata={"hnsw:space": "cosine"},
    )

    BATCH_SIZE = 50
    for i in range(0, len(chunks), BATCH_SIZE):
        batch = chunks[i: i + BATCH_SIZE]
        collection.add(
            ids=[c["id"] for c in batch],
            documents=[c["text"] for c in batch],
            metadatas=[
                {
                    "page_num": c["page_num"],
                    "chapter_title": c.get("chapter_title") or "",
                    "image_paths": json.dumps(c.get("image_paths", [])),
                    "page_image": c.get("page_image") or "",
                }
                for c in batch
            ],
        )

    logger.info("[aitutor] ChromaDB collection '%s' created with %d chunks", collection_name, len(chunks))

    # Step 5: Save session metadata
    _emit_progress("saving_metadata", "Saving session metadata...", 90, session_id)

    session_meta = {
        "session_id": session_id,
        "pdf_name": pdf_path_obj.name,
        "total_pages": total_pages,
        "total_chunks": len(chunks),
        "collection_name": collection_name,
        "created_at": time.time(),
        "chunks": chunks,
        "chunks_summary": [
            {
                "id": c["id"],
                "page_num": c["page_num"],
                "chapter_title": c.get("chapter_title"),
                "image_paths": c.get("image_paths", []),
                "page_image": c.get("page_image"),
                "text_preview": c["text"][:120],
            }
            for c in chunks
        ],
    }

    session_file = _SESSIONS_DIR / f"{session_id}.json"
    with open(session_file, "w", encoding="utf-8") as f:
        json.dump(session_meta, f, indent=2)

    _emit_progress("ready", "Ready to Teach!", 100, session_id)
    logger.info("[aitutor] Session saved: %s", session_file)
    return session_meta


# ══════════════════════════════════════════════════════════════════════════════
# SECTION 2: LIVEKIT AGENT
# ══════════════════════════════════════════════════════════════════════════════

async def _publish(room, payload: dict) -> None:
    """Send JSON payload to the frontend via the LiveKit data channel."""
    if room is None:
        return
    try:
        data = json.dumps(payload).encode("utf-8")
        await room.local_participant.publish_data(data, reliable=True, topic="agent-ui")
    except Exception as exc:
        logger.warning("[aitutor] publish error: %s", exc)


def _load_session(session_id: str) -> Optional[dict]:
    session_file = _SESSIONS_DIR / f"{session_id}.json"
    if not session_file.exists():
        logger.error("[aitutor] Session file not found: %s", session_file)
        return None
    with open(session_file, encoding="utf-8") as f:
        return json.load(f)


def _get_chunks_from_chroma(collection_name: str) -> list[dict]:
    """Retrieve all chunks from ChromaDB in order."""
    try:
        import chromadb
    except ImportError:
        return []

    try:
        client = chromadb.PersistentClient(path=str(_CHROMA_DIR))
        collection = client.get_collection(name=collection_name)
        results = collection.get(include=["documents", "metadatas"])

        chunks = []
        ids   = results.get("ids", [])
        docs  = results.get("documents", [])
        metas = results.get("metadatas", [])

        for cid, doc, meta in zip(ids, docs, metas):
            chunks.append({
                "id": cid,
                "text": doc,
                "page_num": meta.get("page_num", 0),
                "chapter_title": meta.get("chapter_title", ""),
                "image_paths": json.loads(meta.get("image_paths", "[]")),
                "page_image": meta.get("page_image") or None,
            })

        chunks.sort(key=lambda c: c["id"])
        logger.info("[aitutor] Loaded %d chunks from ChromaDB", len(chunks))
        return chunks
    except Exception as exc:
        logger.error("[aitutor] Failed to load ChromaDB chunks: %s", exc)
        return []


async def _wait_idle(session: AgentSession, max_wait: float = 120.0) -> None:
    """Wait until the agent finishes speaking."""
    waited = 0.0
    interval = 0.5
    while waited < max_wait:
        try:
            state = str(getattr(session, "agent_state", "") or "")
            if state not in ("speaking", "thinking"):
                return
        except Exception:
            return
        await asyncio.sleep(interval)
        waited += interval


async def _wait_for_session_ready(session: AgentSession, timeout: float = 60.0) -> bool:
    """
    Poll until the AgentSession has a non-empty agent_state,
    which indicates the Gemini Realtime WebSocket is connected
    and generate_reply() calls will succeed.
    Returns True if ready, False if timed out.
    """
    start = asyncio.get_event_loop().time()
    while asyncio.get_event_loop().time() - start < timeout:
        state = str(getattr(session, "agent_state", "") or "")
        if state and state.lower() not in ("", "none"):
            logger.info("[AiTutor] Session ready (state=%s).", state)
            return True
        await asyncio.sleep(0.5)
    logger.warning("[AiTutor] Session did not become ready within %.0fs.", timeout)
    return False


def _collect_all_pages(chunks: list[dict], session_id: Optional[str]) -> list[dict]:
    """Build sorted list of {pageNum, pageImage} from chunks + filesystem."""
    seen: set = set()
    pages: list = []

    for c in chunks:
        pimg = c.get("page_image")
        pnum = c.get("page_num", 0)
        if pimg and pnum not in seen:
            seen.add(pnum)
            pages.append({"pageNum": pnum, "pageImage": pimg})

    # Filesystem fallback — pick up any rendered images not in metadata
    if session_id:
        img_dir = _PDF_IMAGES_DIR / session_id
        if img_dir.exists():
            for pfile in sorted(img_dir.glob("pdf_page_*.png")):
                m = re.search(r"pdf_page_(\d+)\.png$", pfile.name)
                if m:
                    pnum = int(m.group(1))
                    if pnum not in seen:
                        seen.add(pnum)
                        pages.append({"pageNum": pnum, "pageImage": f"{session_id}/{pfile.name}"})

    pages.sort(key=lambda x: x["pageNum"])
    return pages


# ── The AI Tutor Agent ────────────────────────────────────────────────────────

class AiTutorAgent(Agent):
    """
    Autonomous AI Tutor.

    Teaching strategy (driven entirely from Python):
    1. PDF pages published to frontend immediately.
    2. For each chunk: publish page → ask model to explain chunk text → wait → next.
    3. No manual tool calls — Python controls pacing 100%.
    """

    def __init__(self, room, session_id: str):
        self._room       = room
        self._session_id = session_id
        self._chunks: list[dict] = []
        self._idx = 0

        model_name = os.getenv("AI_TUTOR_MODEL", "gemini-2.5-flash-native-audio-preview-12-2025")
        super().__init__(
            llm=google.realtime.RealtimeModel(
                model=model_name,
                voice="Puck",
            ),
            instructions=textwrap.dedent("""\
                You are Professor Sage, a clear and engaging AI professor.
                You explain material from a PDF textbook step by step.
                Always speak in a warm, natural teaching voice.
                When given RAW SOURCE TEXT, explain it in simple language — do NOT read it word-for-word.
                Use real-world analogies. Keep each explanation focused and clear.
                After each section, say briefly: "Let's move to the next part." then stop.
            """),
        )


# ── Server / Session Entry Point ───────────────────────────────────────────────

server = AgentServer()


@server.rtc_session(agent_name="ai-tutor-agent")
async def run_ai_tutor_session(ctx: agents.JobContext):
    room = ctx.room
    logger.info("[AiTutor] Joined room: %s", room.name)

    await asyncio.sleep(0.5)

    # ── Retrieve session_id from participant metadata ──────────────────────────
    session_id: Optional[str] = None
    for participant in room.remote_participants.values():
        try:
            meta = json.loads(participant.metadata or "{}")
            session_id = meta.get("tutorSessionId") or meta.get("session_id")
            if session_id:
                logger.info("[AiTutor] Got session_id from participant: %s", session_id)
                break
        except Exception:
            pass

    # Fallback: use most-recent session file
    if not session_id:
        session_files = sorted(
            _SESSIONS_DIR.glob("*.json"),
            key=lambda p: p.stat().st_mtime,
            reverse=True,
        )
        if session_files:
            session_id = session_files[0].stem
            logger.info("[AiTutor] Using latest session_id: %s", session_id)

    # ── Load session metadata + chunks ────────────────────────────────────────
    session_meta = _load_session(session_id) if session_id else None
    chunks: list[dict] = []

    if session_meta:
        collection_name = session_meta.get("collection_name", "")
        if collection_name:
            chunks = _get_chunks_from_chroma(collection_name)
        if not chunks and "chunks" in session_meta:
            chunks = session_meta["chunks"]
        elif not chunks and "chunks_summary" in session_meta:
            chunks = [
                {
                    "id": c.get("id", f"chunk_{i:04d}"),
                    "text": c.get("text") or c.get("text_preview", ""),
                    "page_num": c.get("page_num", 1),
                    "chapter_title": c.get("chapter_title", ""),
                    "image_paths": c.get("image_paths", []),
                    "page_image": c.get("page_image"),
                }
                for i, c in enumerate(session_meta["chunks_summary"])
            ]
        logger.info("[AiTutor] Loaded %d chunks", len(chunks))
    else:
        logger.warning("[AiTutor] No session metadata — teaching empty.")

    # ── Create agent ──────────────────────────────────────────────────────────
    agent = AiTutorAgent(room=room, session_id=session_id or "unknown")
    agent._chunks = chunks

    # ── Start Bey avatar (optional) ───────────────────────────────────────────
    session = AgentSession()
    avatar_id = os.getenv("AI_TUTOR_AVATAR_ID") or os.getenv("BEY_AVATAR_ID")
    if BEY_AVAILABLE and avatar_id:
        try:
            avatar = bey.AvatarSession(avatar_id=avatar_id)
            await avatar.start(session, room=room)
            logger.info("[AiTutor] Bey avatar attached.")
        except Exception as exc:
            logger.error("[AiTutor] Bey avatar failed: %s", exc)

    # ── Connect room ──────────────────────────────────────────────────────────
    await ctx.connect()
    logger.info("[AiTutor] Room connected.")

    # ── Build all-pages list from chunks + filesystem ─────────────────────────
    all_pages = _collect_all_pages(chunks, session_id)
    pdf_name  = session_meta.get("pdf_name", "your document") if session_meta else "your document"

    # ── Immediately publish full PDF to frontend ───────────────────────────────
    if all_pages:
        await _publish(room, {
            "type": "tutor_pdf_ready",
            "pdfName": pdf_name,
            "totalPages": session_meta.get("total_pages", len(all_pages)) if session_meta else len(all_pages),
            "totalChunks": len(chunks),
            "allPages": all_pages,
        })
        logger.info("[AiTutor] Published %d PDF pages to frontend.", len(all_pages))

    # Also set page 1 as initial teaching page
    if chunks:
        fc = chunks[0]
        await _publish(room, {
            "type": "tutor_whiteboard",
            "status": "starting",
            "lessonTitle": fc.get("chapter_title") or "Introduction",
            "chunkIndex": 0,
            "totalChunks": len(chunks),
            "pageNum": fc.get("page_num", 1),
            "pageImage": fc.get("page_image"),
            "text": f"Ready to teach: {pdf_name}",
        })

    # ── Start AgentSession (output-only — no mic input) ─────────────────────
    try:
        await session.start(
            agent=agent,
            room=ctx.room,
        )
        logger.info("[AiTutor] AgentSession started (output-only mode).")
    except Exception as exc:
        logger.error("[AiTutor] Failed to start session: %s", exc)
        return

    # ── Teaching loop (runs once session is live) ─────────────────────────────
    async def teach_all_chunks():
        # ── Step 1: Wait until the Gemini Realtime WebSocket is truly ready ──
        # session.start() returns before the model connection is established;
        # we poll agent_state until it's non-None to avoid "isn't running" errors.
        ready = await _wait_for_session_ready(session, timeout=60.0)
        if not ready:
            # Fallback: still try — retries below will handle it
            logger.warning("[AiTutor] Proceeding despite session-ready timeout.")

        # ── Step 2: Re-publish full PDF now that model is connected ───────────
        if all_pages:
            await _publish(room, {
                "type": "tutor_pdf_ready",
                "pdfName": pdf_name,
                "totalPages": session_meta.get("total_pages", len(all_pages)) if session_meta else len(all_pages),
                "totalChunks": len(chunks),
                "allPages": all_pages,
            })

        total = len(chunks)
        if total == 0:
            logger.warning("[AiTutor] No chunks to teach.")
            return

        # ── Step 3: Greet the students before teaching ────────────────────────
        first_chunk      = chunks[0]
        first_page_num   = first_chunk.get("page_num", 1)
        first_page_image = first_chunk.get("page_image")

        # Show page 1 on frontend while greeting
        await _publish(room, {
            "type": "tutor_whiteboard",
            "status": "greeting",
            "lessonTitle": first_chunk.get("chapter_title") or "Introduction",
            "chunkIndex": 0,
            "totalChunks": total,
            "pageNum": first_page_num,
            "pageImage": first_page_image,
            "text": f"Welcome! Today we're studying: {pdf_name}",
        })

        greeting_instruction = textwrap.dedent(f"""\
            Warmly greet the students. Introduce yourself as Professor Sage.
            Tell them today's topic is "{pdf_name}" and that you will walk them
            through it page by page. Say something encouraging like
            "Let's get started — I'll explain each part clearly and simply."
            Keep your greeting under 20 seconds. Do not start teaching yet.
        """)

        for attempt in range(1, 9):
            try:
                await session.generate_reply(instructions=greeting_instruction)
                logger.info("[AiTutor] Greeting delivered.")
                break
            except Exception as err:
                backoff = min(2 ** (attempt - 1), 16)  # 1, 2, 4, 8, 16s cap
                logger.warning("[AiTutor] Greeting attempt %d failed: %s (retry in %ds)", attempt, err, backoff)
                if attempt < 8:
                    await asyncio.sleep(backoff)

        await _wait_idle(session, max_wait=60)
        await asyncio.sleep(1.0)

        # ── Step 4: Teach each chunk ──────────────────────────────────────────
        for idx, chunk in enumerate(chunks):
            chunk_num  = idx + 1
            page_num   = chunk.get("page_num", 1)
            page_image = chunk.get("page_image")
            title      = chunk.get("chapter_title") or f"Section {chunk_num}"
            text       = chunk["text"]

            # Trim to ~250 tokens (~1500 chars) for concise voice teaching
            voice_text = text[:1500] + ("..." if len(text) > 1500 else "")

            logger.info("[AiTutor] Teaching chunk %d/%d — page %d", chunk_num, total, page_num)

            # 1. Switch frontend to this page BEFORE the teacher starts speaking
            await _publish(room, {
                "type": "tutor_whiteboard",
                "status": "teaching",
                "lessonTitle": title,
                "chunkIndex": chunk_num,
                "totalChunks": total,
                "pageNum": page_num,
                "pageImage": page_image,
                "text": text,
                "imagePaths": chunk.get("image_paths", []),
                "hasImages": bool(chunk.get("image_paths")),
            })

            # 2. Ask the model to explain this chunk (250-token voice text)
            instruction = textwrap.dedent(f"""\
                ===== PAGE {page_num} — SECTION {chunk_num} of {total} =====
                Topic: {title}

                SOURCE TEXT (read silently — do NOT read word-for-word):
                {voice_text}

                YOUR TASK:
                - Explain the key ideas from this text in clear, engaging language.
                - Use a real-world analogy where helpful.
                - Keep your explanation concise (about 45–90 seconds of speech).
                - End by saying: "Let's move to the next part." then stop.
            """)

            for attempt in range(1, 9):
                try:
                    await session.generate_reply(instructions=instruction)
                    logger.info("[AiTutor] Chunk %d/%d reply started.", chunk_num, total)
                    break
                except Exception as err:
                    backoff = min(2 ** (attempt - 1), 16)  # 1, 2, 4, 8, 16s cap
                    logger.warning(
                        "[AiTutor] Chunk %d attempt %d failed: %s (retry in %ds)",
                        chunk_num, attempt, err, backoff,
                    )
                    if attempt < 8:
                        await asyncio.sleep(backoff)

            # 3. Wait until speaking finishes, then move to next chunk
            await _wait_idle(session, max_wait=120)
            await asyncio.sleep(1.5)

        # ── Step 5: Lesson complete ───────────────────────────────────────────
        logger.info("[AiTutor] All chunks taught.")
        await _publish(room, {
            "type": "tutor_whiteboard",
            "status": "complete",
            "lessonTitle": "Lesson Complete!",
            "chunkIndex": total,
            "totalChunks": total,
            "pageNum": chunks[-1].get("page_num", 1) if chunks else 1,
            "text": "The lesson is complete. Well done!",
        })
        try:
            await session.generate_reply(
                instructions='Say warmly: "Excellent work! You have now covered the entire document. '
                             'I hope that was helpful. Goodbye, and keep up the great learning!"'
            )
        except Exception:
            pass

    asyncio.create_task(teach_all_chunks())

    # Keep alive until room disconnects
    disconnect_event = asyncio.Event()
    ctx.room.on("disconnected", lambda *args: disconnect_event.set())
    await disconnect_event.wait()
    logger.info("[AiTutor] Room disconnected. Session ended.")


# ══════════════════════════════════════════════════════════════════════════════
# SECTION 3: ENTRY POINT
# ══════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] not in ("--process-pdf", "--session-id", "-h", "--help"):
        cli.run_app(server)
    else:
        parser = argparse.ArgumentParser(
            description=(
                "AI Tutor — PDF Processor + LiveKit Worker\n"
                "  Process PDF : python aitutor.py --process-pdf <path> [--session-id <id>]\n"
                "  Start worker: python aitutor.py start"
            ),
            formatter_class=argparse.RawTextHelpFormatter,
        )
        parser.add_argument("--process-pdf", metavar="PDF_PATH", help="Process a PDF file")
        parser.add_argument("--session-id", metavar="SESSION_ID", default=None)
        args = parser.parse_args()

        if args.process_pdf:
            session_id = args.session_id or str(uuid.uuid4())[:8]
            logger.info("[aitutor] Processing PDF: %s (session: %s)", args.process_pdf, session_id)
            try:
                meta = process_pdf(args.process_pdf, session_id)
                print(
                    json.dumps({"type": "done", "session_id": session_id, "total_chunks": meta["total_chunks"]}),
                    flush=True,
                )
            except Exception as exc:
                print(json.dumps({"type": "error", "message": str(exc)}), flush=True)
                sys.exit(1)
        else:
            parser.print_help()
