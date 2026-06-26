'use client';

import React, { useEffect, useRef, useState } from 'react';
import { FileTextIcon, NewspaperIcon } from 'lucide-react';
import { AnimatePresence, type MotionProps, motion } from 'motion/react';
import { useAgent, useSessionContext, useSessionMessages } from '@livekit/components-react';
import { AgentChatTranscript } from '@/components/agents-ui/agent-chat-transcript';
import {
  AgentControlBar,
  type AgentControlBarControls,
} from '@/components/agents-ui/agent-control-bar';
import { NewsOverlay } from '@/components/agents-ui/news-overlay';
import { NewsPanel } from '@/components/agents-ui/news-panel';
import { NotebookPanel } from '@/components/agents-ui/notebook-panel';
import { Shimmer } from '@/components/ai-elements/shimmer';
import { cn } from '@/lib/shadcn/utils';
import { TileLayout } from './tile-view';

const MotionMessage = motion.create(Shimmer);

const BOTTOM_VIEW_MOTION_PROPS: MotionProps = {
  variants: {
    visible: {
      opacity: 1,
      translateY: '0%',
    },
    hidden: {
      opacity: 0,
      translateY: '100%',
    },
  },
  initial: 'hidden',
  animate: 'visible',
  exit: 'hidden',
  transition: {
    duration: 0.3,
    delay: 0.5,
    ease: 'easeOut',
  },
};

const SHIMMER_MOTION_PROPS: MotionProps = {
  variants: {
    visible: {
      opacity: 1,
      transition: {
        ease: 'easeIn',
        duration: 0.5,
        delay: 0.8,
      },
    },
    hidden: {
      opacity: 0,
      transition: {
        ease: 'easeIn',
        duration: 0.5,
        delay: 0,
      },
    },
  },
  initial: 'hidden',
  animate: 'visible',
  exit: 'hidden',
};

export function Fade({
  top = false,
  bottom = false,
  className,
}: {
  top?: boolean;
  bottom?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'from-background pointer-events-none h-4 bg-linear-to-b to-transparent',
        top && 'bg-linear-to-b',
        bottom && 'bg-linear-to-t',
        className
      )}
    />
  );
}

export interface AgentSessionView_01Props {
  preConnectMessage?: string;
  supportsChatInput?: boolean;
  supportsVideoInput?: boolean;
  supportsScreenShare?: boolean;
  isPreConnectBufferEnabled?: boolean;
  audioVisualizerType?: 'bar' | 'wave' | 'grid' | 'radial' | 'aura';
  audioVisualizerColor?: `#${string}`;
  audioVisualizerColorShift?: number;
  audioVisualizerBarCount?: number;
  audioVisualizerGridRowCount?: number;
  audioVisualizerGridColumnCount?: number;
  audioVisualizerRadialBarCount?: number;
  audioVisualizerRadialRadius?: number;
  audioVisualizerWaveLineWidth?: number;
  avatarUrl?: string;
  agentId?: string;
  className?: string;
}

export function AgentSessionView_01({
  preConnectMessage = 'Agent is listening, ask it a question',
  supportsChatInput = true,
  supportsVideoInput = true,
  supportsScreenShare = true,
  isPreConnectBufferEnabled = true,
  audioVisualizerType,
  audioVisualizerColor,
  audioVisualizerColorShift,
  audioVisualizerBarCount,
  audioVisualizerGridRowCount,
  audioVisualizerGridColumnCount,
  audioVisualizerRadialBarCount,
  audioVisualizerRadialRadius,
  audioVisualizerWaveLineWidth,
  avatarUrl,
  agentId,
  ref,
  className,
  ...props
}: React.ComponentProps<'section'> & AgentSessionView_01Props) {
  const session = useSessionContext();
  const { messages } = useSessionMessages(session);
  const [chatOpen, setChatOpen] = useState(false);
  const [notebookOpen, setNotebookOpen] = useState(false);
  const [newsOverlayKey, setNewsOverlayKey] = useState(0);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const { state: agentState } = useAgent();

  const controls: AgentControlBarControls = {
    leave: true,
    microphone: true,
    chat: supportsChatInput,
    camera: supportsVideoInput,
    screenShare: supportsScreenShare,
  };

  useEffect(() => {
    const lastMessage = messages.at(-1);
    const lastMessageIsLocal = lastMessage?.from?.isLocal === true;

    if (scrollAreaRef.current && lastMessageIsLocal) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <section
      ref={ref}
      className={cn('bg-background/80 relative z-10 h-full w-full overflow-hidden', className)}
      {...props}
    >
      {/* ── 3-Zone Layout ── */}
      <div className="absolute inset-0 flex">
        {/* ── LEFT: Chat Transcript (always visible on desktop) ── */}
        <div className="hidden w-[300px] shrink-0 flex-col border-r border-white/5 lg:flex">
          {/* Chat header */}
          <div className="flex items-center gap-2 border-b border-white/5 px-4 py-3">
            <span className="relative flex size-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-cyan-500" />
            </span>
            <h3 className="gradient-text text-[10px] font-bold tracking-widest uppercase">
              Live Transcript
            </h3>
          </div>

          {/* Messages */}
          <div className="relative flex-1 overflow-hidden">
            <Fade top className="absolute inset-x-0 top-0 z-10 h-8" />
            <AgentChatTranscript
              agentState={agentState}
              messages={messages}
              className="h-full [&_.is-user>div]:rounded-[18px] [&>div>div]:px-3 [&>div>div]:pt-10"
            />
          </div>
        </div>

        {/* ── CENTER: Visualizer + Controls ── */}
        <div className="relative flex flex-1 flex-col">
          <Fade top className="absolute inset-x-4 top-0 z-10 h-40" />

          {/* Mobile transcript (shown when chat toggled) */}
          <div className="absolute top-0 bottom-[135px] flex w-full flex-col md:bottom-[170px] lg:hidden">
            <AnimatePresence>
              {chatOpen && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="flex h-full w-full flex-col gap-4 space-y-3"
                >
                  <AgentChatTranscript
                    agentState={agentState}
                    messages={messages}
                    className="mx-auto w-full max-w-2xl [&_.is-user>div]:rounded-[22px] [&>div>div]:px-4 [&>div>div]:pt-40 md:[&>div>div]:px-6"
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Tile layout (visualizer / avatar) */}
          <TileLayout
            chatOpen={chatOpen}
            avatarUrl={avatarUrl}
            audioVisualizerType={audioVisualizerType}
            audioVisualizerColor={audioVisualizerColor}
            audioVisualizerColorShift={audioVisualizerColorShift}
            audioVisualizerBarCount={audioVisualizerBarCount}
            audioVisualizerRadialBarCount={audioVisualizerRadialBarCount}
            audioVisualizerRadialRadius={audioVisualizerRadialRadius}
            audioVisualizerGridRowCount={audioVisualizerGridRowCount}
            audioVisualizerGridColumnCount={audioVisualizerGridColumnCount}
            audioVisualizerWaveLineWidth={audioVisualizerWaveLineWidth}
          />

          {/* Bottom controls */}
          <motion.div
            {...BOTTOM_VIEW_MOTION_PROPS}
            className="absolute inset-x-3 bottom-0 z-50 md:inset-x-12"
          >
            {/* Pre-connect message */}
            {isPreConnectBufferEnabled && (
              <AnimatePresence>
                {messages.length === 0 && (
                  <MotionMessage
                    key="pre-connect-message"
                    duration={2}
                    aria-hidden={messages.length > 0}
                    {...SHIMMER_MOTION_PROPS}
                    className="pointer-events-none mx-auto block w-full max-w-2xl pb-4 text-center text-sm font-semibold"
                  >
                    {preConnectMessage}
                  </MotionMessage>
                )}
              </AnimatePresence>
            )}
            <div className="bg-background/60 relative mx-auto max-w-2xl rounded-t-2xl pb-3 backdrop-blur-sm md:pb-12">
              <Fade bottom className="absolute inset-x-0 top-0 h-4 -translate-y-full" />
              <AgentControlBar
                variant="livekit"
                controls={controls}
                isChatOpen={chatOpen}
                isConnected={session.isConnected}
                onDisconnect={session.end}
                onIsChatOpenChange={setChatOpen}
              />
            </div>
          </motion.div>
        </div>

        {/* ── RIGHT: News Panel + Notebook Toggle (desktop only) ── */}
        <div className="hidden w-[280px] shrink-0 flex-col gap-3 border-l border-white/5 p-3 xl:flex">
          {/* News panel */}
          <div className="flex-1 overflow-hidden">
            <NewsPanel agentId={agentId} />
          </div>

          {/* Notebook toggle button */}
          <button
            onClick={() => setNotebookOpen(!notebookOpen)}
            className={cn(
              'glass neon-glow-border flex items-center gap-2 rounded-2xl px-4 py-3 text-xs font-semibold tracking-wider uppercase transition-all hover:bg-white/[0.06]',
              notebookOpen ? 'text-violet-400' : 'text-foreground/40'
            )}
          >
            <FileTextIcon className="size-4" />
            <span className="gradient-text">Notepad</span>
          </button>
        </div>
      </div>

      {/* ── Notebook Panel (floating, both mobile + desktop) ── */}
      <NotebookPanel isOpen={notebookOpen} onClose={() => setNotebookOpen(false)} />

      {/* ── News Overlay: shows on ALL screen sizes when agent sends search results ── */}
      <NewsOverlay key={newsOverlayKey} />

      {/* ── Mobile: Floating notebook + news buttons ── */}
      <div className="fixed right-3 bottom-36 z-[100] flex flex-col gap-2 xl:hidden">
        {/* News button — tapping re-mounts overlay to force it visible again */}
        <button
          onClick={() => setNewsOverlayKey((k) => k + 1)}
          className="glass flex size-10 items-center justify-center rounded-full"
          title="Show news"
        >
          <NewspaperIcon className="size-4 text-cyan-400" />
        </button>
        <button
          onClick={() => setNotebookOpen(!notebookOpen)}
          className="glass animate-pulse-neon flex size-10 items-center justify-center rounded-full"
          title="Notepad"
        >
          <FileTextIcon className="size-4 text-violet-400" />
        </button>
      </div>
    </section>
  );
}
