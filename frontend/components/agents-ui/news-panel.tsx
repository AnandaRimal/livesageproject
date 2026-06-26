'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ExternalLinkIcon, NewspaperIcon, TrendingUpIcon, XIcon, SearchIcon, ImageIcon } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useDataChannel } from '@livekit/components-react';

interface NewsArticle {
  title: string;
  summary: string;
  url: string;
  source: string;
}

interface NewsMessage {
  type: 'show_news';
  articles: NewsArticle[];
}

interface ChartDataPoint {
  label: string;
  value: number;
}

interface ChartMessage {
  type: 'show_chart';
  symbol: string;
  title: string;
  data: ChartDataPoint[];
  summary?: string;
}

interface SearchingMessage {
  type: 'searching';
  message: string;
}

interface FinanceImageItem {
  image_path: string;
  title: string;
  subtitle?: string;
}

interface ShowImageMessage {
  type: 'show_image';
  image_path: string;
  title: string;
  subtitle?: string;
  // optional: multiple images for gallery mode
  images?: FinanceImageItem[];
}

type MessagePayload = NewsMessage | ChartMessage | SearchingMessage | ShowImageMessage;

interface NewsPanelProps {
  agentId?: string;
}

export function NewsPanel({ agentId = 'search' }: NewsPanelProps) {
  const isFinance = agentId === 'finance';
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [chartData, setChartData] = useState<ChartMessage | null>(null);
  const [imageData, setImageData] = useState<ShowImageMessage | null>(null);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<'news' | 'charts' | 'image'>('news');
  const [isOpen, setIsOpen] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null);
  const [searchingMessage, setSearchingMessage] = useState<string | null>(null);
  const searchingTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const onMessage = useCallback((msg: { payload: Uint8Array }) => {
    try {
      const text = new TextDecoder().decode(msg.payload);
      const data = JSON.parse(text) as MessagePayload;

      if (data.type === 'searching') {
        // Show loading message immediately, auto-hide after 8 seconds
        setSearchingMessage(data.message);
        if (searchingTimerRef.current) clearTimeout(searchingTimerRef.current);
        searchingTimerRef.current = setTimeout(() => setSearchingMessage(null), 8000);
      } else if (data.type === 'show_news' && Array.isArray(data.articles)) {
        setSearchingMessage(null); // hide loading indicator once results arrive
        if (searchingTimerRef.current) clearTimeout(searchingTimerRef.current);
        setArticles((prev) => {
          // Merge new articles (deduplicate by title)
          const existingTitles = new Set(prev.map((a) => a.title));
          const newOnes = data.articles.filter((a) => !existingTitles.has(a.title));
          return [...prev, ...newOnes];
        });
        setActiveTab('news');
        setIsOpen(true);
      } else if (data.type === 'show_chart' && typeof data.symbol === 'string') {
        setSearchingMessage(null);
        if (searchingTimerRef.current) clearTimeout(searchingTimerRef.current);
        setChartData(data as ChartMessage);
        setActiveTab('charts');
        setIsOpen(true);
      } else if (data.type === 'show_image' && typeof (data as ShowImageMessage).image_path === 'string') {
        setSearchingMessage(null);
        if (searchingTimerRef.current) clearTimeout(searchingTimerRef.current);
        setGalleryIndex(0); // always start from first image
        setImageData(data as ShowImageMessage);
        setActiveTab('image');
        setIsOpen(true);
      }
    } catch {
      // ignore malformed messages
    }
  }, []);

  useDataChannel('agent-ui', onMessage);

  // Auto-scroll to newest article
  useEffect(() => {
    if (scrollRef.current && activeTab === 'news') {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [articles, activeTab]);

  const clearAll = () => {
    setIsOpen(false);
    setArticles([]);
    setChartData(null);
    setImageData(null);
    setGalleryIndex(0);
    setSearchingMessage(null);
    if (searchingTimerRef.current) clearTimeout(searchingTimerRef.current);
  };

  const renderImage = () => {
    if (!imageData) {
      return (
        <div className="flex flex-col items-center justify-center p-8 text-center text-white/40">
          <ImageIcon className="mb-2 size-6 opacity-30" />
          <p className="text-[11px]">No document image yet.</p>
          <p className="mt-1 text-[9px] opacity-70">&ldquo;Show me the balance sheet&rdquo;</p>
        </div>
      );
    }

    // Gallery mode: multiple images
    const gallery = imageData.images;
    if (gallery && gallery.length > 0) {
      const current = gallery[galleryIndex];
      return (
        <div className="flex flex-col gap-3 p-3">
          {/* Header with counter */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ImageIcon className="size-3.5 text-violet-400" />
              <span className="text-[11px] font-bold tracking-wider text-violet-400 uppercase">
                {current.title}
              </span>
            </div>
            <span className="text-[10px] text-white/30 tabular-nums">
              {galleryIndex + 1} / {gallery.length}
            </span>
          </div>
          {current.subtitle && (
            <p className="text-[10px] text-white/40 -mt-1 px-0.5">{current.subtitle}</p>
          )}
          {/* Image */}
          <div 
            onClick={() => setLightboxImage(current.image_path)}
            className="overflow-hidden rounded-xl border border-white/10 bg-black/30 cursor-zoom-in hover:border-violet-500/50 transition-colors group/img relative"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={current.image_path}
              alt={current.title}
              className="w-full object-contain max-h-[260px] transition-transform duration-300 group-hover/img:scale-[1.02]"
            />
            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover/img:opacity-100 flex items-center justify-center transition-opacity duration-300">
              <span className="bg-black/60 backdrop-blur-md text-[10px] text-white px-2 py-1 rounded-md border border-white/10">Click to expand</span>
            </div>
          </div>
          {/* Prev / Next navigation */}
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={() => setGalleryIndex((i) => Math.max(0, i - 1))}
              disabled={galleryIndex === 0}
              className="flex-1 rounded-lg border border-white/10 bg-white/5 py-1.5 text-[11px] font-semibold text-white/50 transition hover:bg-white/10 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed"
            >
              ← Prev
            </button>
            {/* Dot indicators */}
            <div className="flex gap-1">
              {gallery.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setGalleryIndex(idx)}
                  className={`h-1.5 rounded-full transition-all ${
                    idx === galleryIndex
                      ? 'w-4 bg-violet-400'
                      : 'w-1.5 bg-white/20 hover:bg-white/40'
                  }`}
                />
              ))}
            </div>
            <button
              onClick={() => setGalleryIndex((i) => Math.min(gallery.length - 1, i + 1))}
              disabled={galleryIndex === gallery.length - 1}
              className="flex-1 rounded-lg border border-white/10 bg-white/5 py-1.5 text-[11px] font-semibold text-white/50 transition hover:bg-white/10 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed"
            >
              Next →
            </button>
          </div>
        </div>
      );
    }

    // Single image mode
    return (
      <div className="flex flex-col gap-3 p-3">
        <div className="flex items-center gap-2">
          <ImageIcon className="size-3.5 text-violet-400" />
          <span className="text-[11px] font-bold tracking-wider text-violet-400 uppercase">
            {imageData.title}
          </span>
        </div>
        {imageData.subtitle && (
          <p className="text-[10px] text-white/40 -mt-1 px-0.5">{imageData.subtitle}</p>
        )}
        <div 
          onClick={() => setLightboxImage(imageData.image_path)}
          className="overflow-hidden rounded-xl border border-white/10 bg-black/30 cursor-zoom-in hover:border-violet-500/50 transition-colors group/img relative"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageData.image_path}
            alt={imageData.title}
            className="w-full object-contain max-h-[300px] transition-transform duration-300 group-hover/img:scale-[1.02]"
          />
          <div className="absolute inset-0 bg-black/20 opacity-0 group-hover/img:opacity-100 flex items-center justify-center transition-opacity duration-300">
            <span className="bg-black/60 backdrop-blur-md text-[10px] text-white px-2 py-1 rounded-md border border-white/10">Click to expand</span>
          </div>
        </div>
      </div>
    );
  };

  const renderChart = () => {
    if (!chartData || !chartData.data || chartData.data.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center p-8 text-center text-white/40">
          <TrendingUpIcon className="mb-2 size-6 animate-pulse opacity-30" />
          <p className="text-[11px]">No forecast charts generated yet.</p>
          <p className="mt-1 text-[9px] opacity-70">&ldquo;Show Apple stock forecast&rdquo;</p>
        </div>
      );
    }

    const dataPoints = chartData.data;
    const values = dataPoints.map((d) => d.value);
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    const range = maxVal - minVal;

    const pad = range * 0.1 || 1.0;
    const chartMin = minVal - pad;
    const chartMax = maxVal + pad;
    const chartRange = chartMax - chartMin;

    const width = 240;
    const height = 140;

    // Map points to fit SVG box
    const points = dataPoints.map((dp, i) => {
      const x = (i / (dataPoints.length - 1)) * (width - 40) + 20;
      const y = height - ((dp.value - chartMin) / chartRange) * (height - 40) - 20;
      return { x, y, label: dp.label, value: dp.value };
    });

    // Create polyline paths
    const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    const fillPath = `${linePath} L ${points[points.length - 1].x} ${height - 15} L ${points[0].x} ${height - 15} Z`;

    return (
      <div className="flex flex-col gap-3 p-3">
        <div className="flex items-center justify-between">
          <span className="rounded-full bg-violet-500/10 px-2.5 py-0.5 text-xs font-bold tracking-wider text-violet-400">
            {chartData.symbol} Analytics
          </span>
          <span
            className="max-w-[130px] truncate text-[10px] font-medium text-white/40"
            title={chartData.title}
          >
            {chartData.title}
          </span>
        </div>

        {/* SVG Wrapper */}
        <div className="relative overflow-visible rounded-xl border border-white/5 bg-black/30 p-2">
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full overflow-visible">
            <defs>
              <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
              </linearGradient>
              <linearGradient id="chartStroke" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#8b5cf6" />
                <stop offset="50%" stopColor="#10b981" />
                <stop offset="100%" stopColor="#06b6d4" />
              </linearGradient>
              <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="2.5" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* Grid Lines */}
            <line
              x1="20"
              y1={height - 20}
              x2={width - 20}
              y2={height - 20}
              stroke="white"
              strokeOpacity="0.05"
              strokeWidth="1"
            />
            <line
              x1="20"
              y1={height / 2}
              x2={width - 20}
              y2={height / 2}
              stroke="white"
              strokeOpacity="0.03"
              strokeWidth="1"
            />
            <line
              x1="20"
              y1="20"
              x2={width - 20}
              y2="20"
              stroke="white"
              strokeOpacity="0.05"
              strokeWidth="1"
            />

            {/* Price Labels */}
            <text x="4" y="24" className="fill-white/35 font-mono text-[8px] font-semibold">
              {chartMax.toFixed(1)}
            </text>
            <text
              x="4"
              y={height - 16}
              className="fill-white/35 font-mono text-[8px] font-semibold"
            >
              {chartMin.toFixed(1)}
            </text>

            {/* Area under the line */}
            <path d={fillPath} fill="url(#chartFill)" />

            {/* Glowing line plot */}
            <path
              d={linePath}
              fill="none"
              stroke="url(#chartStroke)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              filter="url(#glow)"
            />

            {/* Grid Coordinates (Dots) */}
            {points.map((p, idx) => (
              <g
                key={idx}
                onMouseEnter={() => setHoveredPoint(idx)}
                onMouseLeave={() => setHoveredPoint(null)}
              >
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={hoveredPoint === idx ? 5.5 : 3.5}
                  className={`${hoveredPoint === idx ? 'fill-emerald-400 stroke-white stroke-2' : 'fill-violet-400/90'} cursor-pointer transition-all`}
                />
              </g>
            ))}
          </svg>

          {/* Interactive Tooltip details */}
          {hoveredPoint !== null && points[hoveredPoint] && (
            <div className="absolute right-2 bottom-2 left-2 flex items-center justify-between rounded-lg border border-white/10 bg-black/85 px-2.5 py-1.5 font-mono text-[10px] text-white">
              <span className="text-white/60">{points[hoveredPoint].label}</span>
              <span className="font-bold text-emerald-400">
                ${points[hoveredPoint].value.toFixed(2)}
              </span>
            </div>
          )}
        </div>

        {chartData.summary && (
          <p className="rounded-xl border border-white/5 bg-white/[0.02] p-2.5 text-[11px] leading-relaxed text-white/60">
            {chartData.summary}
          </p>
        )}
      </div>
    );
  };

  if (!isOpen && articles.length === 0 && !chartData && !imageData) {
    if (searchingMessage) {
      return (
        <div className="glass neon-glow-border flex flex-col items-center justify-center rounded-2xl p-6 text-center">
          <div className="relative mb-3 flex h-3.5 w-3.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75"></span>
            <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-cyan-500"></span>
          </div>
          <p className="animate-pulse text-xs font-semibold text-cyan-400/90">{searchingMessage}</p>
        </div>
      );
    }
    return (
      <div className="glass neon-glow-border flex flex-col items-center justify-center rounded-2xl p-6 text-center">
        {isFinance ? (
          <>
            <TrendingUpIcon className="text-muted-foreground mb-3 size-8 text-violet-400 opacity-40" />
            <p className="text-muted-foreground text-xs font-semibold">Market Analytics & News</p>
            <p className="text-muted-foreground/60 mt-1 text-[10px]">
              &ldquo;Show Nvidia stock forecast charts&rdquo;
            </p>
          </>
        ) : (
          <>
            <SearchIcon className="text-muted-foreground mb-3 size-8 text-cyan-400 opacity-40" />
            <p className="text-muted-foreground text-xs font-semibold">Live Search Results</p>
            <p className="text-muted-foreground/60 mt-1 text-[10px]">
              &ldquo;Search for latest tech news&rdquo; or &ldquo;Show top headlines&rdquo;
            </p>
          </>
        )}
      </div>
    );
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0, x: 30 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="glass neon-glow-border flex flex-col overflow-hidden rounded-2xl"
      >
        {/* Dynamic Tab Selector Headers */}
        {isFinance ? (
          <div className="flex items-center justify-between border-b border-white/5 bg-black/10 px-3 py-2">
            <div className="flex gap-2">
              <button
                onClick={() => setActiveTab('news')}
                className={`flex items-center gap-1.5 px-2 py-1 text-[11px] font-bold tracking-wider uppercase transition-colors ${
                  activeTab === 'news' ? 'text-cyan-400' : 'text-foreground/30 hover:text-foreground/75'
                }`}
              >
                <NewspaperIcon className="size-3" />
                Headlines
              </button>
              <button
                onClick={() => setActiveTab('charts')}
                className={`flex items-center gap-1.5 px-2 py-1 text-[11px] font-bold tracking-wider uppercase transition-colors ${
                  activeTab === 'charts'
                    ? 'text-emerald-400'
                    : 'text-foreground/30 hover:text-foreground/75'
                }`}
              >
                <TrendingUpIcon className="size-3" />
                Analytics
              </button>
              <button
                onClick={() => setActiveTab('image')}
                className={`flex items-center gap-1.5 px-2 py-1 text-[11px] font-bold tracking-wider uppercase transition-colors ${
                  activeTab === 'image'
                    ? 'text-violet-400'
                    : 'text-foreground/30 hover:text-foreground/75'
                }`}
              >
                <ImageIcon className="size-3" />
                Documents
              </button>
            </div>
            <button
              onClick={clearAll}
              className="text-foreground/30 hover:text-foreground/70 rounded-full p-1 transition-colors"
              aria-label="Clear all"
            >
              <XIcon className="size-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between border-b border-white/5 bg-black/10 px-3 py-2">
            <div className="flex items-center gap-1.5 px-2 py-1 text-[11px] font-bold tracking-wider uppercase text-cyan-400">
              <SearchIcon className="size-3" />
              Search Results
            </div>
            <button
              onClick={clearAll}
              className="text-foreground/30 hover:text-foreground/70 rounded-full p-1 transition-colors"
              aria-label="Clear all"
            >
              <XIcon className="size-3.5" />
            </button>
          </div>
        )}

        {/* Dynamic Tab Body Renderers */}
        <div className="max-h-[350px] [scrollbar-width:thin] overflow-y-auto">
          {activeTab === 'news' ? (
            <div ref={scrollRef} className="space-y-1.5 p-3">
              {articles.length === 0 ? (
                searchingMessage ? null : (
                  <div className="py-8 text-center text-xs text-white/30">
                    No recent headlines found.
                  </div>
                )
              ) : (
                <AnimatePresence>
                  {articles.map((article, i) => (
                    <motion.a
                      key={`${article.title}-${i}`}
                      href={article.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05, duration: 0.3 }}
                      className="group block rounded-xl border border-white/5 bg-white/[0.03] p-3 transition-all hover:border-white/10 hover:bg-white/[0.06]"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-foreground text-[13px] leading-snug font-semibold group-hover:underline">
                          {article.title}
                        </p>
                        <ExternalLinkIcon className="text-foreground/20 mt-0.5 size-3 shrink-0 group-hover:text-white/50" />
                      </div>
                      <div className="mt-1.5 flex items-center gap-2">
                        {article.source && (
                          <span className="inline-block rounded-full bg-white/5 px-2 py-0.5 text-[9px] font-medium text-white/40">
                            {article.source}
                          </span>
                        )}
                      </div>
                      {article.summary && (
                        <p className="text-foreground/50 mt-1.5 line-clamp-2 text-[11px] leading-relaxed">
                          {article.summary}
                        </p>
                      )}
                    </motion.a>
                  ))}
                </AnimatePresence>
              )}
              {searchingMessage && (
                <div className="flex items-center gap-2 rounded-xl border border-dashed border-cyan-500/30 bg-cyan-500/5 p-3">
                  <div className="relative flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75"></span>
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-cyan-500"></span>
                  </div>
                  <span className="animate-pulse text-[11px] font-medium text-cyan-400/90">
                    {searchingMessage}
                  </span>
                </div>
              )}
            </div>
          ) : activeTab === 'charts' ? (
            <>
              {renderChart()}
              {searchingMessage && (
                <div className="mx-3 mb-3 flex items-center gap-2 rounded-xl border border-dashed border-cyan-500/30 bg-cyan-500/5 p-3">
                  <div className="relative flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75"></span>
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-cyan-500"></span>
                  </div>
                  <span className="animate-pulse text-[11px] font-medium text-cyan-400/90">
                    {searchingMessage}
                  </span>
                </div>
              )}
            </>
          ) : (
            <>
              {renderImage()}
            </>
          )}
        </div>
      </motion.div>

      {/* Lightbox Modal overlay for expanding images */}
      <AnimatePresence>
        {lightboxImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setLightboxImage(null)}
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 cursor-zoom-out"
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="relative max-h-[90vh] max-w-[90vw] overflow-hidden rounded-2xl border border-white/10 bg-zinc-950 p-2 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setLightboxImage(null)}
                className="absolute right-4 top-4 z-10 rounded-full bg-black/60 p-2 text-white/80 hover:text-white backdrop-blur-md transition-colors hover:bg-black/80 border border-white/10"
              >
                <XIcon className="size-5" />
              </button>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={lightboxImage}
                alt="Expanded document"
                className="max-h-[85vh] max-w-[85vw] object-contain rounded-lg"
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
