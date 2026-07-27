'use client';

import { useEffect, useState } from 'react';

import { useTheme } from 'next-themes';
import { AnimatePresence, motion } from 'motion/react';
import { useSessionContext } from '@livekit/components-react';
import type { AppConfig } from '@/app-config';
import { AgentSessionView_01 } from '@/components/agents-ui/blocks/agent-session-view-01';
import { AiTutorUploadView } from '@/components/app/ai-tutor-upload-view';
import { WelcomeView } from '@/components/app/welcome-view';
import type { AgentDefinition } from './app';

const MotionWelcomeView = motion.create(WelcomeView);
const MotionTutorUploadView = motion.create(AiTutorUploadView);
const MotionSessionView = motion.create(AgentSessionView_01);

const VIEW_MOTION_PROPS = {
  variants: {
    visible: {
      opacity: 1,
    },
    hidden: {
      opacity: 0,
    },
  },
  initial: 'hidden',
  animate: 'visible',
  exit: 'hidden',
  transition: {
    duration: 0.5,
    ease: 'linear',
  },
} as const;

interface ViewControllerProps {
  appConfig: AppConfig;
  selectedAgent: AgentDefinition | null;
  onSelectAgent: (agent: AgentDefinition, startFn: () => void, sessionId?: string) => void;
}

export function ViewController({ appConfig, selectedAgent, onSelectAgent }: ViewControllerProps) {
  const { isConnected, start } = useSessionContext();
  const { resolvedTheme } = useTheme();
  const [activeUploadAgent, setActiveUploadAgent] = useState<AgentDefinition | null>(null);

  useEffect(() => {
    if (!isConnected) {
      setActiveUploadAgent(null);
    }
  }, [isConnected]);

  // Show upload view only when not connected and user explicitly opened it
  const isTutorUploadMode = !isConnected && activeUploadAgent?.id === 'tutor';

  const handleSelectAgent = (agent: AgentDefinition) => {
    if (agent.id === 'tutor') {
      setActiveUploadAgent(agent);
    } else {
      setActiveUploadAgent(null);
      onSelectAgent(agent, start);
    }
  };

  return (
    <AnimatePresence mode="wait">
      {/* Welcome view */}
      {!isConnected && !isTutorUploadMode && (
        <MotionWelcomeView
          key="welcome"
          {...VIEW_MOTION_PROPS}
          startButtonText={appConfig.startButtonText}
          onStartCall={start}
          onSelectAgent={handleSelectAgent}
        />
      )}

      {/* AI Tutor Upload & Setup view */}
      {isTutorUploadMode && (
        <MotionTutorUploadView
          key="tutor-upload"
          {...VIEW_MOTION_PROPS}
          onBack={() => setActiveUploadAgent(null)}
          onJoinClassroom={(sessionId) => {
            const tutorAgent = activeUploadAgent!;
            // Clear the upload screen immediately so AnimatePresence can exit it
            setActiveUploadAgent(null);
            // Start the live session after a brief tick so state settles
            setTimeout(() => {
              onSelectAgent(tutorAgent, start, sessionId);
            }, 50);
          }}
        />
      )}

      {/* Session view — shown whenever LiveKit is connected */}
      {isConnected && (
        <MotionSessionView
          key="session-view"
          {...VIEW_MOTION_PROPS}
          supportsChatInput={appConfig.supportsChatInput}
          supportsVideoInput={appConfig.supportsVideoInput}
          supportsScreenShare={appConfig.supportsScreenShare}
          isPreConnectBufferEnabled={appConfig.isPreConnectBufferEnabled}
          audioVisualizerType={selectedAgent?.visualizerType ?? appConfig.audioVisualizerType}
          audioVisualizerColor={
            selectedAgent?.themeColor ??
            (resolvedTheme === 'dark'
              ? appConfig.audioVisualizerColorDark
              : appConfig.audioVisualizerColor)
          }
          audioVisualizerColorShift={appConfig.audioVisualizerColorShift}
          audioVisualizerBarCount={appConfig.audioVisualizerBarCount}
          audioVisualizerGridRowCount={appConfig.audioVisualizerGridRowCount}
          audioVisualizerGridColumnCount={appConfig.audioVisualizerGridColumnCount}
          audioVisualizerRadialBarCount={appConfig.audioVisualizerRadialBarCount}
          audioVisualizerRadialRadius={appConfig.audioVisualizerRadialRadius}
          audioVisualizerWaveLineWidth={appConfig.audioVisualizerWaveLineWidth}
          avatarUrl={selectedAgent?.avatar}
          agentId={selectedAgent?.id}
          className="fixed inset-0"
        />
      )}
    </AnimatePresence>
  );
}
