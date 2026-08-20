import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Search, Plus, MessageSquare, Mic, Image as ImageIcon, Video, 
  Settings, Bell, MoreHorizontal, Sparkles, Code, LayoutGrid, 
  TerminalSquare, ArrowRight, Zap, Play, Clock, ChevronRight,
  User, CheckCircle2, Globe, Paperclip, Mic as MicIcon
} from 'lucide-react';

const colors = {
  brand: 'text-orange-500',
  brandBg: 'bg-orange-500/10',
  brandBorder: 'border-orange-500/20',
  voice: 'text-purple-500',
  voiceBg: 'bg-purple-500/10',
  image: 'text-emerald-500',
  imageBg: 'bg-emerald-500/10',
  video: 'text-blue-500',
  videoBg: 'bg-blue-500/10',
};

const navItems = [
  { label: 'Home', icon: LayoutGrid, active: true },
  { label: 'AI Chat', icon: MessageSquare, active: false },
  { label: 'Voice Studio', icon: Mic, active: false },
  { label: 'Image Studio', icon: ImageIcon, active: false },
  { label: 'Video Studio', icon: Video, active: false },
];

const recentChats = [
  { title: 'New voice clone idea', time: '10m ago' },
  { title: 'Marketing campaign assets', time: '2h ago' },
  { title: 'Python data analysis script', time: 'Yesterday' },
  { title: 'Landing page copy', time: 'Yesterday' },
  { title: 'Sci-fi concept art', time: '2 days ago' },
];

const quickActions = [
  { emoji: '✨', label: 'Brainstorm' },
  { emoji: '📝', label: 'Write copy' },
  { emoji: '🎨', label: 'Generate image' },
  { emoji: '🗣️', label: 'Clone voice' },
];

export default function PayvoraBento() {
  const [message, setMessage] = useState('');

  return (
    <div className="min-h-screen bg-[#050505] text-neutral-200 p-4 md:p-6 font-sans selection:bg-orange-500/30">
      
      {/* Background gradients */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden flex justify-center">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-orange-500/5 blur-[120px] rounded-full mix-blend-screen" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-purple-500/5 blur-[120px] rounded-full mix-blend-screen" />
      </div>

      <div className="relative max-w-[1600px] mx-auto h-[calc(100vh-48px)] flex flex-col md:grid md:grid-cols-12 gap-4 md:gap-6">
        
        {/* LEFT COLUMN: Navigation & Context */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="col-span-3 flex flex-col gap-4"
        >
          {/* User & Global Actions */}
          <div className="bg-[#111111] border border-white/5 rounded-3xl p-4 flex items-center justify-between shadow-2xl shadow-black/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white font-bold text-sm shadow-inner shadow-white/20">
                AJ
              </div>
              <div>
                <h3 className="font-semibold text-white text-sm">Ademola</h3>
                <div className="flex items-center gap-1.5 text-xs text-neutral-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Pro Plan
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <button className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white transition-colors">
                <Bell size={16} />
              </button>
              <button className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white transition-colors">
                <Settings size={16} />
              </button>
            </div>
          </div>

          {/* Navigation */}
          <div className="bg-[#111111] border border-white/5 rounded-3xl p-2 flex flex-col gap-1 flex-shrink-0">
            {navItems.map((item, i) => (
              <button 
                key={i} 
                className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium transition-all ${
                  item.active 
                    ? 'bg-white/10 text-white shadow-sm' 
                    : 'text-neutral-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <item.icon size={18} className={item.active ? 'text-orange-500' : ''} />
                {item.label}
                {item.active && <ChevronRight size={16} className="ml-auto opacity-50" />}
              </button>
            ))}
          </div>

          {/* Recent History */}
          <div className="bg-[#111111] border border-white/5 rounded-3xl p-5 flex flex-col flex-1 min-h-0 overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-xs font-bold tracking-wider text-neutral-500 uppercase">Recent Chats</h4>
              <button className="w-6 h-6 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-neutral-400 transition-colors">
                <Search size={12} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-1 pr-2 -mr-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
              {recentChats.map((chat, i) => (
                <button key={i} className="w-full flex flex-col items-start gap-1 p-3 rounded-2xl hover:bg-white/5 transition-colors group text-left">
                  <span className="text-sm font-medium text-neutral-300 group-hover:text-white line-clamp-1">{chat.title}</span>
                  <span className="text-xs text-neutral-600">{chat.time}</span>
                </button>
              ))}
            </div>
            <button className="mt-4 w-full py-3 rounded-2xl border border-white/10 text-neutral-400 hover:text-white hover:bg-white/5 text-sm font-medium transition-all flex items-center justify-center gap-2">
              View All History <ArrowRight size={14} />
            </button>
          </div>
        </motion.div>

        {/* MIDDLE COLUMN: Core Interaction (Chat) */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="col-span-6 bg-[#111111] border border-white/5 rounded-[2.5rem] flex flex-col relative overflow-hidden shadow-2xl shadow-black/50 group"
        >
          {/* Subtle inner glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[80%] h-[300px] bg-orange-500/5 blur-[100px] rounded-full pointer-events-none transition-opacity duration-700 opacity-50 group-hover:opacity-100" />

          {/* Header */}
          <div className="p-8 pb-4 relative z-10 flex items-center justify-between">
            <div>
              <motion.div 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                transition={{ delay: 0.3 }}
                className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-neutral-300 mb-4"
              >
                <Sparkles size={12} className="text-orange-500" /> GPT-4 Omni
              </motion.div>
              <h1 className="text-4xl font-semibold tracking-tight text-white mb-2">Good afternoon.</h1>
              <p className="text-neutral-400 text-lg">What would you like to create today?</p>
            </div>
            
            <button className="hidden md:flex items-center justify-center w-12 h-12 rounded-full bg-orange-500/10 text-orange-500 hover:bg-orange-500 hover:text-white transition-all shadow-[0_0_20px_rgba(249,115,22,0.15)] hover:shadow-[0_0_30px_rgba(249,115,22,0.4)]">
              <Plus size={24} />
            </button>
          </div>

          {/* Quick Actions */}
          <div className="px-8 py-4 relative z-10 flex flex-wrap gap-3">
            {quickActions.map((action, i) => (
              <motion.button 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 + (i * 0.05) }}
                key={i} 
                className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10 transition-all text-sm text-neutral-300 hover:text-white group"
              >
                <span className="text-base group-hover:scale-110 transition-transform">{action.emoji}</span>
                {action.label}
              </motion.button>
            ))}
          </div>

          {/* Chat Area (Empty state) */}
          <div className="flex-1 px-8 py-4 overflow-y-auto relative z-10 flex flex-col justify-end min-h-[300px]">
            {/* We could place some initial conversational starter here if we want, but keeping it empty emphasizes the input */}
          </div>

          {/* Input Area */}
          <div className="p-6 pt-0 relative z-10">
            <div className="bg-[#1a1a1a] border border-white/10 rounded-[2rem] p-2 flex flex-col gap-2 shadow-xl focus-within:border-orange-500/50 focus-within:shadow-[0_0_30px_rgba(249,115,22,0.1)] transition-all">
              <textarea 
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Message Payvora AI..."
                className="w-full bg-transparent border-none outline-none resize-none px-4 py-3 text-white placeholder-neutral-500 min-h-[60px] max-h-[200px] text-[15px]"
                rows={2}
              />
              <div className="flex items-center justify-between px-2 pb-2">
                <div className="flex items-center gap-1">
                  {[
                    { icon: Globe, label: 'Search web' },
                    { icon: Paperclip, label: 'Attach' },
                    { icon: MicIcon, label: 'Voice' }
                  ].map((btn, i) => (
                    <button key={i} className="w-10 h-10 rounded-full flex items-center justify-center text-neutral-400 hover:text-white hover:bg-white/5 transition-colors group" title={btn.label}>
                      <btn.icon size={18} className="group-hover:scale-110 transition-transform" />
                    </button>
                  ))}
                </div>
                <button 
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                    message.trim() 
                      ? 'bg-orange-500 text-white shadow-[0_0_15px_rgba(249,115,22,0.4)] hover:bg-orange-600 hover:scale-105' 
                      : 'bg-white/5 text-neutral-500'
                  }`}
                >
                  <ArrowRight size={18} />
                </button>
              </div>
            </div>
            <div className="text-center mt-4">
              <span className="text-[11px] text-neutral-600">AI can make mistakes. Verify important information.</span>
            </div>
          </div>
        </motion.div>

        {/* RIGHT COLUMN: Studios & Modules */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="col-span-3 flex flex-col gap-4"
        >
          {/* Studios Grid */}
          <div className="grid grid-cols-2 gap-4 flex-shrink-0">
            <button className="aspect-square bg-[#111111] border border-white/5 rounded-3xl p-5 flex flex-col justify-between hover:bg-[#151515] hover:border-purple-500/30 transition-all group relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/0 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="w-10 h-10 rounded-2xl bg-purple-500/10 text-purple-400 flex items-center justify-center group-hover:scale-110 transition-transform shadow-[0_0_15px_rgba(168,85,247,0.15)]">
                <Mic size={20} />
              </div>
              <div className="text-left mt-4 relative z-10">
                <h4 className="text-white font-medium text-sm mb-1">Voice Studio</h4>
                <p className="text-xs text-neutral-500 leading-tight">Clone voices & TTS</p>
              </div>
            </button>
            
            <button className="aspect-square bg-[#111111] border border-white/5 rounded-3xl p-5 flex flex-col justify-between hover:bg-[#151515] hover:border-emerald-500/30 transition-all group relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/0 to-emerald-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform shadow-[0_0_15px_rgba(16,185,129,0.15)]">
                <ImageIcon size={20} />
              </div>
              <div className="text-left mt-4 relative z-10">
                <h4 className="text-white font-medium text-sm mb-1">Image Studio</h4>
                <p className="text-xs text-neutral-500 leading-tight">Generate assets</p>
              </div>
            </button>
            
            <button className="aspect-square bg-[#111111] border border-white/5 rounded-3xl p-5 flex flex-col justify-between hover:bg-[#151515] hover:border-blue-500/30 transition-all group relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/0 to-blue-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="w-10 h-10 rounded-2xl bg-blue-500/10 text-blue-400 flex items-center justify-center group-hover:scale-110 transition-transform shadow-[0_0_15px_rgba(59,130,246,0.15)]">
                <Video size={20} />
              </div>
              <div className="text-left mt-4 relative z-10">
                <h4 className="text-white font-medium text-sm mb-1">Video Studio</h4>
                <p className="text-xs text-neutral-500 leading-tight">AI video generation</p>
              </div>
            </button>
            
            <button className="aspect-square bg-[#111111] border border-white/5 rounded-3xl p-5 flex flex-col justify-between hover:bg-[#151515] hover:border-orange-500/30 transition-all group relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-orange-500/0 to-orange-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="w-10 h-10 rounded-2xl bg-orange-500/10 text-orange-400 flex items-center justify-center group-hover:scale-110 transition-transform shadow-[0_0_15px_rgba(249,115,22,0.15)]">
                <TerminalSquare size={20} />
              </div>
              <div className="text-left mt-4 relative z-10">
                <h4 className="text-white font-medium text-sm mb-1">Code Agent</h4>
                <p className="text-xs text-neutral-500 leading-tight">Write & execute</p>
              </div>
            </button>
          </div>

          {/* Active Workflows / Metrics widget */}
          <div className="bg-[#111111] border border-white/5 rounded-3xl p-5 flex-1 flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <h4 className="text-sm font-semibold text-white">System Status</h4>
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            </div>
            
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-neutral-400">Tokens Used (GPT-4o)</span>
                  <span className="text-white font-medium">842K / 1M</span>
                </div>
                <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-orange-500 w-[84%] rounded-full shadow-[0_0_10px_rgba(249,115,22,0.5)]" />
                </div>
              </div>
              
              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-neutral-400">Voice Generation</span>
                  <span className="text-white font-medium">42m / 120m</span>
                </div>
                <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-purple-500 w-[35%] rounded-full shadow-[0_0_10px_rgba(168,85,247,0.5)]" />
                </div>
              </div>
            </div>

            <div className="mt-auto pt-6">
              <div className="bg-white/5 rounded-2xl p-4 flex items-center justify-between border border-white/5">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center">
                    <Zap size={14} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">Pro Plan Active</p>
                    <p className="text-[10px] text-neutral-500">Renews in 12 days</p>
                  </div>
                </div>
                <button className="text-xs font-medium text-white bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-full transition-colors">
                  Manage
                </button>
              </div>
            </div>
          </div>
        </motion.div>

      </div>
    </div>
  );
}
