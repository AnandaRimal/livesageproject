'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  FileTextIcon,
  GraduationCap,
  Layers,
  Maximize2,
  NewspaperIcon,
  RotateCcw,
  Sparkles,
  X,
} from 'lucide-react';

import { AnimatePresence, type MotionProps, motion } from 'motion/react';
import {
  type AgentState,
  type ReceivedMessage,
  useAgent,
  useDataChannel,
  useSessionContext,
  useSessionMessages,
} from '@livekit/components-react';
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
    visible: { opacity: 1, translateY: '0%' },
    hidden: { opacity: 0, translateY: '100%' },
  },
  initial: 'hidden',
  animate: 'visible',
  exit: 'hidden',
  transition: { duration: 0.3, delay: 0.5, ease: 'easeOut' },
};

const SHIMMER_MOTION_PROPS: MotionProps = {
  variants: {
    visible: { opacity: 1, transition: { ease: 'easeIn', duration: 0.5, delay: 0.8 } },
    hidden: { opacity: 0, transition: { ease: 'easeIn', duration: 0.5, delay: 0 } },
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

interface PageEntry {
  pageNum: number;
  pageImage: string;
}

// ── Tutor Classroom Layout ─────────────────────────────────────────────────────
function TutorClassroomLayout({
  avatarUrl,
  audioVisualizerType,
  audioVisualizerColor,
  audioVisualizerColorShift,
  audioVisualizerGridRowCount,
  audioVisualizerGridColumnCount,
  audioVisualizerRadialBarCount,
  audioVisualizerRadialRadius,
  audioVisualizerWaveLineWidth,
  isConnected,
  onDisconnect,
  messages,
  agentState,
}: {
  avatarUrl?: string;
  audioVisualizerType?: string;
  audioVisualizerColor?: `#${string}`;
  audioVisualizerColorShift?: number;
  audioVisualizerGridRowCount?: number;
  audioVisualizerGridColumnCount?: number;
  audioVisualizerRadialBarCount?: number;
  audioVisualizerRadialRadius?: number;
  audioVisualizerWaveLineWidth?: number;
  isConnected: boolean;
  onDisconnect: () => void;
  messages: ReceivedMessage[];
  agentState: AgentState;
}) {
  // All PDF pages — ONLY from live data channel, never stale sessions
  const [allPages, setAllPages] = useState<PageEntry[]>([]);
  const [pdfName, setPdfName] = useState<string>('');
  const [totalChunks, setTotalChunks] = useState<number>(0);
  const [chunkIndex, setChunkIndex] = useState<number>(0);
  const [currentPageNum, setCurrentPageNum] = useState<number>(1);
  const [activeSlidePageNum, setActiveSlidePageNum] = useState<number>(1);
  const [userIsBrowsing, setUserIsBrowsing] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'slider' | 'list'>('slider');
  const [status, setStatus] = useState<string>('starting');
  const [lessonTitle, setLessonTitle] = useState<string>('');
  const [expandedImage, setExpandedImage] = useState<string | null>(null);

  const pageRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const thumbnailStripRef = useRef<HTMLDivElement>(null);

// Helper to strip session prefix (e.g. session_1785052228939_xq2v3_) from PDF filename
function cleanPdfName(name: string): string {
  if (!name) return '';
  return name.replace(/^session_[^_\s]+_/, '');
}

  // Data channel — sole source of truth for PDF state
  const { send } = useDataChannel('agent-ui', (msg) => {
    try {
      const data = JSON.parse(new TextDecoder().decode(msg.payload));
      if (data.type === 'tutor_pdf_ready') {
        if (data.allPages && data.allPages.length > 0) {
          setAllPages(data.allPages as PageEntry[]);
        }
        if (data.pdfName) setPdfName(cleanPdfName(data.pdfName));
        if (typeof data.totalChunks === 'number') setTotalChunks(data.totalChunks);
      } else if (
        data.type === 'tutor_page_loading' ||
        data.type === 'tutor_whiteboard' ||
        data.type === 'tutor_state'
      ) {
        if (data.pageNum) {
          setCurrentPageNum(data.pageNum);
          if (!userIsBrowsing) setActiveSlidePageNum(data.pageNum);
        }
        if (data.status) setStatus(data.status);
        if (data.lessonTitle) setLessonTitle(data.lessonTitle);
        if (typeof data.chunkIndex === 'number') setChunkIndex(data.chunkIndex);
        if (typeof data.totalChunks === 'number') setTotalChunks(data.totalChunks);
        if (data.pageImage && data.pageNum) {
          setAllPages((prev) => {
            const exists = prev.some((p) => p.pageNum === data.pageNum);
            if (!exists) {
              return [...prev, { pageNum: data.pageNum, pageImage: data.pageImage }].sort(
                (a, b) => a.pageNum - b.pageNum
              );
            }
            return prev;
          });
        }
      }
    } catch {
      /* ignore */
    }
  });

  const handleImageLoaded = () => {
    try {
      const payload = new TextEncoder().encode(JSON.stringify({ type: 'page_ready' }));
      send(payload, { reliable: true, topic: 'agent-ui' });
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    if (!userIsBrowsing) setActiveSlidePageNum(currentPageNum);
  }, [currentPageNum, userIsBrowsing]);

  useEffect(() => {
    if (viewMode === 'list') {
      const el = pageRefs.current[currentPageNum];
      if (el && scrollContainerRef.current) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [currentPageNum, viewMode]);

  useEffect(() => {
    if (thumbnailStripRef.current) {
      const activeThumb = thumbnailStripRef.current.querySelector(
        `[data-page="${activeSlidePageNum}"]`
      ) as HTMLElement | null;
      if (activeThumb) {
        activeThumb.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }, [activeSlidePageNum]);

  const handleSelectSlide = (pageNum: number) => {
    setActiveSlidePageNum(pageNum);
    setUserIsBrowsing(pageNum !== currentPageNum);
  };

  const handleSyncToTeacher = () => {
    setActiveSlidePageNum(currentPageNum);
    setUserIsBrowsing(false);
  };

  const activePageObj = allPages.find((p) => p.pageNum === activeSlidePageNum) || allPages[0];
  const progressPct =
    allPages.length > 0 ? Math.round(((currentPageNum - 1) / allPages.length) * 100) : 0;

  // Suppress unused var warnings for status/lessonTitle/chunkIndex/totalChunks
  void status;
  void lessonTitle;
  void chunkIndex;
  void totalChunks;

  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden bg-[#0b0b18] text-white">
      {/* ══ TOP NAV BAR ══ */}
      <div className="z-40 flex h-14 shrink-0 items-center justify-between border-b border-white/[0.06] bg-[#0f0f20]/95 px-4 shadow-lg backdrop-blur-xl">
        {/* Left: Brand */}
        <div className="flex shrink-0 items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 shadow-lg">
            <GraduationCap className="size-4 text-white" />
          </div>
          <div className="flex flex-col leading-none">
            <span className="text-[13px] font-extrabold tracking-tight text-white">LiveSage</span>
            <span className="text-[9px] font-semibold tracking-widest text-violet-400 uppercase">
              AI Tutor
            </span>
          </div>
        </div>

        {/* Center: page count only (no filename) */}
        {allPages.length > 0 && (
          <div className="mx-4 flex min-w-0 items-center gap-2">
            <BookOpen className="size-3.5 shrink-0 text-violet-400" />
            <span className="text-[11px] font-semibold text-slate-300">AI Tutor Lesson</span>
            <span className="shrink-0 rounded-full border border-slate-700 bg-slate-800/80 px-2.5 py-0.5 font-mono text-[10px] font-bold text-slate-300">
              {allPages.length} pages
            </span>
          </div>
        )}

        {/* Right: sync + view toggle + avatar */}
        <div className="flex shrink-0 items-center gap-2">
          {userIsBrowsing && activeSlidePageNum !== currentPageNum && (
            <button
              onClick={handleSyncToTeacher}
              className="flex animate-pulse cursor-pointer items-center gap-1.5 rounded-full bg-violet-600 px-3 py-1.5 text-[11px] font-bold text-white shadow-lg transition hover:bg-violet-500"
            >
              <RotateCcw className="size-3" /> Sync
            </button>
          )}
          {allPages.length > 0 && (
            <div className="flex items-center gap-0.5 rounded-xl border border-white/10 bg-white/5 p-1">
              <button
                onClick={() => setViewMode('slider')}
                className={cn(
                  'flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-all',
                  viewMode === 'slider'
                    ? 'bg-violet-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                )}
              >
                <Sparkles className="size-3" /> Auto Slider
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={cn(
                  'flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-all',
                  viewMode === 'list'
                    ? 'bg-violet-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                )}
              >
                <Layers className="size-3" /> All Pages
              </button>
            </div>
          )}
          <div className="relative size-8 overflow-hidden rounded-full border-2 border-violet-500/50">
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-violet-600 to-indigo-700">
              <GraduationCap className="size-4 text-white" />
            </div>
            <span className="absolute right-0 bottom-0 size-2.5 rounded-full border-2 border-[#0f0f20] bg-emerald-500" />
          </div>
        </div>
      </div>

      {/* ══ MAIN BODY ══ */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── LEFT SIDEBAR ── */}
        <div className="hidden w-[220px] shrink-0 flex-col border-r border-white/[0.06] bg-[#0f0f20]/90 lg:flex">
          {/* LIVE SESSION header */}
          <div className="flex shrink-0 items-center gap-2 border-b border-white/[0.06] px-4 py-3">
            <span className="relative flex size-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-red-500" />
            </span>
            <span className="text-[10px] font-extrabold tracking-widest text-white uppercase">
              Live Session
            </span>
          </div>


          {/* Progress */}
          {allPages.length > 0 && (
            <div className="shrink-0 border-b border-white/[0.06] px-4 py-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[11px] font-bold text-white">Progress</span>
                <span className="font-mono text-[10px] font-semibold text-slate-400">
                  Page {currentPageNum} of {allPages.length}
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 transition-all duration-700"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <span className="mt-1.5 block text-[9px] font-semibold text-slate-500">
                {progressPct}% Complete
              </span>
            </div>
          )}

          {/* Class Notes / Transcript */}
          <div className="flex flex-1 flex-col overflow-hidden">
            <div className="flex shrink-0 items-center gap-1.5 border-b border-white/[0.06] px-4 py-2">
              <BookOpen className="size-3 text-violet-400" />
              <span className="text-[10px] font-bold text-white">Class Notes</span>
            </div>
            {/* AgentChatTranscript uses StickToBottom internally — auto-scrolls to latest message */}
            <AgentChatTranscript
              agentState={agentState}
              messages={messages}
              className="flex-1 text-[11px] leading-relaxed text-slate-300 [&_.is-user>div]:rounded-xl [&_.is-user>div]:bg-violet-900/40 [&_.is-user>div]:px-2 [&_.is-user>div]:py-1 [&>div>div]:px-2 [&>div>div]:pt-2"
            />
          </div>
        </div>


        {/* ── CENTER: PDF STAGE ── */}
        <div className="relative flex flex-1 flex-col overflow-hidden bg-[#0b0b18]">
          {allPages.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-6 p-6 text-center">
              <motion.div
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                className="flex size-24 items-center justify-center rounded-3xl border border-violet-500/30 bg-violet-950/40 shadow-xl"
              >
                <BookOpen className="size-12 text-violet-400" />
              </motion.div>
              <div>
                <p className="text-xl font-bold text-white">PDF Stage Ready</p>
                <p className="mt-2 max-w-xs text-sm font-medium text-slate-400">
                  {pdfName
                    ? `Loading "${cleanPdfName(pdfName)}"...`
                    : 'Waiting for Professor Sage to start the lesson...'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="size-2 animate-bounce rounded-full bg-violet-500 [animation-delay:0ms]" />
                <span className="size-2 animate-bounce rounded-full bg-violet-400 [animation-delay:150ms]" />
                <span className="size-2 animate-bounce rounded-full bg-violet-300 [animation-delay:300ms]" />
              </div>
            </div>
          ) : viewMode === 'slider' ? (
            <div className="relative flex flex-1 items-center justify-center overflow-hidden p-4 pb-[100px]">
              <AnimatePresence mode="wait">
                {activePageObj && (
                  <motion.div
                    key={activePageObj.pageNum}
                    initial={{ opacity: 0, x: 40, scale: 0.97 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={{ opacity: 0, x: -40, scale: 0.97 }}
                    transition={{ duration: 0.3, ease: 'easeInOut' }}
                    className="relative flex max-h-full max-w-full items-center justify-center"
                  >
                    <img
                      src={`/api/pdf-image/${activePageObj.pageImage}`}
                      alt={`PDF Page ${activePageObj.pageNum}`}
                      onLoad={handleImageLoaded}
                      onError={handleImageLoaded}
                      className="max-h-[calc(100vh-230px)] max-w-full rounded-2xl border border-slate-700/40 bg-white object-contain shadow-2xl"
                      style={{ boxShadow: '0 0 60px rgba(109,40,217,0.3)' }}
                    />

                    {/* Teaching / Browsing badge */}
                    <div className="absolute top-3 left-3 z-20">
                      {activePageObj.pageNum === currentPageNum ? (
                        <span className="flex items-center gap-1.5 rounded-lg border border-violet-500/30 bg-[#160d30]/90 px-3 py-1.5 text-[11px] font-bold text-violet-300 shadow-md backdrop-blur-sm">
                          <span className="size-1.5 animate-ping rounded-full bg-violet-400" />
                          Teaching Page {activePageObj.pageNum}
                        </span>
                      ) : (
                        <span className="rounded-lg border border-amber-500/30 bg-[#1a1000]/90 px-3 py-1.5 text-[11px] font-bold text-amber-300 shadow-md backdrop-blur-sm">
                          Browsing Page {activePageObj.pageNum}
                        </span>
                      )}
                    </div>

                    {/* Expand button */}
                    <button
                      onClick={() => setExpandedImage(`/api/pdf-image/${activePageObj.pageImage}`)}
                      className="absolute top-3 right-3 z-20 cursor-pointer rounded-xl border border-white/10 bg-[#0b0b18]/80 p-2 text-slate-300 shadow-md backdrop-blur-md transition hover:bg-[#160d30] hover:text-white"
                    >
                      <Maximize2 className="size-4" />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {activeSlidePageNum > 1 && (
                <button
                  onClick={() => handleSelectSlide(activeSlidePageNum - 1)}
                  className="absolute top-1/2 left-2 z-30 flex size-10 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-white/10 bg-[#0f0f20]/90 text-white shadow-xl backdrop-blur-md transition hover:border-violet-400 hover:bg-violet-600"
                >
                  <ChevronLeft className="size-5" />
                </button>
              )}

              {activeSlidePageNum < allPages.length && (
                <button
                  onClick={() => handleSelectSlide(activeSlidePageNum + 1)}
                  className="absolute top-1/2 right-2 z-30 flex size-10 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-white/10 bg-[#0f0f20]/90 text-white shadow-xl backdrop-blur-md transition hover:border-violet-400 hover:bg-violet-600"
                >
                  <ChevronRight className="size-5" />
                </button>
              )}
            </div>
          ) : (
            <div
              ref={scrollContainerRef}
              className="flex-1 space-y-6 overflow-x-hidden overflow-y-auto px-4 pt-4 pb-6"
              style={{ scrollbarWidth: 'thin', scrollbarColor: '#7c3aed40 transparent' }}
            >
              {allPages.map(({ pageNum, pageImage }) => {
                const isCurrentPage = pageNum === currentPageNum;
                return (
                  <motion.div
                    key={pageNum}
                    ref={(el) => {
                      pageRefs.current[pageNum] = el;
                    }}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: pageNum * 0.03 }}
                    className={cn(
                      'relative mx-auto w-full max-w-3xl overflow-hidden rounded-2xl border bg-white transition-all duration-500',
                      isCurrentPage
                        ? 'border-violet-500 shadow-[0_0_40px_rgba(139,92,246,0.3)]'
                        : 'border-slate-700 opacity-70 hover:opacity-100'
                    )}
                  >
                    {isCurrentPage && (
                      <div className="absolute top-3 left-3 z-20 flex items-center gap-1.5 rounded-full border border-violet-400/40 bg-violet-600 px-3 py-1 text-[11px] font-bold text-white shadow-md">
                        <span className="size-1.5 animate-ping rounded-full bg-white" />
                        Teaching Now
                      </div>
                    )}
                    <div className="absolute top-3 right-3 z-20 rounded-lg border border-slate-700 bg-slate-900/90 px-2.5 py-1 font-mono text-[11px] font-bold text-slate-200 shadow-sm backdrop-blur-sm">
                      Page {pageNum}
                    </div>
                    <button
                      onClick={() => setExpandedImage(`/api/pdf-image/${pageImage}`)}
                      className="absolute right-3 bottom-3 z-20 cursor-pointer rounded-lg border border-slate-700 bg-slate-900/90 p-1.5 text-slate-300 shadow-sm backdrop-blur-sm hover:text-white"
                    >
                      <Maximize2 className="size-3.5" />
                    </button>
                    <img
                      src={`/api/pdf-image/${pageImage}`}
                      alt={`PDF Page ${pageNum}`}
                      className="w-full bg-white object-contain"
                      loading={pageNum <= 3 ? 'eager' : 'lazy'}
                    />
                  </motion.div>
                );
              })}
            </div>
          )}

          {/* ══ BOTTOM STRIP + CONTROLS ══ */}
          {allPages.length > 0 && viewMode === 'slider' && (
            <div className="absolute inset-x-0 bottom-0 z-40 border-t border-white/[0.06] bg-[#0f0f20]/95 backdrop-blur-xl">
              <div
                ref={thumbnailStripRef}
                className="flex items-center gap-1.5 overflow-x-auto px-4 py-2"
                style={{ scrollbarWidth: 'none' }}
              >
                {allPages.map(({ pageNum, pageImage }) => {
                  const isActive = pageNum === activeSlidePageNum;
                  const isTeaching = pageNum === currentPageNum;
                  return (
                    <button
                      key={pageNum}
                      data-page={pageNum}
                      onClick={() => handleSelectSlide(pageNum)}
                      className={cn(
                        'group relative shrink-0 cursor-pointer overflow-hidden rounded-lg border-2 transition-all duration-200',
                        isActive
                          ? 'scale-110 border-violet-500 shadow-[0_0_14px_rgba(139,92,246,0.6)]'
                          : isTeaching
                            ? 'border-violet-400/40 opacity-80'
                            : 'border-white/10 opacity-50 hover:border-white/30 hover:opacity-90'
                      )}
                    >
                      <img
                        src={`/api/pdf-image/${pageImage}`}
                        alt={`Thumb ${pageNum}`}
                        className="h-10 w-8 bg-white object-cover"
                      />
                      <span className="absolute inset-x-0 bottom-0 bg-[#0b0b18]/90 text-center font-mono text-[8px] font-bold text-slate-300">
                        {pageNum}
                      </span>
                      {isTeaching && (
                        <span className="absolute top-0.5 right-0.5 size-1.5 animate-pulse rounded-full bg-violet-400" />
                      )}
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center justify-center pt-0.5 pb-2">
                <AgentControlBar
                  variant="livekit"
                  controls={{
                    leave: true,
                    microphone: false,
                    chat: false,
                    camera: false,
                    screenShare: false,
                  }}
                  isChatOpen={false}
                  isConnected={isConnected}
                  onDisconnect={onDisconnect}
                  onIsChatOpenChange={() => {}}
                />
              </div>
            </div>
          )}

          {(allPages.length === 0 || viewMode === 'list') && (
            <motion.div {...BOTTOM_VIEW_MOTION_PROPS} className="absolute inset-x-0 bottom-0 z-50">
              <div className="relative mx-auto max-w-2xl rounded-t-2xl border-t border-white/[0.06] bg-[#0f0f20]/95 pb-3 shadow-2xl backdrop-blur-md md:pb-8">
                <AgentControlBar
                  variant="livekit"
                  controls={{
                    leave: true,
                    microphone: false,
                    chat: false,
                    camera: false,
                    screenShare: false,
                  }}
                  isChatOpen={false}
                  isConnected={isConnected}
                  onDisconnect={onDisconnect}
                  onIsChatOpenChange={() => {}}
                />
              </div>
            </motion.div>
          )}

          {/* ══ AI AVATAR PIP — Professor Sage lip-sync window ══ */}
          <div
            className={cn(
              'absolute right-4 z-40 overflow-hidden rounded-2xl border-2 border-violet-500/60 bg-[#0c0a1d]/95 shadow-[0_8px_48px_rgba(124,58,237,0.35)] backdrop-blur-xl transition-all duration-300',
              allPages.length > 0 && viewMode === 'slider'
                ? 'bottom-20 h-48 w-64 md:h-56 md:w-72'
                : 'bottom-16 h-48 w-64 md:h-56 md:w-72'
            )}
          >
            {/* Glowing border accent */}
            <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-violet-400/20" />
            {/* Live badge */}
            <div className="absolute top-2 left-2.5 z-40 flex items-center gap-1.5 rounded-full border border-violet-400/40 bg-[#0b0b18]/90 px-2.5 py-1 text-[9px] font-bold text-violet-300 backdrop-blur-md shadow-md">
              <span className="size-1.5 animate-pulse rounded-full bg-violet-400" />
              Professor Sage · Live
            </div>
            <div className="h-full w-full">
              <TileLayout
                isPip={true}
                chatOpen={false}
                avatarUrl={avatarUrl}
                audioVisualizerType={
                  audioVisualizerType as 'bar' | 'wave' | 'grid' | 'radial' | 'aura'
                }
                audioVisualizerColor={audioVisualizerColor ?? '#7c3aed'}
                audioVisualizerColorShift={audioVisualizerColorShift}
                audioVisualizerBarCount={10}
                audioVisualizerRadialBarCount={audioVisualizerRadialBarCount}
                audioVisualizerRadialRadius={audioVisualizerRadialRadius}
                audioVisualizerGridRowCount={audioVisualizerGridRowCount}
                audioVisualizerGridColumnCount={audioVisualizerGridColumnCount}
                audioVisualizerWaveLineWidth={audioVisualizerWaveLineWidth}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Full-screen image modal */}
      <AnimatePresence>
        {expandedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/92 p-6 backdrop-blur-md"
            onClick={() => setExpandedImage(null)}
          >
            <div
              className="relative max-h-[95vh] max-w-[95vw] overflow-hidden rounded-2xl border border-white/20"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setExpandedImage(null)}
                className="absolute top-4 right-4 z-10 flex size-9 cursor-pointer items-center justify-center rounded-full bg-black/70 text-white transition hover:bg-black"
              >
                <X className="size-5" />
              </button>
              <img
                src={expandedImage}
                alt="PDF Page"
                className="max-h-[95vh] max-w-[95vw] rounded-2xl object-contain"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main AgentSessionView_01 ───────────────────────────────────────────────────
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

  // ── Block microphone for AI Tutor (output-only) ─────────────────────────────
  // The mic button is already hidden, but we must also mute the actual LiveKit
  // audio track so no user audio is sent to the backend at all.
  useEffect(() => {
    if (agentId !== 'tutor') return;
    const room = session.room;
    if (!room) return;

    const muteMic = async () => {
      try {
        // Ensure the mic track is disabled/muted at the LiveKit level
        await room.localParticipant.setMicrophoneEnabled(false);
        console.log('[AiTutor] Microphone muted — tutor is output-only.');
      } catch (err) {
        console.warn('[AiTutor] Could not mute mic:', err);
      }
    };

    muteMic();

    // Re-mute if connection state changes (e.g. reconnect)
    room.on('connected', muteMic);
    return () => {
      room.off('connected', muteMic);
    };
  }, [agentId, session.room]);



  if (agentId === 'tutor') {
    return (
      <section
        ref={ref}
        className={cn('bg-background/80 relative z-10 h-full w-full overflow-hidden', className)}
        {...props}
      >
        <TutorClassroomLayout
          avatarUrl={avatarUrl}
          audioVisualizerType={audioVisualizerType}
          audioVisualizerColor={audioVisualizerColor}
          audioVisualizerColorShift={audioVisualizerColorShift}
          audioVisualizerGridRowCount={audioVisualizerGridRowCount}
          audioVisualizerGridColumnCount={audioVisualizerGridColumnCount}
          audioVisualizerRadialBarCount={audioVisualizerRadialBarCount}
          audioVisualizerRadialRadius={audioVisualizerRadialRadius}
          audioVisualizerWaveLineWidth={audioVisualizerWaveLineWidth}
          isConnected={session.isConnected}
          onDisconnect={session.end}
          messages={messages}
          agentState={agentState}
        />
        <NewsOverlay key={newsOverlayKey} />
      </section>
    );
  }

  return (
    <section
      ref={ref}
      className={cn('bg-background/80 relative z-10 h-full w-full overflow-hidden', className)}
      {...props}
    >
      <div className="absolute inset-0 flex">
        <div className="hidden w-[300px] shrink-0 flex-col border-r border-white/5 lg:flex">
          <div className="flex items-center gap-2 border-b border-white/5 px-4 py-3">
            <span className="relative flex size-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-cyan-500" />
            </span>
            <h3 className="gradient-text text-[10px] font-bold tracking-widest uppercase">
              Live Transcript
            </h3>
          </div>
          <div className="relative flex-1 overflow-hidden">
            <Fade top className="absolute inset-x-0 top-0 z-10 h-8" />
            <AgentChatTranscript
              agentState={agentState}
              messages={messages}
              className="h-full [&_.is-user>div]:rounded-[18px] [&>div>div]:px-3 [&>div>div]:pt-10"
            />
          </div>
        </div>

        <div className="relative flex flex-1 flex-col">
          <Fade top className="absolute inset-x-4 top-0 z-10 h-40" />
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
          <motion.div
            {...BOTTOM_VIEW_MOTION_PROPS}
            className="absolute inset-x-3 bottom-0 z-50 md:inset-x-12"
          >
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

        <div className="hidden w-[320px] shrink-0 flex-col gap-3 border-l border-white/5 p-3 xl:flex">
          <div className="flex-1 overflow-hidden">
            <NewsPanel agentId={agentId} />
          </div>
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

      <NotebookPanel isOpen={notebookOpen} onClose={() => setNotebookOpen(false)} />
      <NewsOverlay key={newsOverlayKey} />
      <div className="fixed right-3 bottom-36 z-[100] flex flex-col gap-2 xl:hidden">
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
