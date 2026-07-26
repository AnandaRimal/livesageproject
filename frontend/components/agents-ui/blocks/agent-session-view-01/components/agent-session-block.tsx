'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  FileTextIcon,
  NewspaperIcon,
  GraduationCap,
  X,
  BookOpen,
  Maximize2,
  ChevronLeft,
  ChevronRight,
  Layers,
  Sparkles,
  RotateCcw,
} from 'lucide-react';
import { AnimatePresence, type MotionProps, motion } from 'motion/react';
import { useAgent, useDataChannel, useSessionContext, useSessionMessages } from '@livekit/components-react';
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

// ── Tutor Classroom Layout ────────────────────────────────────────────────────
function TutorClassroomLayout({
  avatarUrl,
  audioVisualizerType,
  audioVisualizerColor,
  audioVisualizerColorShift,
  audioVisualizerBarCount,
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
  audioVisualizerBarCount?: number;
  audioVisualizerGridRowCount?: number;
  audioVisualizerGridColumnCount?: number;
  audioVisualizerRadialBarCount?: number;
  audioVisualizerRadialRadius?: number;
  audioVisualizerWaveLineWidth?: number;
  isConnected: boolean;
  onDisconnect: () => void;
  messages: any[];
  agentState: any;
}) {
  // All PDF pages from backend
  const [allPages, setAllPages] = useState<PageEntry[]>([]);
  const [pdfName, setPdfName] = useState<string>('');
  const [totalChunks, setTotalChunks] = useState<number>(0);
  const [chunkIndex, setChunkIndex] = useState<number>(0);

  // Active teaching page (pushed by teacher backend)
  const [currentPageNum, setCurrentPageNum] = useState<number>(1);

  // Active slider page (user view slide, defaults to currentPageNum)
  const [activeSlidePageNum, setActiveSlidePageNum] = useState<number>(1);
  const [userIsBrowsing, setUserIsBrowsing] = useState<boolean>(false);

  // View mode: 'slider' (default auto page slider stage) vs 'list' (scrollable all-pages list)
  const [viewMode, setViewMode] = useState<'slider' | 'list'>('slider');

  const [status, setStatus] = useState<string>('starting');
  const [lessonTitle, setLessonTitle] = useState<string>('');
  const [expandedImage, setExpandedImage] = useState<string | null>(null);

  const pageRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const thumbnailStripRef = useRef<HTMLDivElement>(null);

  // Instantly fetch the latest uploaded PDF pages on mount
  useEffect(() => {
    fetch('/api/pdf-pages/latest')
      .then((res) => res.json())
      .then((data) => {
        if (data.pages && data.pages.length > 0) {
          setAllPages((prev) => (prev.length === 0 ? data.pages : prev));
          if (data.pdfName) setPdfName((prev) => prev || data.pdfName);
        }
      })
      .catch((err) => console.error('[TutorClassroomLayout] Error fetching PDF pages:', err));
  }, []);

  // Listen to LiveKit data channel for live teacher updates
  useDataChannel('agent-ui', (msg) => {
    try {
      const data = JSON.parse(new TextDecoder().decode(msg.payload));

      if (data.type === 'tutor_pdf_ready') {
        if (data.allPages && data.allPages.length > 0) {
          setAllPages(data.allPages as PageEntry[]);
        }
        if (data.pdfName) setPdfName(data.pdfName);
        if (typeof data.totalChunks === 'number') setTotalChunks(data.totalChunks);
      } else if (data.type === 'tutor_whiteboard') {
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
      } else if (data.type === 'tutor_state') {
        if (data.pageNum) {
          setCurrentPageNum(data.pageNum);
          if (!userIsBrowsing) setActiveSlidePageNum(data.pageNum);
        }
        if (data.status) setStatus(data.status);
        if (data.lessonTitle) setLessonTitle(data.lessonTitle);
        if (typeof data.chunkIndex === 'number') setChunkIndex(data.chunkIndex);
        if (typeof data.totalChunks === 'number') setTotalChunks(data.totalChunks);
      }
    } catch {
      /* ignore */
    }
  });

  // Auto-slide to teaching page when teacher advances (unless user clicked another page)
  useEffect(() => {
    if (!userIsBrowsing) {
      setActiveSlidePageNum(currentPageNum);
    }
  }, [currentPageNum, userIsBrowsing]);

  // Scroll to active page element in list mode
  useEffect(() => {
    if (viewMode === 'list') {
      const el = pageRefs.current[currentPageNum];
      if (el && scrollContainerRef.current) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [currentPageNum, viewMode]);

  const handleSelectSlide = (pageNum: number) => {
    setActiveSlidePageNum(pageNum);
    if (pageNum !== currentPageNum) {
      setUserIsBrowsing(true);
    } else {
      setUserIsBrowsing(false);
    }
  };

  const handleSyncToTeacher = () => {
    setActiveSlidePageNum(currentPageNum);
    setUserIsBrowsing(false);
  };

  const activePageObj = allPages.find((p) => p.pageNum === activeSlidePageNum) || allPages[0];

  const statusColors: Record<string, string> = {
    starting: 'bg-amber-500',
    teaching: 'bg-violet-500',
    advancing: 'bg-cyan-500',
    complete: 'bg-emerald-500',
  };
  const dotColor = statusColors[status] ?? 'bg-blue-500';

  return (
    <div className="absolute inset-0 flex overflow-hidden">
      {/* ── LEFT PANEL: Live speaking transcript ── */}
      <div className="hidden w-[260px] shrink-0 flex-col border-r border-white/10 bg-black/50 backdrop-blur-xl lg:flex">
        {/* Header */}
        <div className="flex items-center gap-2.5 border-b border-white/10 px-4 py-3 bg-violet-950/30 shrink-0">
          <span className="relative flex size-2">
            <span className={cn('absolute inline-flex h-full w-full animate-ping rounded-full opacity-75', dotColor)} />
            <span className={cn('relative inline-flex size-2 rounded-full', dotColor)} />
          </span>
          <h3 className="text-[11px] font-bold tracking-widest text-violet-300 uppercase">
            Live Session
          </h3>
        </div>

        {/* Lesson meta & progress */}
        <div className="shrink-0 px-4 py-3 space-y-2 border-b border-white/10 bg-violet-950/10">
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-violet-400 font-semibold uppercase tracking-wider flex items-center gap-1">
              <GraduationCap className="size-3" /> Professor Sage
            </p>
            {currentPageNum > 0 && (
              <span className="rounded-md bg-violet-500/20 px-2 py-0.5 text-[10px] font-mono text-violet-300 border border-violet-500/20">
                Page {currentPageNum}
              </span>
            )}
          </div>
          {lessonTitle && (
            <p className="text-xs font-bold text-slate-100 line-clamp-2">{lessonTitle}</p>
          )}
          {pdfName && (
            <p className="text-[10px] text-slate-500 truncate" title={pdfName}>
              📄 {pdfName}
            </p>
          )}
          {totalChunks > 0 && (
            <div>
              <div className="flex justify-between text-[9px] text-slate-500 mb-1 font-mono">
                <span>Progress</span>
                <span>{chunkIndex}/{totalChunks}</span>
              </div>
              <div className="h-1 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-violet-500 via-purple-500 to-indigo-500 transition-all duration-700"
                  style={{ width: `${Math.min(100, (chunkIndex / totalChunks) * 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Live chat transcript — what model is saying */}
        <div className="relative flex-1 overflow-hidden">
          <Fade top className="absolute inset-x-0 top-0 z-10 h-8" />
          <AgentChatTranscript
            agentState={agentState}
            messages={messages}
            className="h-full [&_.is-user>div]:rounded-[14px] [&>div>div]:px-3 [&>div>div]:pt-6 text-xs"
          />
          <Fade bottom className="absolute inset-x-0 bottom-0 z-10 h-8" />
        </div>
      </div>

      {/* ── CENTER: PDF Auto-Slider Stage ── */}
      <div className="relative flex flex-1 flex-col overflow-hidden bg-zinc-950">
        {/* Top Toolbar: View mode toggle & Sync button */}
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-2 bg-black/40 backdrop-blur-md z-30 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-violet-400 uppercase tracking-wider flex items-center gap-1.5">
              <BookOpen className="size-3.5" /> {pdfName || 'Textbook Stage'}
            </span>
            {allPages.length > 0 && (
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-mono text-slate-400">
                {allPages.length} pages
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Sync to Teacher button (if browsing away) */}
            {userIsBrowsing && activeSlidePageNum !== currentPageNum && (
              <button
                onClick={handleSyncToTeacher}
                className="flex items-center gap-1.5 rounded-full bg-violet-600 px-3 py-1 text-[10px] font-bold text-white shadow-lg hover:bg-violet-500 transition cursor-pointer animate-pulse"
              >
                <RotateCcw className="size-3" /> Sync to Teacher (Page {currentPageNum})
              </button>
            )}

            {/* View Mode Toggle */}
            <div className="flex items-center rounded-lg bg-white/5 p-1 border border-white/10">
              <button
                onClick={() => setViewMode('slider')}
                className={cn(
                  'flex items-center gap-1 rounded-md px-2.5 py-1 text-[10px] font-semibold transition cursor-pointer',
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
                  'flex items-center gap-1 rounded-md px-2.5 py-1 text-[10px] font-semibold transition cursor-pointer',
                  viewMode === 'list'
                    ? 'bg-violet-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                )}
              >
                <Layers className="size-3" /> All Pages
              </button>
            </div>
          </div>
        </div>

        {/* ── STAGE CONTENT ── */}
        {allPages.length === 0 ? (
          /* Placeholder before PDF loads */
          <div className="flex-1 flex flex-col items-center justify-center gap-6 text-center p-6">
            <motion.div
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              className="flex size-24 items-center justify-center rounded-3xl bg-violet-950/40 border border-violet-500/20"
            >
              <BookOpen className="size-12 text-violet-400/70" />
            </motion.div>
            <div>
              <p className="text-xl font-bold text-slate-200">PDF Stage Ready</p>
              <p className="text-sm text-slate-500 mt-2 max-w-xs">
                {pdfName ? `Loading "${pdfName}"...` : 'Waiting for Professor Sage to start the lesson...'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="size-2 animate-bounce rounded-full bg-violet-500 [animation-delay:0ms]" />
              <span className="size-2 animate-bounce rounded-full bg-violet-400 [animation-delay:150ms]" />
              <span className="size-2 animate-bounce rounded-full bg-violet-300 [animation-delay:300ms]" />
            </div>
          </div>
        ) : viewMode === 'slider' ? (
          /* ── MODE A: AUTO PAGE SLIDER STAGE ── */
          <div className="relative flex-1 flex flex-col items-center justify-center overflow-hidden p-2 pb-24">
            {/* Slide Stage Container */}
            <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
              <AnimatePresence mode="wait">
                {activePageObj && (
                  <motion.div
                    key={activePageObj.pageNum}
                    initial={{ opacity: 0, x: 50, scale: 0.96 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={{ opacity: 0, x: -50, scale: 0.96 }}
                    transition={{ duration: 0.35, ease: 'easeInOut' }}
                    className="relative max-h-full max-w-full flex items-center justify-center"
                  >
                    {/* Render active slide page image */}
                    <img
                      src={`/api/pdf-image/${activePageObj.pageImage}`}
                      alt={`PDF Page ${activePageObj.pageNum}`}
                      className="max-h-[72vh] max-w-full rounded-2xl object-contain shadow-2xl border border-white/10 bg-white"
                      style={{ boxShadow: '0 0 50px rgba(139,92,246,0.2)' }}
                    />

                    {/* Page Badges */}
                    <div className="absolute top-3 left-3 flex items-center gap-2 z-20">
                      {activePageObj.pageNum === currentPageNum ? (
                        <span className="flex items-center gap-1.5 rounded-full bg-violet-600/90 px-3 py-1 text-[11px] font-bold text-white backdrop-blur-md border border-violet-400/40">
                          <span className="size-1.5 animate-ping rounded-full bg-white" />
                          Teaching Page {activePageObj.pageNum}
                        </span>
                      ) : (
                        <span className="rounded-full bg-slate-900/80 px-3 py-1 text-[11px] font-bold text-amber-300 backdrop-blur-md border border-amber-500/30">
                          Browsing Page {activePageObj.pageNum}
                        </span>
                      )}
                    </div>

                    {/* Expand button */}
                    <button
                      onClick={() => setExpandedImage(`/api/pdf-image/${activePageObj.pageImage}`)}
                      className="absolute top-3 right-3 z-20 rounded-xl bg-black/70 border border-white/10 p-2 text-slate-300 hover:text-white hover:border-white/30 transition backdrop-blur-md cursor-pointer"
                    >
                      <Maximize2 className="size-4" />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Prev Slide Button */}
              {activeSlidePageNum > 1 && (
                <button
                  onClick={() => handleSelectSlide(activeSlidePageNum - 1)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 z-30 flex size-11 items-center justify-center rounded-full bg-black/70 border border-white/20 text-white shadow-xl hover:bg-violet-600 hover:border-violet-400 transition cursor-pointer backdrop-blur-md"
                  title="Previous Page"
                >
                  <ChevronLeft className="size-6" />
                </button>
              )}

              {/* Next Slide Button */}
              {activeSlidePageNum < allPages.length && (
                <button
                  onClick={() => handleSelectSlide(activeSlidePageNum + 1)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 z-30 flex size-11 items-center justify-center rounded-full bg-black/70 border border-white/20 text-white shadow-xl hover:bg-violet-600 hover:border-violet-400 transition cursor-pointer backdrop-blur-md"
                  title="Next Page"
                >
                  <ChevronRight className="size-6" />
                </button>
              )}
            </div>

            {/* Bottom Page Thumbnails Slider Carousel */}
            <div
              ref={thumbnailStripRef}
              className="absolute bottom-20 inset-x-4 z-30 flex items-center justify-center gap-2 overflow-x-auto py-2 px-4 rounded-2xl bg-black/70 border border-white/10 backdrop-blur-xl"
              style={{ scrollbarWidth: 'none' }}
            >
              {allPages.map(({ pageNum, pageImage }) => {
                const isActive = pageNum === activeSlidePageNum;
                const isTeaching = pageNum === currentPageNum;
                return (
                  <button
                    key={pageNum}
                    onClick={() => handleSelectSlide(pageNum)}
                    className={cn(
                      'relative shrink-0 rounded-lg overflow-hidden border-2 transition-all cursor-pointer group',
                      isActive
                        ? 'border-violet-500 scale-110 shadow-[0_0_15px_rgba(139,92,246,0.6)]'
                        : 'border-white/10 opacity-50 hover:opacity-100 hover:border-white/30'
                    )}
                  >
                    <img
                      src={`/api/pdf-image/${pageImage}`}
                      alt={`Thumb ${pageNum}`}
                      className="h-12 w-9 object-cover bg-white"
                    />
                    <span className="absolute bottom-0 inset-x-0 bg-black/80 text-[9px] font-mono text-center text-slate-200">
                      {pageNum}
                    </span>
                    {isTeaching && (
                      <span className="absolute top-0 right-0 size-2 rounded-full bg-violet-400 animate-pulse border border-black" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          /* ── MODE B: ALL PAGES LIST VIEW ── */
          <div
            ref={scrollContainerRef}
            className="flex-1 overflow-y-auto overflow-x-hidden px-4 pt-4 pb-24 space-y-6"
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
                  transition={{ duration: 0.4, delay: pageNum * 0.05 }}
                  className={cn(
                    'relative mx-auto rounded-2xl overflow-hidden transition-all duration-500',
                    'max-w-3xl w-full',
                    isCurrentPage
                      ? 'ring-2 ring-violet-500 ring-offset-2 ring-offset-zinc-950 shadow-[0_0_40px_rgba(139,92,246,0.3)]'
                      : 'opacity-60 hover:opacity-90'
                  )}
                >
                  {isCurrentPage && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="absolute top-3 left-3 z-20 flex items-center gap-1.5 rounded-full bg-violet-600/90 px-3 py-1 text-[11px] font-bold text-white backdrop-blur-sm border border-violet-400/40"
                    >
                      <span className="size-1.5 animate-ping rounded-full bg-white" />
                      Teaching Now
                    </motion.div>
                  )}

                  <div className="absolute top-3 right-3 z-20 rounded-lg bg-black/70 border border-white/10 px-2.5 py-1 text-[11px] font-mono font-bold text-slate-300 backdrop-blur-sm">
                    Page {pageNum}
                  </div>

                  <button
                    onClick={() => setExpandedImage(`/api/pdf-image/${pageImage}`)}
                    className="absolute bottom-3 right-3 z-20 rounded-lg bg-black/70 border border-white/10 p-1.5 text-slate-400 hover:text-white transition cursor-pointer backdrop-blur-sm"
                  >
                    <Maximize2 className="size-3.5" />
                  </button>

                  <img
                    src={`/api/pdf-image/${pageImage}`}
                    alt={`PDF Page ${pageNum}`}
                    className="w-full object-contain bg-white"
                    loading={pageNum <= 3 ? 'eager' : 'lazy'}
                  />
                </motion.div>
              );
            })}
          </div>
        )}

        {/* ── Small Professor Sage PIP Avatar — bottom-right ── */}
        <div className="absolute bottom-24 right-4 z-30 w-44 h-36 sm:w-52 sm:h-44 rounded-2xl border border-violet-500/40 bg-black/90 shadow-2xl overflow-hidden backdrop-blur-xl hover:border-violet-400/70 transition-all">
          <div className="absolute top-2 left-2 z-40 rounded-full bg-violet-600/70 px-2 py-0.5 text-[9px] font-bold text-violet-100 backdrop-blur-sm border border-violet-400/30">
            Professor Sage
          </div>
          <div className="absolute top-2 right-2 z-40 flex items-center gap-0.5">
            <span className="size-1.5 animate-ping rounded-full bg-violet-400 opacity-80" />
            <span className="size-1.5 rounded-full bg-violet-400" />
          </div>
          <div className="h-full w-full">
            <TileLayout
              chatOpen={false}
              avatarUrl={avatarUrl}
              audioVisualizerType={audioVisualizerType as any}
              audioVisualizerColor={audioVisualizerColor}
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

        {/* Bottom control bar */}
        <motion.div {...BOTTOM_VIEW_MOTION_PROPS} className="absolute inset-x-0 bottom-0 z-50">
          <div className="bg-background/70 relative mx-auto max-w-2xl rounded-t-2xl pb-3 backdrop-blur-md md:pb-10">
            <Fade bottom className="absolute inset-x-0 top-0 h-4 -translate-y-full" />
            <AgentControlBar
              variant="livekit"
              controls={{ leave: true, microphone: true, chat: false, camera: false, screenShare: false }}
              isChatOpen={false}
              isConnected={isConnected}
              onDisconnect={onDisconnect}
              onIsChatOpenChange={() => {}}
            />
          </div>
        </motion.div>
      </div>

      {/* Full-screen page modal */}
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
                className="absolute top-4 right-4 z-10 flex size-9 items-center justify-center rounded-full bg-black/70 text-white hover:bg-black transition cursor-pointer"
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

  // AI Tutor gets its own purpose-built layout
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
          audioVisualizerBarCount={audioVisualizerBarCount}
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

  // Standard agent layout
  return (
    <section
      ref={ref}
      className={cn('bg-background/80 relative z-10 h-full w-full overflow-hidden', className)}
      {...props}
    >
      <div className="absolute inset-0 flex">
        {/* LEFT: Chat Transcript */}
        <div className="hidden w-[300px] shrink-0 flex-col border-r border-white/5 lg:flex">
          <div className="flex items-center gap-2 border-b border-white/5 px-4 py-3">
            <span className="relative flex size-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-cyan-500" />
            </span>
            <h3 className="gradient-text text-[10px] font-bold tracking-widest uppercase">Live Transcript</h3>
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

        {/* CENTER */}
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
          <motion.div {...BOTTOM_VIEW_MOTION_PROPS} className="absolute inset-x-3 bottom-0 z-50 md:inset-x-12">
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

        {/* RIGHT: News */}
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
