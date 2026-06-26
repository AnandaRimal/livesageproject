'use client';

import { useEffect, useRef, useState } from 'react';
import { useTheme } from 'next-themes';
import Image from 'next/image';
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  BellRing,
  Bookmark,
  CheckCircle2,
  ChevronDown,
  Clock,
  Compass,
  HeartPulse,
  Home as HomeIcon,
  LayoutGrid,
  Leaf,
  Loader2,
  Megaphone,
  Menu,
  MessageSquare,
  Moon,
  Palette,
  Phone,
  Search,
  Send,
  Settings,
  Sparkles,
  TrendingUp,
  X,
} from 'lucide-react';
import { cn } from '@/lib/shadcn/utils';
import { AGENTS, type AgentDefinition } from './app';

// Map icon name string to Lucide component
const IconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Search: Search,
  Compass: Compass,
  TrendingUp: TrendingUp,
  HeartPulse: HeartPulse,
  Megaphone: Megaphone,
  Palette: Palette,
};

interface WelcomeViewProps {
  startButtonText: string;
  onStartCall: () => void;
  onSelectAgent: (agent: AgentDefinition) => void;
}

export const WelcomeView = ({
  onSelectAgent,
  startButtonText: _startButtonText,
  onStartCall: _onStartCall,
}: WelcomeViewProps) => {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [greeting, setGreeting] = useState('Good morning');
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Alert state
  const [alertMessage, setAlertMessage] = useState('Hello, you are alerting 🔔');
  const [alertSending, setAlertSending] = useState(false);
  const [alertStatus, setAlertStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const alertStatusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Set greeting based on time of day
  useEffect(() => {
    setMounted(true);
    const hour = new Date().getHours();
    if (hour < 12) {
      setGreeting('Good morning');
    } else if (hour < 17) {
      setGreeting('Good afternoon');
    } else {
      setGreeting('Good evening');
    }
  }, []);

  if (!mounted) return null;

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    // Always route to Neha (search agent)
    const matchedAgent = AGENTS.find((a) => a.id === 'search') || AGENTS[0];
    onSelectAgent(matchedAgent);
  };

  // Send alert via Twilio — always sends to the pre-set Nepali number
  const handleSendAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!alertMessage.trim()) return;

    setAlertSending(true);
    setAlertStatus(null);

    try {
      const res = await fetch('/api/alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: '+9779744246534',
          message: alertMessage.trim(),
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setAlertStatus({ type: 'success', text: '✅ Alert sent to +977 974 424 6534!' });
      } else {
        setAlertStatus({ type: 'error', text: data.error || 'Failed to send alert.' });
      }
    } catch {
      setAlertStatus({ type: 'error', text: 'Network error. Could not reach the alert API.' });
    } finally {
      setAlertSending(false);
      if (alertStatusTimer.current) clearTimeout(alertStatusTimer.current);
      alertStatusTimer.current = setTimeout(() => setAlertStatus(null), 5000);
    }
  };

  const menuItems = [
    { label: 'Home', icon: HomeIcon, active: true },
    { label: 'Chats', icon: MessageSquare, active: false },
    { label: 'Agents', icon: Compass, active: false },
    { label: 'Tasks', icon: LayoutGrid, active: false },
    { label: 'History', icon: Clock, active: false },
    { label: 'Bookmarks', icon: Bookmark, active: false },
    { label: 'Settings', icon: Settings, active: false },
  ];

  return (
    <div className="relative flex min-h-screen overflow-x-hidden bg-[#f4f6fb] font-sans text-slate-800">
      {/* ── Background Subtle Glows ── */}
      <div
        className="pointer-events-none absolute top-[-10%] left-[-10%] size-[40vw] rounded-full opacity-[0.12] blur-[150px]"
        style={{ background: 'radial-gradient(circle, #3b82f6 0%, transparent 70%)' }}
      />
      <div
        className="pointer-events-none absolute right-[-10%] bottom-[-10%] size-[50vw] rounded-full opacity-[0.08] blur-[180px]"
        style={{ background: 'radial-gradient(circle, #a855f7 0%, transparent 70%)' }}
      />

      {/* ── Left Sidebar: Desktop ── */}
      <aside className="fixed top-0 bottom-0 left-0 z-30 hidden w-[220px] flex-col justify-between border-r border-slate-200 bg-white p-5 shadow-sm select-none lg:flex">
        <div>
          {/* Logo */}
          <div className="mb-8 flex items-center gap-2.5 px-2">
            <div className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-600 shadow-md shadow-indigo-900/20">
              <Leaf className="size-4.5 animate-pulse fill-white/20 text-white" />
            </div>
            <span className="flex items-center gap-1.5 font-sans text-[18px] font-bold tracking-tight text-indigo-700">
              LiveSage
              <Sparkles className="size-3.5 fill-indigo-300/20 text-indigo-400" />
            </span>
          </div>

          {/* Menu Items */}
          <nav className="space-y-1.5">
            {menuItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.label}
                  className={cn(
                    'group flex w-full cursor-pointer items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium tracking-wide transition-all duration-200',
                    item.active
                      ? 'bg-indigo-50 font-semibold text-indigo-700 shadow-sm'
                      : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                  )}
                >
                  <Icon
                    className={cn(
                      'size-4 transition-colors',
                      item.active ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-600'
                    )}
                  />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>

          {/* Upgrade Card */}
          <div className="space-y-4">
            <div className="relative overflow-hidden rounded-2xl border border-indigo-100 bg-gradient-to-b from-indigo-50 to-violet-50 p-4 shadow-sm">
              <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold tracking-wider text-amber-600 uppercase">
                <Sparkles className="size-3 fill-amber-400/20" />
                LiveSage Pro
              </div>
              <p className="mb-3 text-[11px] leading-relaxed font-medium text-slate-500">
                Unlock unlimited agents and premium features.
              </p>
              <button className="w-full cursor-pointer rounded-lg bg-indigo-600 py-2 text-xs font-bold tracking-wide text-white shadow-sm transition hover:bg-indigo-700 active:scale-98">
                Upgrade Now
              </button>
            </div>

            {/* Dark Mode Toggle */}
            <div className="flex items-center justify-between border-t border-slate-200 px-1 py-2 pt-3">
              <span className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-slate-500">
                <Moon className="size-3.5" />
                Dark Mode
              </span>
              <button
                onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
                className={cn(
                  'relative inline-flex h-5.5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none',
                  resolvedTheme === 'dark' ? 'bg-indigo-600' : 'bg-slate-200'
                )}
              >
                <span
                  className={cn(
                    'pointer-events-none inline-block h-4.5 w-4.5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
                    resolvedTheme === 'dark' ? 'translate-x-4.5' : 'translate-x-0'
                  )}
                />
              </button>
            </div>
          </div>
        </aside>

      {/* ── Mobile Sidebar Drawer ── */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative flex h-full w-[240px] flex-col justify-between bg-white p-5 shadow-xl">
            <div>
              <div className="mb-6 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex size-8 items-center justify-center rounded-lg bg-indigo-600">
                    <Leaf className="size-4 text-white" />
                  </div>
                  <span className="font-sans text-base font-bold text-indigo-700">LiveSage</span>
                </div>
                <button onClick={() => setMobileMenuOpen(false)} className="text-slate-400 hover:text-slate-700">
                  <X className="size-5" />
                </button>
              </div>
              <nav className="space-y-1">
                {menuItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.label}
                      onClick={() => setMobileMenuOpen(false)}
                      className={cn(
                        'flex w-full cursor-pointer items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all',
                        item.active
                          ? 'bg-indigo-50 font-semibold text-indigo-700'
                          : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                      )}
                    >
                      <Icon className="size-4" />
                      {item.label}
                    </button>
                  );
                })}
              </nav>
            </div>
            <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-4">
              <div className="mb-1 text-xs font-semibold tracking-wider text-amber-600 uppercase">LiveSage Pro</div>
              <p className="mb-3 text-[11px] text-slate-500">Unlock all agents & premium tools.</p>
              <button className="w-full cursor-pointer rounded-lg bg-indigo-600 py-2 text-xs font-bold text-white">
                Upgrade Now
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* ── Main Content Area ── */}
      <div className="z-10 flex min-h-screen w-full flex-1 flex-col lg:pl-[220px]">
        {/* Top Header Bar */}
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4 shadow-sm md:px-8">
          {/* Mobile Menu Trigger */}
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="cursor-pointer text-slate-400 hover:text-slate-700 lg:hidden"
          >
            <Menu className="size-5" />
          </button>

          {/* Search Bar — centred */}
          <form onSubmit={handleSearchSubmit} className="mx-4 flex max-w-xl flex-1 items-center rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 shadow-inner focus-within:border-indigo-300 focus-within:ring-2 focus-within:ring-indigo-100">
            <Search className="mr-2.5 size-4 shrink-0 text-slate-400" />
            <input
              type="text"
              placeholder="Ask your AI agents anything..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent text-sm text-slate-700 placeholder-slate-400 focus:outline-none"
            />
            <button
              type="submit"
              className="ml-2 cursor-pointer rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-bold text-white transition hover:bg-indigo-700"
            >
              Search →
            </button>
          </form>

          {/* User controls (Top Right) */}
          <div className="flex items-center gap-3">
            {/* Bell Button */}
            <button className="relative cursor-pointer rounded-lg border border-slate-200 bg-white p-2 text-slate-500 transition hover:bg-slate-50 hover:text-slate-800">
              <Bell className="size-4" />
              <span className="absolute top-1.5 right-1.5 size-1.5 animate-pulse rounded-full bg-indigo-500" />
            </button>

            {/* Profile */}
            <div className="group flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 transition hover:bg-slate-50">
              <div className="relative flex size-7 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-100 text-xs font-bold text-slate-700">
                <Image
                  src="/avatars/livesearch_agent.png"
                  alt="Alex Profile"
                  width={28}
                  height={28}
                  className="object-cover"
                />
              </div>
              <span className="text-xs font-bold text-slate-700">Alex</span>
              <ChevronDown className="size-3 text-slate-400" />
            </div>
          </div>
        </header>

        {/* Content Wrapper */}
        <main className="mx-auto w-full max-w-7xl flex-1 space-y-7 p-5 md:p-8">
          {/* Welcome Heading */}
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight text-slate-800">
              {greeting}, Alex <span>👋</span>
            </h1>
            <p className="mt-1 text-sm font-medium text-slate-400">How can I help you today?</p>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { label: 'Active Agents', value: '4', color: 'text-indigo-600', bg: 'bg-indigo-50' },
              { label: 'Sessions Today', value: '12', color: 'text-green-600', bg: 'bg-green-50' },
              { label: 'Queries Done', value: '89', color: 'text-orange-600', bg: 'bg-orange-50' },
              { label: 'Saved Notes', value: '24', color: 'text-blue-600', bg: 'bg-blue-50' },
            ].map((stat) => (
              <div key={stat.label} className={cn('rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm')}>
                <div className={cn('text-3xl font-extrabold', stat.color)}>{stat.value}</div>
                <div className="mt-1 text-xs font-semibold text-slate-500">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* AI Team Section Header */}
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-lg font-extrabold tracking-tight text-slate-800">Your AI Agents</h2>
              <p className="mt-0.5 text-xs font-medium text-slate-400">
                Click any agent to start a real-time voice session
              </p>
            </div>
            <button className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600 shadow-sm transition hover:bg-slate-50">
              <Settings className="size-3.5" />
              Manage
            </button>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {AGENTS.map((agent) => {
              const IconComponent = IconMap[agent.icon] || MessageSquare;
              return (
                <div
                  key={agent.id}
                  onClick={() => onSelectAgent(agent)}
                  className="group relative flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md"
                >
                  {/* Photo — large, fills top portion */}
                  <div className="relative h-[200px] w-full overflow-hidden">
                    {/* Agent tag badge top-left */}
                    <div
                      className={cn(
                        'absolute top-2.5 left-2.5 z-10 flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold shadow-sm',
                        agent.badgeColor,
                        'bg-white/90 backdrop-blur-sm'
                      )}
                    >
                      <IconComponent className="size-3" />
                      {agent.title}
                    </div>
                    {/* LIVE badge top-right */}
                    <div className="absolute top-2.5 right-2.5 z-10 flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold text-slate-600 shadow-sm backdrop-blur-sm">
                      <span className="size-1.5 animate-pulse rounded-full bg-green-500" />
                      LIVE
                    </div>
                    <Image
                      src={agent.avatar}
                      alt={`${agent.name}`}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                      priority
                      className="object-cover object-top transition-transform duration-500 group-hover:scale-105"
                    />
                  </div>

                  {/* Card Footer */}
                  <div className="flex flex-col gap-1.5 px-4 py-3">
                    <h3 className="text-[14px] font-bold tracking-tight text-slate-800">{agent.name}</h3>
                    <p className="line-clamp-2 text-[11px] leading-relaxed text-slate-500">
                      {agent.description}
                    </p>
                    <button
                      className="mt-2 flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border py-2 text-xs font-bold transition-all duration-200 hover:opacity-90"
                      style={{
                        borderColor: `${agent.themeColor}40`,
                        color: agent.themeColor,
                        background: `${agent.themeColor}0d`,
                      }}
                    >
                      Talk to Agent <ArrowRight className="size-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Neha Alert Features ── */}
          <div className="rounded-2xl border border-indigo-100 bg-white shadow-sm overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-3 border-b border-indigo-50 bg-gradient-to-r from-violet-50 to-indigo-50 px-6 py-4">
              <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-600 shadow-lg shadow-violet-200">
                <BellRing className="size-5 text-white" />
              </div>
              <div>
                <h2 className="text-base font-extrabold tracking-tight text-slate-800">Neha Alert Features</h2>
                <p className="text-[11px] font-medium text-slate-400">Send an instant SMS alert via Twilio</p>
              </div>
            </div>

            {/* Simple Form */}
            <form onSubmit={handleSendAlert} className="flex flex-col gap-4 p-6">
              {/* Message Box */}
              <textarea
                id="alert-message"
                rows={3}
                value={alertMessage}
                onChange={(e) => setAlertMessage(e.target.value)}
                required
                className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 placeholder-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 focus:outline-none transition-all"
              />

              {/* Status */}
              {alertStatus && (
                <div className={cn(
                  'flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold border',
                  alertStatus.type === 'success'
                    ? 'bg-green-50 text-green-700 border-green-200'
                    : 'bg-red-50 text-red-700 border-red-200'
                )}>
                  {alertStatus.type === 'success'
                    ? <CheckCircle2 className="size-4 shrink-0 text-green-500" />
                    : <AlertTriangle className="size-4 shrink-0 text-red-500" />}
                  {alertStatus.text}
                </div>
              )}

              {/* Button */}
              <button
                id="send-alert-btn"
                type="submit"
                disabled={alertSending || !alertMessage.trim()}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 py-3 text-sm font-bold text-white shadow-md shadow-violet-200 transition-all hover:from-violet-700 hover:to-indigo-700 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {alertSending ? (
                  <><Loader2 className="size-4 animate-spin" /> Sending...</>
                ) : (
                  <><Send className="size-4" /> Set Alert</>
                )}
              </button>
            </form>
          </div>

          {/* Footer */}
          <div className="mt-4 flex items-center justify-center gap-2 border-t border-slate-200 py-6 text-xs font-semibold text-slate-400 select-none">
            <Sparkles className="size-3.5 fill-violet-400/10 text-violet-400" />
            <span>"One platform. Multiple experts. Infinite possibilities."</span>
            <Sparkles className="size-3.5 fill-indigo-400/10 text-indigo-400" />
          </div>
        </main>
      </div>
    </div>
  );
};
