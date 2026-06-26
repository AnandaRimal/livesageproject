'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { XIcon } from 'lucide-react';
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

export function NewsOverlay() {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [visible, setVisible] = useState(false);

  const onMessage = useCallback((msg: { payload: Uint8Array }) => {
    try {
      const text = new TextDecoder().decode(msg.payload);
      const data = JSON.parse(text) as NewsMessage;
      if (data.type === 'show_news' && Array.isArray(data.articles)) {
        setArticles(data.articles);
        setVisible(true);
      }
    } catch {
      // ignore malformed messages
    }
  }, []);

  useDataChannel('agent-ui', onMessage);

  // Auto-dismiss after 30 seconds
  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => setVisible(false), 30_000);
    return () => clearTimeout(timer);
  }, [visible, articles]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="news-overlay"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 40 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="fixed bottom-44 left-1/2 z-[100] w-full max-w-2xl -translate-x-1/2 px-4"
        >
          {/* Header */}
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-foreground text-sm font-bold tracking-widest uppercase opacity-60">
              📰 Live Headlines
            </h2>
            <button
              onClick={() => setVisible(false)}
              className="text-foreground/40 hover:text-foreground/80 transition-colors"
              aria-label="Close news"
            >
              <XIcon className="size-4" />
            </button>
          </div>

          {/* Cards */}
          <div className="flex flex-col gap-2">
            {articles.map((article, i) => (
              <motion.a
                key={i}
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.07, duration: 0.3, ease: 'easeOut' }}
                className="group bg-background/80 border-border hover:border-foreground/20 flex flex-col gap-1 rounded-xl border p-3 backdrop-blur-md transition-all"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-foreground text-sm leading-snug font-semibold group-hover:underline">
                    {article.title}
                  </p>
                  {article.source && (
                    <span className="text-foreground/40 shrink-0 text-xs">{article.source}</span>
                  )}
                </div>
                {article.summary && (
                  <p className="text-foreground/60 line-clamp-2 text-xs leading-relaxed">
                    {article.summary}
                  </p>
                )}
              </motion.a>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
