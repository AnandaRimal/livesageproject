'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { TokenSource } from 'livekit-client';
import { useSession, useSessionContext } from '@livekit/components-react';
import { WarningIcon } from '@phosphor-icons/react/dist/ssr';
import type { AppConfig } from '@/app-config';
import { AgentSessionProvider } from '@/components/agents-ui/agent-session-provider';
import { StartAudioButton } from '@/components/agents-ui/start-audio-button';
import { ViewController } from '@/components/app/view-controller';
import { Toaster } from '@/components/ui/sonner';
import { useAgentErrors } from '@/hooks/useAgentErrors';
import { useDebugMode } from '@/hooks/useDebug';
import { getSandboxTokenSource } from '@/lib/utils';

export interface AgentDefinition {
  id: string;
  name: string;
  title: string;
  description: string;
  avatar: string;
  icon: string;
  themeColor: `#${string}`;
  badgeColor: string;
  glowColor: string;
  agentName: string;
  visualizerType: 'bar' | 'wave' | 'grid' | 'radial' | 'aura';
}

export const AGENTS: AgentDefinition[] = [
  {
    id: 'search',
    name: 'Zade — Live Search',
    title: 'Zade Live Search',
    description: 'Search the web in real-time and get accurate answers with sources.',
    avatar: '/avatars/livesearch_agent.png',
    icon: 'Search',
    themeColor: '#3b82f6',
    badgeColor: 'bg-blue-600/30 text-blue-400',
    glowColor: 'from-blue-600/30 via-blue-600/10 to-transparent',
    agentName: 'livesearch-agent',
    visualizerType: 'aura',
  },
  {
    id: 'finance',
    name: 'FinVerse — Finance',
    title: 'Finance Agent',
    description: 'Market analysis, investment insights, budgeting and financial planning.',
    avatar: '/avatars/finance_real.png',
    icon: 'TrendingUp',
    themeColor: '#f97316',
    badgeColor: 'bg-orange-600/30 text-orange-400',
    glowColor: 'from-orange-600/30 via-orange-600/10 to-transparent',
    agentName: 'finance-agent', // Dedicated Finance Agent — separate backend worker
    visualizerType: 'bar',
  },
  {
    id: 'health',
    name: 'Health Agent',
    title: 'Health Agent',
    description: 'Proactive wellness insights, symptom analysis, and preventative plans.',
    avatar: '/avatars/health_real.png',
    icon: 'HeartPulse',
    themeColor: '#ef4444',
    badgeColor: 'bg-red-600/30 text-red-400',
    glowColor: 'from-red-600/30 via-red-600/10 to-transparent',
    agentName: 'livesearch-agent',
    visualizerType: 'radial',
  },
  {
    id: 'tutor',
    name: 'AI Tutor',
    title: 'AI Tutor',
    description: 'Personalized learning, subject explanations, and interactive tutoring.',
    avatar: '/avatars/aitutor_agent.png',
    icon: 'Compass',
    themeColor: '#8b5cf6',
    badgeColor: 'bg-violet-600/30 text-violet-400',
    glowColor: 'from-violet-600/30 via-violet-600/10 to-transparent',
    agentName: 'livesearch-agent',
    visualizerType: 'aura',
  },
];

const IN_DEVELOPMENT = process.env.NODE_ENV !== 'production';

interface AppSetupProps {
  selectedAgent: AgentDefinition | null;
}

function AppSetup({ selectedAgent }: AppSetupProps) {
  useDebugMode({ enabled: IN_DEVELOPMENT });
  useAgentErrors();

  const { isConnected, room } = useSessionContext();

  useEffect(() => {
    if (isConnected && room && selectedAgent) {
      const agentId = selectedAgent.id;
      console.log('[AppSetup] Connected to room, sending selected agent:', agentId);

      const encoder = new TextEncoder();
      const payload = JSON.stringify({ type: 'selected-agent', agentId });
      const data = encoder.encode(payload);

      room.localParticipant.publishData(data, {
        reliable: true,
        topic: 'agent-ui',
      }).catch((err) => {
        console.error('[AppSetup] Failed to publish selected-agent data packet:', err);
      });
    }
  }, [isConnected, room, selectedAgent]);

  return null;
}

interface AppProps {
  appConfig: AppConfig;
}

export function App({ appConfig }: AppProps) {
  const [selectedAgent, setSelectedAgent] = useState<AgentDefinition | null>(null);
  const selectedAgentRef = useRef<AgentDefinition | null>(null);

  // tokenSource reads selectedAgentRef.current at call-time (inside the async callback),
  // so the ref is always up-to-date even though useMemo only runs once.
  const tokenSource = useMemo(() => {
    if (typeof process.env.NEXT_PUBLIC_CONN_DETAILS_ENDPOINT === 'string') {
      return getSandboxTokenSource(appConfig, () => selectedAgentRef.current?.agentName);
    }
    return TokenSource.custom(async () => {
      try {
        // Read the ref NOW — this runs at call-time, not at memo-creation time
        const activeAgent = selectedAgentRef.current;
        const agentId = activeAgent?.id || 'search';
        const agentName = activeAgent?.agentName || appConfig.agentName;

        console.log('[token] fetching token for agent:', agentId, 'name:', agentName);

        const res = await fetch('/api/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            room_config: agentName
              ? { agents: [{ agentName: agentName, agent_name: agentName }] }
              : undefined,
            // This is embedded in participant metadata and read by the backend
            // to dynamically route between LiveSearchAgent (Neha) and FinanceAgent
            selectedAgent: agentId,
          }),
        });
        return await res.json();
      } catch (error) {
        console.error('Error fetching connection details:', error);
        throw new Error('Error fetching connection details!');
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appConfig]);

  // Finance uses 'finance-agent' worker; all other agents use 'my-agent'.
  // The backend routes LiveSearch sub-types internally via participant metadata.
  const session = useSession(
    tokenSource,
    selectedAgent?.agentName
      ? { agentName: selectedAgent.agentName }
      : appConfig.agentName
        ? { agentName: appConfig.agentName }
        : undefined
  );

  const handleStartCallWithAgent = (agent: AgentDefinition, startFn: () => void) => {
    selectedAgentRef.current = agent;
    setSelectedAgent(agent);
    // Add a small micro-task delay to ensure state and refs are aligned
    setTimeout(() => {
      startFn();
    }, 50);
  };

  return (
    <AgentSessionProvider session={session}>
      <AppSetup selectedAgent={selectedAgent} />
      <main className="min-h-screen w-full">
        <ViewController
          appConfig={appConfig}
          selectedAgent={selectedAgent}
          onSelectAgent={(agent, startFn) => handleStartCallWithAgent(agent, startFn)}
        />
      </main>
      <StartAudioButton label="Start Audio" />
      <Toaster
        icons={{
          warning: <WarningIcon weight="bold" />,
        }}
        position="top-center"
        className="toaster group"
        style={
          {
            '--normal-bg': 'var(--popover)',
            '--normal-text': 'var(--popover-foreground)',
            '--normal-border': 'var(--border)',
          } as React.CSSProperties
        }
      />
    </AgentSessionProvider>
  );
}
