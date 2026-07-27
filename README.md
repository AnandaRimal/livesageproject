# LiveSage 🌿⚡

> **LiveSage** is a digital workforce platform powered by AI employees and human-like AI agents that can automate tasks, assist workflows, and collaborate like real team members.

Building next-generation, human-like AI agents across specialized domains with real-time voice, video avatar interaction, instant web search, quantitative market analysis, medical guidance, and interactive PDF tutoring.

---

![LiveSage Platform Dashboard](assets/livesage-dashboard.png)

---

## 🚀 Overview

**LiveSage** redefines human-AI collaboration by providing an all-in-one digital workforce ecosystem. Powered by **LiveKit Agents**, **Google Gemini 2.0 / OpenAI**, **Tavily**, **Polygon.io**, and **ChromaDB**, LiveSage brings domain-expert AI employees to life with natural human-like voice, bidirectional WebRTC data channels, visual avatars, and deep contextual memory.

Whether you need real-time market forecasts, proactive health insights, step-by-step PDF tutoring, or instant live web search, LiveSage provides domain-tailored agents designed to function seamlessly alongside your team.

---

## ✨ Key Features

- **🎙️ Human-Like Voice & Avatar Interaction**: Ultra-low-latency real-time voice conversations with turn detection, background noise suppression (ai_coustics), and photorealistic video avatars (Bey Avatar integration).
- **💼 Multi-Domain AI Employee Workforce**: Specialized agents pre-configured for Finance, Education, Healthcare, and Real-Time Search.
- **🔍 Real-Time Live Web Search**: Instant web searching with live status updates, source citations, and query synthesis.
- **📈 Quantitative Market & Trading Intelligence**: Live stock quotes, technical analysis (RSI, MACD, Bollinger Bands), options chains, sentiment analysis, crypto prices, and NEPSE data.
- **📚 Interactive PDF & Document RAG**: Upload textbooks or documents for semantic vector search (ChromaDB), automated page image rendering, and interactive tutoring.
- **📊 Real-Time Data Channel Sync**: Live updates to on-screen notepads, status indicators, audio visualizers (`aura`, `wave`, `grid`, `bar`), and interactive widgets.
- **🎨 Modern Enterprise Dashboard**: Sleek, high-performance web application supporting light/dark themes, active agent management, query telemetry, and session notes.

---

## 🤖 Domain AI Agents

LiveSage features specialized AI agents built for domain-specific automation and assistance:

| Agent | Domain | Key Capabilities |
| :--- | :--- | :--- |
| **Zade — Live Search** | **Web Search & Intelligence** | Real-time web search powered by Tavily, live query synthesis, instant citation delivery, and streaming progress indicators. |
| **FinVerse — Finance (Victor)** | **Finance & Trading** | Real-time stock quotes (Polygon.io / yfinance), drift forecasting models, technical indicators (RSI/MACD/BB), crypto, options, forex, watchlist, and portfolio risk management. |
| **Health Agent** | **Healthcare & Wellness** | Proactive wellness insights, symptom analysis, personalized health advice, and preventative care planning delivered with an empathetic voice persona. |
| **AI Tutor** | **Education & Research** | Autonomous PDF-based teaching agent powered by ChromaDB RAG, step-by-step problem breakdown, page image rendering, interactive quizzes, and instant notes. |

---

## 🛠️ Architecture & Tech Stack

LiveSage is organized as a full-stack monorepo:

```
livesage/
├── frontend/               # Next.js 15 + React 19 Frontend Web App
│   ├── app/                # App Router, API endpoints, view controllers
│   ├── components/         # LiveKit Agents UI, AI Elements, Shadcn UI primitives
│   ├── public/             # Static assets, fonts, and platform screenshots
│   └── styles/             # Tailwind CSS & custom design tokens
│
├── my-agent/               # Python Real-Time Voice & Multimodal Agents Backend
│   ├── aitutor.py          # AI Tutor agent (PDF RAG, ChromaDB, teaching tools)
│   ├── finance.py          # FinVerse agent (Polygon.io, trading tools, financial models)
│   ├── livesearch.py       # Zade Live Search agent (Tavily search API, streaming data)
│   └── src/agent.py        # Base LiveKit Agent server entry point
│
└── assets/                 # Documentation media and dashboard screenshots
```

### Core Technologies

- **Frontend**: Next.js 15, React 19, LiveKit Client SDK (`livekit-client`, `@livekit/components-react`), Agents UI, Tailwind CSS, Lucide Icons, Shadcn UI.
- **Backend / Agent Framework**: LiveKit Agents SDK (`livekit-agents`), Python 3.11+.
- **AI / LLM Providers**: Google Gemini 2.0 Flash Multimodal, OpenAI GPT-4o, Cartesia TTS, Deepgram STT.
- **Data & Search Tools**: Polygon.io (Financial Data API), Tavily AI (Real-time Search API), ChromaDB (Vector DB for RAG), Pandas, NumPy.
- **Media & Observability**: ai_coustics (Noise Suppression), Bey (Virtual Video Avatar Plugin), WebRTC Data Channels.

---

## ⚡ Quick Start

### Prerequisites

- **Node.js** v18.0+ and **npm** / **pnpm**
- **Python** 3.11+ and **uv** / **pip**
- A **LiveKit Cloud** account (or self-hosted LiveKit instance)
- API Keys: Google Gemini / OpenAI, Tavily, Polygon.io (optional for finance)

---

### 1. Clone & Configure Environment

```bash
git clone https://github.com/AnandaRimal/livesageproject.git
cd livesageproject
```

#### Set up Agent Backend (`my-agent/.env.local`)
Create `my-agent/.env.local`:
```env
LIVEKIT_URL=wss://your-livekit-project.livekit.cloud
LIVEKIT_API_KEY=your_livekit_api_key
LIVEKIT_API_SECRET=your_livekit_api_secret

# AI Models & APIs
GEMINI_API_KEY=your_gemini_api_key
TAVILY_API_KEY=your_tavily_api_key
POLYGON_API_KEY=your_polygon_api_key
```

#### Set up Web Frontend (`frontend/.env.local`)
Create `frontend/.env.local`:
```env
LIVEKIT_URL=wss://your-livekit-project.livekit.cloud
LIVEKIT_API_KEY=your_livekit_api_key
LIVEKIT_API_SECRET=your_livekit_api_secret
```

---

### 2. Launch the Agent Services

Navigate to the `my-agent` directory and install dependencies:

```bash
cd my-agent
uv sync  # or: pip install -r requirements.txt
```

Run your desired domain agent worker:

```bash
# Launch Zade Live Search Agent
uv run python livesearch.py dev

# Launch FinVerse Finance Agent
uv run python finance.py dev

# Launch AI Tutor Agent
uv run python aitutor.py dev
```

---

### 3. Launch the Web Frontend

In a new terminal window, start the Next.js development server:

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to access the **LiveSage Dashboard**.

---

## 📸 Screenshots & UI Showcase

<div align="center">
  <img src="assets/livesage-dashboard.png" alt="LiveSage Platform UI" width="95%" />
  <p><em>LiveSage Ecosystem Dashboard — Managing Domain AI Employees & Real-Time Voice Sessions</em></p>
</div>

---

## 🤝 Contributing

Contributions, bug reports, and feature requests are welcome! Feel free to open an Issue or pull request.

---

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
