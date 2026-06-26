'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ClipboardCopyIcon, DownloadIcon, FileTextIcon, Trash2Icon, XIcon } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useDataChannel } from '@livekit/components-react';

interface NotepadMessage {
  type: 'notebook_append';
  text: string;
}

interface NotepadPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NotebookPanel({ isOpen, onClose }: NotepadPanelProps) {
  const [content, setContent] = useState('');
  const [copied, setCopied] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Listen for agent-pushed text — append to the freeform notepad
  const onMessage = useCallback((msg: { payload: Uint8Array }) => {
    try {
      const text = new TextDecoder().decode(msg.payload);
      const data = JSON.parse(text) as NotepadMessage;
      if (data.type === 'notebook_append' && typeof data.text === 'string') {
        setContent((prev) => {
          const separator = prev.length > 0 ? '\n' : '';
          return prev + separator + data.text;
        });
      }
    } catch {
      // ignore
    }
  }, []);

  useDataChannel('agent-ui', onMessage);

  // Focus textarea when panel opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.selectionStart = textareaRef.current.value.length;
        }
      }, 250);
    }
  }, [isOpen]);

  const clearAll = () => {
    setContent('');
    textareaRef.current?.focus();
  };

  const copyAll = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadTxt = () => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `livesage-notepad-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
  const charCount = content.length;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, x: 40, scale: 0.95 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: 40, scale: 0.95 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="glass neon-glow-border fixed right-4 bottom-36 z-[200] flex h-[500px] w-[380px] flex-col rounded-2xl md:right-6 md:bottom-40"
        >
          {/* ── Title Bar ── */}
          <div className="flex items-center justify-between border-b border-white/5 px-4 py-2.5">
            <div className="flex items-center gap-2">
              <FileTextIcon className="size-4 text-violet-400" />
              <h3 className="gradient-text text-xs font-bold tracking-widest uppercase">Notepad</h3>
            </div>
            <div className="flex items-center gap-0.5">
              <button
                onClick={copyAll}
                disabled={!content}
                title={copied ? 'Copied!' : 'Copy all'}
                className="text-foreground/30 hover:text-foreground/70 rounded-full p-1.5 transition-colors disabled:opacity-20"
              >
                <ClipboardCopyIcon className="size-3.5" />
              </button>
              <button
                onClick={downloadTxt}
                disabled={!content}
                title="Save as .txt"
                className="text-foreground/30 hover:text-foreground/70 rounded-full p-1.5 transition-colors disabled:opacity-20"
              >
                <DownloadIcon className="size-3.5" />
              </button>
              <button
                onClick={clearAll}
                disabled={!content}
                title="Clear"
                className="text-foreground/30 hover:text-destructive rounded-full p-1.5 transition-colors disabled:opacity-20"
              >
                <Trash2Icon className="size-3.5" />
              </button>
              <div className="mx-1 h-4 w-px bg-white/5" />
              <button
                onClick={onClose}
                className="text-foreground/30 hover:text-foreground/70 rounded-full p-1.5 transition-colors"
                aria-label="Close notepad"
              >
                <XIcon className="size-3.5" />
              </button>
            </div>
          </div>

          {/* ── Freeform Text Area (like Notepad) ── */}
          <div className="flex-1 overflow-hidden">
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Start typing here — or ask the agent to write something for you..."
              spellCheck
              className="text-foreground placeholder:text-foreground/20 h-full w-full resize-none [scrollbar-width:thin] bg-transparent px-4 py-3 font-mono text-[13px] leading-relaxed tracking-wide focus:outline-none"
            />
          </div>

          {/* ── Status Bar ── */}
          <div className="flex items-center justify-between border-t border-white/5 px-4 py-1.5">
            <span className="text-foreground/20 text-[10px] font-medium">
              {wordCount} words · {charCount} chars
            </span>
            {copied && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-[10px] font-medium text-emerald-400"
              >
                Copied to clipboard ✓
              </motion.span>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
