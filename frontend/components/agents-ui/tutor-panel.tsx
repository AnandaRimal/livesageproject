'use client';

import React, { useState } from 'react';
import {
  BookOpen,
  Check,
  Columns2,
  Copy,
  FileText,
  GraduationCap,
  ImageIcon,
  Layers,
  Maximize2,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useDataChannel } from '@livekit/components-react';
import { cn } from '@/lib/shadcn/utils';

export interface TutorStateMessage {
  type: 'tutor_state';
  status: 'starting' | 'teaching' | 'advancing' | 'complete';
  lessonTitle: string;
  chunkIndex: number;
  totalChunks: number;
  pageNum?: number;
}

export interface TutorImageMessage {
  type: 'tutor_image';
  imagePaths: string[];
  pageNum: number;
  hasImages: boolean;
}

export interface TutorWhiteboardMessage {
  type: 'tutor_whiteboard';
  status: 'starting' | 'teaching' | 'advancing' | 'complete';
  lessonTitle: string;
  chunkIndex: number;
  totalChunks: number;
  pageNum?: number;
  text: string;
  imagePaths?: string[];
  pageImage?: string;
  hasImages?: boolean;
}

type MessagePayload = TutorStateMessage | TutorImageMessage | TutorWhiteboardMessage;

export function TutorPanel() {
  const [lessonTitle, setLessonTitle] = useState<string>('Preparing Lesson...');
  const [status, setStatus] = useState<string>('teaching');
  const [chunkIndex, setChunkIndex] = useState<number>(0);
  const [totalChunks, setTotalChunks] = useState<number>(0);
  const [pageNum, setPageNum] = useState<number | null>(null);

  // PDF Page image state
  const [pageImage, setPageImage] = useState<string | null>(null);

  // Whiteboard text state
  const [whiteboardText, setWhiteboardText] = useState<string>(
    'Professor Sage is preparing the materials. Source text and key concepts will appear here on the whiteboard.'
  );

  // Images state
  const [currentImages, setCurrentImages] = useState<string[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [expandedModalImage, setExpandedModalImage] = useState<string | null>(null);

  // View Mode: 'pdf-page' | 'whiteboard' | 'diagrams' | 'split'
  const [viewMode, setViewMode] = useState<'pdf-page' | 'whiteboard' | 'diagrams' | 'split'>(
    'pdf-page'
  );
  const [copied, setCopied] = useState<boolean>(false);

  // Listen to data channel messages on topic "agent-ui"
  useDataChannel('agent-ui', (msg) => {
    try {
      const payloadStr = new TextDecoder().decode(msg.payload);
      const data = JSON.parse(payloadStr) as MessagePayload;

      if (data.type === 'tutor_whiteboard') {
        if (data.lessonTitle) setLessonTitle(data.lessonTitle);
        if (data.status) setStatus(data.status);
        if (typeof data.chunkIndex === 'number') setChunkIndex(data.chunkIndex);
        if (typeof data.totalChunks === 'number') setTotalChunks(data.totalChunks);
        if (data.pageNum) setPageNum(data.pageNum);
        if (data.text) setWhiteboardText(data.text);
        if (data.pageImage) setPageImage(data.pageImage);
        if (data.imagePaths && data.imagePaths.length > 0) {
          setCurrentImages(data.imagePaths);
          setSelectedImage(data.imagePaths[0]);
        } else if (data.hasImages === false) {
          setCurrentImages([]);
          setSelectedImage(null);
        }
      } else if (data.type === 'tutor_state') {
        if (data.lessonTitle) setLessonTitle(data.lessonTitle);
        if (data.status) setStatus(data.status);
        if (typeof data.chunkIndex === 'number') setChunkIndex(data.chunkIndex);
        if (typeof data.totalChunks === 'number') setTotalChunks(data.totalChunks);
        if (data.pageNum) setPageNum(data.pageNum);
      } else if (data.type === 'tutor_image') {
        if (data.imagePaths && data.imagePaths.length > 0) {
          setCurrentImages(data.imagePaths);
          setSelectedImage(data.imagePaths[0]);
        }
      }
    } catch (err) {
      console.error('[TutorPanel] Data channel parse error:', err);
    }
  });

  const getStatusBadge = () => {
    switch (status) {
      case 'starting':
        return {
          label: 'Initializing',
          color: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
        };
      case 'teaching':
        return {
          label: 'Teaching',
          color: 'bg-violet-500/20 text-violet-300 border-violet-500/30',
        };
      case 'advancing':
        return { label: 'Next Section', color: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' };
      case 'complete':
        return {
          label: 'Class Complete',
          color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
        };
      default:
        return {
          label: 'Active Session',
          color: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
        };
    }
  };

  const copyToClipboard = () => {
    if (!whiteboardText) return;
    navigator.clipboard.writeText(whiteboardText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const badge = getStatusBadge();

  return (
    <div className="flex h-full w-full flex-col gap-3 overflow-hidden rounded-2xl border border-white/10 bg-black/50 p-4 font-sans backdrop-blur-xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-3">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-xl border border-violet-500/30 bg-violet-600/30 text-violet-400">
            <GraduationCap className="size-4" />
          </div>
          <div>
            <h3 className="flex items-center gap-1.5 text-xs font-bold tracking-wider text-slate-100 uppercase">
              Professor Sage Whiteboard
            </h3>
            <p className="text-[10px] text-slate-400">Live PDF Teaching & Visual Whiteboard</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* View Mode Switcher */}
          <div className="flex items-center rounded-lg border border-white/10 bg-white/5 p-0.5 text-[11px]">
            <button
              onClick={() => setViewMode('pdf-page')}
              className={cn(
                'flex cursor-pointer items-center gap-1 rounded-md px-2.5 py-1 font-medium transition',
                viewMode === 'pdf-page'
                  ? 'border border-violet-500/40 bg-violet-600/40 text-violet-200 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              )}
              title="PDF Page View"
            >
              <BookOpen className="size-3" />
              <span>PDF Page</span>
            </button>
            <button
              onClick={() => setViewMode('whiteboard')}
              className={cn(
                'flex cursor-pointer items-center gap-1 rounded-md px-2.5 py-1 font-medium transition',
                viewMode === 'whiteboard'
                  ? 'border border-violet-500/40 bg-violet-600/40 text-violet-200 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              )}
              title="Whiteboard Text View"
            >
              <FileText className="size-3" />
              <span>Notes</span>
            </button>
            {currentImages.length > 0 && (
              <>
                <button
                  onClick={() => setViewMode('diagrams')}
                  className={cn(
                    'flex cursor-pointer items-center gap-1 rounded-md px-2.5 py-1 font-medium transition',
                    viewMode === 'diagrams'
                      ? 'border border-cyan-500/40 bg-cyan-600/40 text-cyan-200 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  )}
                  title="Diagram View"
                >
                  <ImageIcon className="size-3" />
                  <span>Diagrams</span>
                </button>
                <button
                  onClick={() => setViewMode('split')}
                  className={cn(
                    'flex cursor-pointer items-center gap-1 rounded-md px-2.5 py-1 font-medium transition',
                    viewMode === 'split'
                      ? 'border border-emerald-500/40 bg-emerald-600/40 text-emerald-200 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  )}
                  title="Split View"
                >
                  <Columns2 className="size-3" />
                  <span>Split</span>
                </button>
              </>
            )}
          </div>

          <span
            className={cn(
              'flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-bold',
              badge.color
            )}
          >
            <span className="size-1.5 animate-pulse rounded-full bg-current" />
            {badge.label}
          </span>
        </div>
      </div>

      {/* Current Lesson Title & Progress Card */}
      <div className="space-y-2 rounded-xl border border-white/10 bg-white/5 p-3">
        <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400">
          <span className="flex items-center gap-1.5">
            <BookOpen className="size-3.5 text-violet-400" /> Current Topic
          </span>
          {pageNum && (
            <span className="rounded-md border border-violet-500/20 bg-violet-500/10 px-2 py-0.5 font-mono text-[10px] text-violet-300">
              PDF Page {pageNum}
            </span>
          )}
        </div>
        <h4 className="line-clamp-2 text-sm leading-snug font-bold text-slate-100">
          {lessonTitle}
        </h4>

        {totalChunks > 0 && (
          <div className="space-y-1 pt-1">
            <div className="flex justify-between font-mono text-[10px] text-slate-400">
              <span>Teaching Progress</span>
              <span>
                {chunkIndex} / {totalChunks} sections
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full bg-gradient-to-r from-violet-500 via-purple-500 to-indigo-500 transition-all duration-500"
                style={{ width: `${Math.min(100, (chunkIndex / totalChunks) * 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Main Content Body */}
      <div className="relative flex flex-1 overflow-hidden rounded-xl border border-white/10 bg-black/70">
        <AnimatePresence mode="wait">
          {viewMode === 'pdf-page' && (
            <motion.div
              key="pdf-page-view"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex h-full w-full flex-col overflow-hidden"
            >
              <div className="flex items-center justify-between border-b border-white/10 bg-white/5 px-3 py-2">
                <span className="flex items-center gap-1.5 text-xs font-bold text-violet-300">
                  <BookOpen className="size-3.5 text-violet-400" />
                  Original PDF Page {pageNum || 1}
                </span>
                {pageImage && (
                  <button
                    onClick={() => setExpandedModalImage(`/api/pdf-image/${pageImage}`)}
                    className="flex cursor-pointer items-center gap-1 rounded-md bg-white/10 px-2 py-1 text-[10px] font-semibold text-slate-300 transition hover:bg-white/20"
                  >
                    <Maximize2 className="size-3" /> Expand Page
                  </button>
                )}
              </div>

              <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-black/80 p-3">
                {pageImage ? (
                  <img
                    src={`/api/pdf-image/${pageImage}`}
                    alt={`PDF Page ${pageNum || 1}`}
                    className="max-h-full max-w-full rounded-lg border border-white/10 object-contain shadow-2xl"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center space-y-2 p-6 text-center text-slate-500">
                    <BookOpen className="size-8 text-slate-500" />
                    <p className="text-xs font-medium text-slate-400">
                      Loading original PDF page...
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
          {viewMode === 'whiteboard' && (
            <motion.div
              key="whiteboard-view"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex h-full w-full flex-col overflow-hidden"
            >
              {/* Whiteboard Header Toolbar */}
              <div className="flex items-center justify-between border-b border-white/10 bg-white/5 px-3 py-2">
                <span className="flex items-center gap-1.5 text-xs font-bold text-violet-300">
                  <FileText className="size-3.5 text-violet-400" />
                  Whiteboard Source Text
                </span>
                <button
                  onClick={copyToClipboard}
                  className="flex cursor-pointer items-center gap-1 rounded-md bg-white/10 px-2 py-1 text-[10px] font-semibold text-slate-300 transition hover:bg-white/20"
                >
                  {copied ? (
                    <Check className="size-3 text-emerald-400" />
                  ) : (
                    <Copy className="size-3" />
                  )}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>

              {/* Whiteboard Content Area */}
              <div className="flex-1 space-y-3 overflow-y-auto bg-gradient-to-b from-slate-950/80 to-black/90 p-4 font-mono text-xs leading-relaxed text-slate-200">
                <div className="rounded-lg border border-violet-500/20 bg-violet-950/20 p-3 text-violet-200">
                  <p className="flex items-center gap-1 font-sans text-[11px] font-semibold text-violet-300">
                    <GraduationCap className="size-3.5" /> Professor Sage is teaching this section
                    in Nepali:
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-4 font-sans text-xs leading-relaxed whitespace-pre-wrap text-slate-300 shadow-inner">
                  {whiteboardText}
                </div>
              </div>
            </motion.div>
          )}

          {viewMode === 'diagrams' && (
            <motion.div
              key="diagrams-view"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex h-full w-full flex-col overflow-hidden"
            >
              <div className="flex items-center justify-between border-b border-white/10 bg-white/5 px-3 py-2">
                <span className="flex items-center gap-1.5 text-xs font-bold text-cyan-300">
                  <ImageIcon className="size-3.5 text-cyan-400" />
                  Extracted PDF Diagram
                </span>
                {selectedImage && (
                  <button
                    onClick={() => setExpandedModalImage(`/api/pdf-image/${selectedImage}`)}
                    className="flex cursor-pointer items-center gap-1 rounded-md bg-white/10 px-2 py-1 text-[10px] font-semibold text-slate-300 transition hover:bg-white/20"
                  >
                    <Maximize2 className="size-3" /> Expand
                  </button>
                )}
              </div>

              <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-black/80 p-3">
                {selectedImage ? (
                  <img
                    src={`/api/pdf-image/${selectedImage}`}
                    alt="Extracted PDF Diagram"
                    className="max-h-full max-w-full rounded-lg object-contain shadow-2xl"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center space-y-2 p-6 text-center text-slate-500">
                    <Layers className="size-8 text-slate-500" />
                    <p className="text-xs font-medium text-slate-400">No diagram on this page</p>
                  </div>
                )}
              </div>

              {currentImages.length > 1 && (
                <div className="flex gap-2 overflow-x-auto border-t border-white/10 bg-white/5 p-2">
                  {currentImages.map((img, idx) => (
                    <button
                      key={img}
                      onClick={() => setSelectedImage(img)}
                      className={cn(
                        'relative h-12 w-16 shrink-0 cursor-pointer overflow-hidden rounded-md border transition',
                        selectedImage === img
                          ? 'border-cyan-500 ring-2 ring-cyan-500/50'
                          : 'border-white/10 opacity-60 hover:opacity-100'
                      )}
                    >
                      <img
                        src={`/api/pdf-image/${img}`}
                        alt={`Thumbnail ${idx + 1}`}
                        className="h-full w-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {viewMode === 'split' && (
            <motion.div
              key="split-view"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="flex h-full w-full flex-col divide-y divide-white/10 overflow-hidden md:flex-row md:divide-x md:divide-y-0"
            >
              {/* Left/Top: Text Whiteboard */}
              <div className="flex flex-1 flex-col overflow-hidden">
                <div className="flex items-center justify-between border-b border-white/10 bg-white/5 px-3 py-1.5">
                  <span className="flex items-center gap-1 text-[11px] font-bold text-violet-300">
                    <FileText className="size-3" /> Whiteboard Text
                  </span>
                </div>
                <div className="flex-1 space-y-2 overflow-y-auto bg-slate-950/60 p-3 font-sans text-xs leading-relaxed text-slate-300">
                  <p className="rounded-lg border border-white/10 bg-white/5 p-3 text-[11px] leading-relaxed whitespace-pre-wrap text-slate-300">
                    {whiteboardText}
                  </p>
                </div>
              </div>

              {/* Right/Bottom: Diagram View */}
              <div className="flex flex-1 flex-col overflow-hidden bg-black/60">
                <div className="flex items-center justify-between border-b border-white/10 bg-white/5 px-3 py-1.5">
                  <span className="flex items-center gap-1 text-[11px] font-bold text-cyan-300">
                    <ImageIcon className="size-3" /> Figure / Diagram
                  </span>
                  {selectedImage && (
                    <button
                      onClick={() => setExpandedModalImage(`/api/pdf-image/${selectedImage}`)}
                      className="flex cursor-pointer items-center gap-1 text-[10px] font-semibold text-slate-300 hover:text-white"
                    >
                      <Maximize2 className="size-2.5" /> Expand
                    </button>
                  )}
                </div>
                <div className="relative flex flex-1 items-center justify-center overflow-hidden p-2">
                  {selectedImage ? (
                    <img
                      src={`/api/pdf-image/${selectedImage}`}
                      alt="Extracted PDF Diagram"
                      className="max-h-full max-w-full rounded-lg object-contain"
                    />
                  ) : (
                    <p className="text-[10px] text-slate-500">No diagram on this page</p>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Expanded Diagram Modal */}
      <AnimatePresence>
        {expandedModalImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-6 backdrop-blur-md"
            onClick={() => setExpandedModalImage(null)}
          >
            <div
              className="relative max-h-[90vh] max-w-[90vw] overflow-hidden rounded-2xl border border-white/20 bg-slate-900 p-2 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setExpandedModalImage(null)}
                className="absolute top-4 right-4 z-10 flex size-8 cursor-pointer items-center justify-center rounded-full bg-black/60 text-white transition hover:bg-black"
              >
                <X className="size-4" />
              </button>
              <img
                src={expandedModalImage}
                alt="Enlarged Diagram"
                className="max-h-[85vh] max-w-[85vw] rounded-xl object-contain"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
