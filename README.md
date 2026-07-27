# LiveSage 🌿⚡

LiveSage is a digital workforce platform powered by AI employees and human-like AI agents that can automate tasks, assist workflows, and collaborate like real team members.

---

![LiveSage Platform Dashboard](assets/livesage-dashboard.png)

---
Our Initial AI Agents

🔍 LiveSearch (Research Agent)
Talk naturally with an AI research assistant that helps you explore topics, find information, explain complex concepts, and conduct research through human-like conversations. It feels like discussing ideas with a knowledgeable research partner.

🏥 Health Agent
An AI health assistant that listens to your concerns, answers health-related questions, explains medical concepts, and provides general wellness guidance in a compassionate, conversational way—similar to talking with a healthcare professional.

📈 Finance Agent (FinVerse)
A finance-focused AI that helps analyze markets, explain investment concepts, evaluate stocks, and answer financial questions as if you're speaking with an experienced financial expert.

🎓 AI Tutor
An AI teacher designed to make learning interactive. Simply upload a PDF, lecture slides, or a textbook, and the tutor teaches the material step by step, answers questions, and provides personalized explanations. It was initially built to support students when teachers are unavailable, with the long-term vision of making high-quality education accessible anytime.

## 🔮 Platform Vision

Our vision for LiveSage is to continuously explore, innovate, and expand our digital workforce by building human-like AI agents for the most popular and useful domains required by both **B2C consumers** and **B2B enterprise companies**. 

Whether automating complex organizational workflows or serving end users in specialized fields, LiveSage aims to deploy domain-expert AI employees wherever automated human-like collaboration is needed.

---

## ⚡ Real-Time Infrastructure

LiveSage uses **LiveKit** for WebRTC real-time voice, video, and data communication, enabling low-latency, interactive human-agent conversations.

---

## 📁 Repository Structure

```
livesage/
├── frontend/               # Next.js Web Dashboard & Agents UI
├── my-agent/               # LiveKit Domain AI Agent Services
└── assets/                 # Platform screenshots and documentation media
```

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** v18.0+
- **Python** 3.11+
- **LiveKit** Server or LiveKit Cloud project

---

### 1. Environment Setup

Configure your LiveKit credentials:

#### Backend (`my-agent/.env.local`)
```env
LIVEKIT_URL=wss://your-livekit-project.livekit.cloud
LIVEKIT_API_KEY=your_livekit_api_key
LIVEKIT_API_SECRET=your_livekit_api_secret
```

#### Frontend (`frontend/.env.local`)
```env
LIVEKIT_URL=wss://your-livekit-project.livekit.cloud
LIVEKIT_API_KEY=your_livekit_api_key
LIVEKIT_API_SECRET=your_livekit_api_secret
```

---

### 2. Run the AI Agents

```bash
cd my-agent
uv sync

# Run desired LiveKit domain agent
uv run python livesearch.py dev
# or: uv run python finance.py dev
# or: uv run python aitutor.py dev
```

---

### 3. Run the Web Application

In a separate terminal:

```bash
cd frontend
npm install
npm run dev
```

Access the dashboard at `http://localhost:3000`.

---

## 📝 License

This project is licensed under the MIT License.
