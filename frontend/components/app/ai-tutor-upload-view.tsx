'use client';

import React, { useState, useRef } from 'react';
import {
  FileText,
  Upload,
  CheckCircle2,
  BookOpen,
  ArrowLeft,
  Sparkles,
  Loader2,
  AlertCircle,
  GraduationCap,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/shadcn/utils';

export interface AiTutorUploadViewProps {
  onBack: () => void;
  onJoinClassroom: (sessionId: string) => void;
}

type ProcessStep =
  | 'idle'
  | 'uploading'
  | 'extracting_text'
  | 'extracting_images'
  | 'embedding'
  | 'saving_chromadb'
  | 'ready'
  | 'error';

interface StepItem {
  id: ProcessStep;
  label: string;
  subText: string;
}

const STEPS: StepItem[] = [
  { id: 'uploading', label: 'Uploading PDF...', subText: 'Preparing document for AI analysis' },
  { id: 'extracting_text', label: 'Extracting text...', subText: 'Reading pages and structure' },
  { id: 'extracting_images', label: 'Extracting images...', subText: 'Isolating diagrams and figures' },
  { id: 'embedding', label: 'Preparing index...', subText: 'Building fast document retrieval index' },
  { id: 'saving_chromadb', label: 'Saving to ChromaDB...', subText: 'Storing all sections for retrieval' },
  { id: 'ready', label: 'Ready to Teach', subText: 'Classroom prepared for your session' },
];

export function AiTutorUploadView({ onBack, onJoinClassroom }: AiTutorUploadViewProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [currentStep, setCurrentStep] = useState<ProcessStep>('idle');
  const [progressPercent, setProgressPercent] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (file: File | null) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setErrorMessage('Only PDF files are accepted. Please upload a .pdf document.');
      return;
    }
    setSelectedFile(file);
    setErrorMessage(null);
    startProcessing(file);
  };

  const startProcessing = async (file: File) => {
    setCurrentStep('uploading');
    setProgressPercent(10);
    setErrorMessage(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/upload-pdf', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to upload PDF');
      }

      if (!response.body) {
        throw new Error('ReadableStream not supported');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.replace(/^data:\s*/, '').trim();
          if (!trimmed) continue;

          try {
            const data = JSON.parse(trimmed);
            if (data.type === 'progress') {
              if (data.step) {
                setCurrentStep(data.step as ProcessStep);
              }
              if (typeof data.progress === 'number') {
                setProgressPercent(data.progress);
              }
            } else if (data.type === 'done') {
              setCurrentStep('ready');
              setProgressPercent(100);
              setSessionId(data.session_id);
              const sid = data.session_id;
              setTimeout(() => {
                onJoinClassroom(sid);
              }, 1200);
            } else if (data.type === 'error') {
              setCurrentStep('error');
              setErrorMessage(data.message || 'Error processing PDF');
            }
          } catch {
            // Ignore parse failures
          }
        }
      }
    } catch (err: any) {
      console.error('[Upload] Error:', err);
      setCurrentStep('error');
      setErrorMessage(err.message || 'An unexpected error occurred during upload');
    }
  };

  const stepOrder: ProcessStep[] = [
    'uploading',
    'extracting_text',
    'extracting_images',
    'embedding',
    'saving_chromadb',
    'ready',
  ];

  const currentStepIdx = stepOrder.indexOf(currentStep);

  return (
    <div className="relative flex min-h-screen w-full flex-col items-center justify-center bg-[#f4f6fb] p-6 text-slate-800 font-sans overflow-x-hidden">
      {/* Dynamic Background */}
      <div
        className="pointer-events-none absolute top-[-10%] left-[-10%] size-[40vw] rounded-full opacity-15 blur-[150px]"
        style={{ background: 'radial-gradient(circle, #8b5cf6 0%, transparent 70%)' }}
      />
      <div
        className="pointer-events-none absolute right-[-10%] bottom-[-10%] size-[40vw] rounded-full opacity-15 blur-[150px]"
        style={{ background: 'radial-gradient(circle, #6366f1 0%, transparent 70%)' }}
      />

      {/* Top Header Controls */}
      <header className="absolute top-6 left-6 right-6 flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white/80 px-4 py-2 text-xs font-bold text-slate-600 shadow-sm backdrop-blur-md transition hover:bg-white hover:text-slate-900"
        >
          <ArrowLeft className="size-4" /> Back to Dashboard
        </button>

        <div className="flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50/80 px-3 py-1 text-xs font-bold text-violet-700 backdrop-blur-md">
          <GraduationCap className="size-4" /> AI Tutor Classroom Setup
        </div>
      </header>

      <main className="z-10 flex w-full max-w-2xl flex-col items-center gap-6">
        {/* Title */}
        <div className="text-center space-y-2">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-600 shadow-lg shadow-violet-500/20 text-white">
            <BookOpen className="size-7" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
            Upload Your Study Material
          </h1>
          <p className="text-sm font-medium text-slate-500 max-w-md mx-auto">
            Upload any PDF book, lecture slides, or research paper. Your AI Tutor will analyze it and prepare an interactive 1-on-1 lecture.
          </p>
        </div>

        {/* Upload Container */}
        {currentStep === 'idle' || currentStep === 'error' ? (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragOver(false);
              const file = e.dataTransfer.files[0];
              if (file) handleFileChange(file);
            }}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              'group relative flex w-full cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed p-10 text-center transition-all duration-300 bg-white shadow-sm',
              isDragOver
                ? 'border-violet-600 bg-violet-50/50 scale-[1.01]'
                : 'border-slate-300 hover:border-violet-400 hover:bg-slate-50/50'
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileChange(file);
              }}
            />

            <div className="mb-4 flex size-16 items-center justify-center rounded-2xl bg-violet-50 text-violet-600 transition-transform group-hover:scale-110">
              <Upload className="size-8" />
            </div>

            <h3 className="text-base font-bold text-slate-800">
              Drop your PDF here, or <span className="text-violet-600 underline">browse</span>
            </h3>
            <p className="mt-1 text-xs text-slate-400">Accepts PDF files only (Up to 50MB)</p>

            {errorMessage && (
              <div className="mt-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-xs font-semibold text-red-600">
                <AlertCircle className="size-4 shrink-0" />
                {errorMessage}
              </div>
            )}
          </div>
        ) : (
          /* Processing Progress Card */
          <div className="w-full rounded-3xl border border-slate-200 bg-white p-8 shadow-sm space-y-6">
            {/* File Info */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-xl bg-violet-100 text-violet-700 font-bold">
                  <FileText className="size-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-800 truncate max-w-[280px]">
                    {selectedFile?.name}
                  </h4>
                  <p className="text-xs text-slate-400">
                    {selectedFile ? (selectedFile.size / (1024 * 1024)).toFixed(2) : '0'} MB
                  </p>
                </div>
              </div>

              {currentStep === 'ready' ? (
                <span className="flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">
                  <CheckCircle2 className="size-4" /> Ready
                </span>
              ) : (
                <span className="flex items-center gap-1.5 rounded-full bg-violet-100 px-3 py-1 text-xs font-bold text-violet-700">
                  <Loader2 className="size-4 animate-spin" /> Processing
                </span>
              )}
            </div>

            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-bold text-slate-600">
                <span>Overall Status</span>
                <span>{progressPercent}%</span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                <motion.div
                  className="h-full bg-gradient-to-r from-violet-600 to-indigo-600"
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPercent}%` }}
                  transition={{ duration: 0.4 }}
                />
              </div>
            </div>

            {/* Steps Checklist */}
            <div className="space-y-3 pt-2">
              {STEPS.map((step, idx) => {
                const isComplete = currentStepIdx > idx || currentStep === 'ready';
                const isCurrent = currentStep === step.id && currentStep !== 'ready';

                return (
                  <div
                    key={step.id}
                    className={cn(
                      'flex items-start gap-3 rounded-xl p-2.5 transition-colors',
                      isCurrent ? 'bg-violet-50/70 border border-violet-100' : 'opacity-70'
                    )}
                  >
                    <div className="mt-0.5">
                      {isComplete ? (
                        <CheckCircle2 className="size-4 text-emerald-500" />
                      ) : isCurrent ? (
                        <Loader2 className="size-4 animate-spin text-violet-600" />
                      ) : (
                        <div className="size-4 rounded-full border border-slate-300" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p
                        className={cn(
                          'text-xs font-bold',
                          isComplete
                            ? 'text-slate-800'
                            : isCurrent
                            ? 'text-violet-900'
                            : 'text-slate-400'
                        )}
                      >
                        {step.label}
                      </p>
                      <p className="text-[11px] text-slate-400">{step.subText}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Join Classroom Button */}
            <div className="pt-2">
              <button
                disabled={currentStep !== 'ready' || !sessionId}
                onClick={() => sessionId && onJoinClassroom(sessionId)}
                className="group flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-violet-500/25 transition-all hover:from-violet-700 hover:to-indigo-700 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Sparkles className="size-4" />
                Join AI Classroom
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
