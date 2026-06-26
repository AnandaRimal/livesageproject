# CRITICAL: Must be set before ANY other imports on Windows
import sys
import asyncio
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

import json
import logging
import os
import textwrap

import httpx
from dotenv import load_dotenv
load_dotenv(".env.local")

from livekit import agents
from livekit.agents import AgentServer, AgentSession, Agent, RunContext, function_tool, room_io
from livekit.plugins import ai_coustics, google

# Safe import for the Avatar (Bey). If it fails, the script won't crash.
try:
    from livekit.plugins import bey
    BEY_AVAILABLE = True
except ImportError:
    BEY_AVAILABLE = False
    print("\n[WARNING] 'livekit-plugins-bey' is not installed. Avatar features are disabled.")
    print("To enable: pip install livekit-plugins-bey\n")


# =====================================================
# CONFIG
# =====================================================
logger = logging.getLogger("livesearch")
logging.basicConfig(level=logging.INFO)

_TAVILY_API_KEY = os.getenv("TAVILY_API_KEY", "")
_TAVILY_URL = "https://api.tavily.com/search"
_http_client: httpx.AsyncClient | None = None

_SEARCH_LOADING_MESSAGES = [
    "Ma search gardai xu hai, ali bela lagna sakxa... chiya khadai garnu na!",
    "Pardako pachhadi kaam bhairako xa... ekxin parkhau hai!",
    "Google daju le dhilo gardai xan, ekkai xin hai sathi...",
    "Khoji bhairako xa... dimag ma load hudai xa...",
    "Ma khoji gardai xu, internet baaje le chito pathae ta hunthyo...",
    "Aba thah hunchha... internet le dhoka diena bhane aaihalxa...",
]
_search_loading_index = 0


# =====================================================
# SHARED HELPERS
# =====================================================
def _get_http_client() -> httpx.AsyncClient:
    global _http_client
    if _http_client is None or _http_client.is_closed:
        _http_client = httpx.AsyncClient(
            timeout=httpx.Timeout(connect=2.0, read=6.0, write=2.0, pool=2.0),
            limits=httpx.Limits(max_connections=10, max_keepalive_connections=5),
        )
    return _http_client


async def _publish_to_frontend(room, payload: dict) -> None:
    """Send any JSON payload to the frontend via the LiveKit data channel."""
    if room is None:
        return
    try:
        data = json.dumps(payload).encode("utf-8")
        await room.local_participant.publish_data(data, reliable=True, topic="agent-ui")
    except Exception as exc:
        logger.warning("_publish_to_frontend error: %s", exc)


async def _publish_status(room, message: str, status_type: str = "searching") -> None:
    """Push a loading/status indicator to the frontend immediately."""
    await _publish_to_frontend(room, {"type": status_type, "message": message})


async def tavily_fetch(query: str, max_results: int = 3, topic: str = "general") -> dict:
    if not _TAVILY_API_KEY:
        raise ValueError("TAVILY_API_KEY is not set.")
    client = _get_http_client()
    resp = await client.post(
        _TAVILY_URL,
        json={
            "api_key": _TAVILY_API_KEY,
            "query": query,
            "search_depth": "basic",
            "topic": topic,
            "max_results": max_results,
            "include_answer": True,
        },
    )
    resp.raise_for_status()
    return resp.json()


# =====================================================
# TOOL IMPLEMENTATIONS
# =====================================================
async def _search_web(room, query: str) -> str:
    global _search_loading_index
    loading_msg = _SEARCH_LOADING_MESSAGES[_search_loading_index % len(_SEARCH_LOADING_MESSAGES)]
    _search_loading_index += 1
    await _publish_status(room, loading_msg, status_type="searching")

    try:
        data = await tavily_fetch(query, max_results=3, topic="general")
        results = data.get("results", [])

        articles = [
            {
                "title": r.get("title", ""),
                "summary": r.get("content", "")[:200].strip(),
                "url": r.get("url", ""),
                "source": r.get("url", "").split("/")[2].replace("www.", "") if r.get("url") else "",
            }
            for r in results[:3] if r.get("title")
        ]

        if articles:
            await _publish_to_frontend(room, {"type": "show_news", "articles": articles})
            logger.info("Published %d search results to frontend", len(articles))

        if data.get("answer"):
            return data["answer"]

        parts = [
            f"{r.get('title', '')}: {r.get('content', '')[:180].strip()}"
            for r in results[:3] if r.get("title")
        ]
        return " ".join(parts) or "No relevant results found."

    except httpx.TimeoutException:
        logger.warning("search_web timed out for: %s", query)
        return "Search timed out. I'll answer from memory instead."
    except Exception as exc:
        logger.error("search_web error: %s", exc)
        return "Web search failed. I'll answer from memory."


async def _show_news(room, topic: str = "top headlines") -> str:
    await _publish_status(room, f"Fetching {topic} news...", status_type="searching")
    try:
        data = await tavily_fetch(query=f"latest {topic} news today", max_results=5, topic="news")
        results = data.get("results", [])

        articles = [
            {
                "title": r.get("title", ""),
                "summary": r.get("content", "")[:200].strip(),
                "url": r.get("url", ""),
                "source": r.get("url", "").split("/")[2].replace("www.", "") if r.get("url") else "",
            }
            for r in results[:5] if r.get("title")
        ]

        if articles:
            await _publish_to_frontend(room, {"type": "show_news", "articles": articles})
            titles = [a["title"] for a in articles[:3]]
            return f"Here are the top {topic} headlines: " + ". ".join(titles)

        return "I couldn't find any news right now."
    except Exception as exc:
        logger.error("show_news error: %s", exc)
        return "I had trouble fetching the news."


async def _write_to_notepad(room, text: str) -> str:
    try:
        if room:
            await _publish_to_frontend(room, {"type": "notebook_append", "text": text})
            logger.info("Published notepad entry to frontend")
            return f'I\'ve added that to your notepad: "{text[:60]}..."'
        return "Notepad is not connected."
    except Exception as exc:
        logger.error("write_to_notepad error: %s", exc)
        return "I couldn't write to the notepad right now."


# =====================================================
# AGENT
# =====================================================
class LiveSearchAgent(Agent):
    def __init__(self, room):
        self._room = room
        super().__init__(
            llm=google.realtime.RealtimeModel(
                model="gemini-2.5-flash-native-audio-preview-12-2025",
                voice="Aoede",
            ),
            instructions=textwrap.dedent("""\
                for greeting start with hello aananda K xa khabar? tapaiko lagi maile k kam garnu paryo bhannu ta 
                You are Neha, a friendly AI assistant with real-time web search capabilities.
                - Keep replies brief: 1-3 sentences. Plain text only, no markdown or emojis.
                - Use `search_web` ONLY for real-time or current data (news, prices, live events).
                - Use `show_news` when the user asks to see or display news.
                - Use `write_to_notepad` to save notes or text for the user.
                - Never say "I am searching..." out loud; just use the tool silently.
                - For general knowledge, math, history — answer directly without searching.
            """),
        )

    @function_tool(description="Search the live web for up-to-date information.")
    async def search_web(self, context: RunContext, query: str) -> str:
        return await _search_web(self._room, query)

    @function_tool(description="Fetch live news and display news cards on the screen.")
    async def show_news(self, context: RunContext, topic: str = "top headlines") -> str:
        return await _show_news(self._room, topic)

    @function_tool(description="Write or append text to the user's on-screen notepad.")
    async def write_to_notepad(self, context: RunContext, text: str) -> str:
        return await _write_to_notepad(self._room, text)


# =====================================================
# SESSION HANDLER
# =====================================================
server = AgentServer()


@server.rtc_session(agent_name="livesearch-agent")
async def livesearch_agent(ctx: agents.JobContext):
    room = ctx.room
    logger.info("[LiveSearch] Joined room: %s", room.name)

    # Small delay — lets the FFI room connection fully stabilize on Windows
    await asyncio.sleep(0.5)

    # Initialize the core session instance
    session = AgentSession()

    # -----------------------------------------------------
    # ATTACH AVATAR FIRST (Must be done before starting the AgentSession)
    # -----------------------------------------------------
    avatar_id = os.getenv("BEY_AVATAR_ID")
    if BEY_AVAILABLE and avatar_id:
        logger.info("Starting Bey avatar stream: %s", avatar_id)
        try:
            avatar = bey.AvatarSession(avatar_id=avatar_id)
            await avatar.start(session, room=ctx.room)
            logger.info("Bey avatar attached to session successfully.")
        except Exception as exc:
            logger.error("Failed to start Bey avatar, continuing audio-only: %s", exc)
    else:
        if not BEY_AVAILABLE:
            logger.warning("livekit-plugins-bey not installed — running audio-only")
        elif not avatar_id:
            logger.warning("BEY_AVATAR_ID environment variable not set — running audio-only")

    # -----------------------------------------------------
    # START THE SESSION SECOND
    # -----------------------------------------------------
    try:
        await session.start(
            agent=LiveSearchAgent(room=ctx.room),
            room=ctx.room,
            room_options=room_io.RoomOptions(
                audio_input=room_io.AudioInputOptions(
                    noise_cancellation=ai_coustics.audio_enhancement(
                        model=ai_coustics.EnhancerModel.QUAIL_VF_S
                    ),
                ),
            ),
        )
        logger.info("[LiveSearch] Core agent session successfully started.")
    except Exception as exc:
        logger.error("Failed to establish agent session: %s", exc)
        return

    # Connect to the room (Satisfies the FFI handshake)
    await ctx.connect()

    # 3. Greet the user
    async def greet_user():
        await asyncio.sleep(2)
        try:
            await session.generate_reply(
                instructions="Say exactly: 'hello aananda K xa khabar? tapaiko lagi maile k kam garnu paryo bhannu ta '"
            )
        except RuntimeError as e:
            logger.warning("Greeting skipped: %s", e)

    asyncio.create_task(greet_user())

    # Keep handler alive until user disconnects
    disconnect_event = asyncio.Event()
    ctx.room.on("disconnected", lambda *args: disconnect_event.set())
    await disconnect_event.wait()


# =====================================================
# RUN SERVER
# =====================================================
if __name__ == "__main__":
    agents.cli.run_app(server)