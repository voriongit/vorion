import Link from 'next/link';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { useState, useEffect } from 'react';
import { CommandPalette } from './CommandPalette';
import { useToast } from '../contexts/ToastContext';
import { motion, AnimatePresence } from 'framer-motion';

export default function Layout({ children, title }: { children: React.ReactNode, title?: string }) {
    const router = useRouter();
    const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const toast = useToast();

    // Close sidebar on route change
    useEffect(() => {
        setSidebarOpen(false);
    }, [router.pathname]);

    // Close sidebar on escape key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setSidebarOpen(false);
            }
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setCommandPaletteOpen(true);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // Prevent body scroll when sidebar is open
    useEffect(() => {
        if (sidebarOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [sidebarOpen]);

    const handleRunAgent = async (agent: string, command: string) => {
        toast.info(`Starting ${agent}...`);
        try {
            const res = await fetch('/api/run', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ agent, command })
            });
            const data = await res.json();
            if (data.error) {
                toast.error(`${agent}: ${data.error}`);
            } else {
                toast.success(`${agent} completed`);
            }
        } catch {
            toast.error(`${agent}: Connection failed`);
        }
    };

    const menu = [
        { name: 'Dashboard', path: '/', icon: '⚡' },
        { name: 'Console', path: '/console', icon: '💬' },
        { name: 'Agents', path: '/agents', icon: '🤖' },
        { name: 'Autonomy', path: '/autonomy', icon: '📊' },
        { name: 'Trust', path: '/trust', icon: '🛡️' },
        { name: 'Audit', path: '/audit', icon: '📋' },
        { name: 'Knowledge', path: '/knowledge', icon: '📚' },
        { name: 'Governance', path: '/governance', icon: '⚖️' },
    ];

    const SidebarContent = () => (
        <>
            <div className="p-4 md:p-6 border-b border-[#1a1a1a] flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold bg-gradient-to-tr from-indigo-400 to-cyan-400 text-transparent bg-clip-text tracking-tight">
                        Vorion OS
                    </h1>
                    <div className="text-[10px] text-slate-500 font-mono mt-1">v3.2 Enterprise</div>
                </div>
                {/* Mobile close button */}
                <button
                    onClick={() => setSidebarOpen(false)}
                    className="md:hidden p-2 -mr-2 text-slate-400 hover:text-white transition-colors"
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            <nav className="p-4 space-y-1 flex-1">
                {/* Command Palette Trigger */}
                <button
                    onClick={() => {
                        setSidebarOpen(false);
                        setCommandPaletteOpen(true);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm text-slate-500 hover:text-slate-300 hover:bg-[#151515] transition-colors mb-2 border border-dashed border-slate-700/50"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <span className="flex-1 text-left">Search...</span>
                    <kbd className="hidden md:inline px-1.5 py-0.5 bg-white/5 border border-white/10 rounded text-[10px] font-mono">⌘K</kbd>
                </button>

                {menu.map(item => {
                    const active = router.pathname === item.path;
                    return (
                        <Link
                            key={item.path}
                            href={item.path}
                            className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 group ${
                                active
                                ? 'bg-indigo-500/10 text-indigo-400 shadow-sm border border-indigo-500/20'
                                : 'text-slate-400 hover:text-slate-100 hover:bg-[#151515]'
                            }`}
                        >
                            <span className={`transition-transform duration-200 ${active ? 'scale-110' : 'group-hover:scale-110'}`}>{item.icon}</span>
                            {item.name}
                        </Link>
                    );
                })}
            </nav>

            <div className="p-4 md:p-6 border-t border-[#1a1a1a]">
                <div className="flex items-center gap-3">
                     <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-500 to-pink-500" />
                     <div>
                         <div className="text-sm font-bold text-slate-200">Admin User</div>
                         <div className="text-xs text-slate-600">admin@vorion.org</div>
                     </div>
                </div>
            </div>
        </>
    );

    return (
        <div className="min-h-screen bg-[#050505] text-slate-200 flex font-sans selection:bg-indigo-500/30">
            <Head>
                <title>{title ? `${title} | Vorion` : 'Vorion OS'}</title>
                <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
            </Head>

            {/* Mobile Header */}
            <header className="md:hidden fixed top-0 left-0 right-0 z-40 bg-[#0a0a0a] border-b border-[#1a1a1a] px-4 py-3 flex items-center justify-between">
                <button
                    onClick={() => setSidebarOpen(true)}
                    className="p-2 -ml-2 text-slate-400 hover:text-white transition-colors"
                >
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                </button>
                <h1 className="text-lg font-bold bg-gradient-to-tr from-indigo-400 to-cyan-400 text-transparent bg-clip-text">
                    Vorion
                </h1>
                <button
                    onClick={() => setCommandPaletteOpen(true)}
                    className="p-2 -mr-2 text-slate-400 hover:text-white transition-colors"
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                </button>
            </header>

            {/* Mobile Sidebar Overlay */}
            <AnimatePresence>
                {sidebarOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setSidebarOpen(false)}
                        className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
                    />
                )}
            </AnimatePresence>

            {/* Mobile Sidebar */}
            <AnimatePresence>
                {sidebarOpen && (
                    <motion.aside
                        initial={{ x: '-100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '-100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        className="md:hidden fixed inset-y-0 left-0 w-72 z-50 bg-[#0a0a0a] border-r border-[#1a1a1a] flex flex-col"
                    >
                        <SidebarContent />
                    </motion.aside>
                )}
            </AnimatePresence>

            {/* Desktop Sidebar */}
            <aside className="hidden md:flex w-64 border-r border-[#1a1a1a] flex-col fixed h-full bg-[#0a0a0a]">
                <SidebarContent />
            </aside>

            {/* Main Content */}
            <main className="flex-1 md:ml-64 p-4 md:p-8 overflow-y-auto pt-16 md:pt-8">
                {children}
            </main>

            {/* Command Palette */}
            <CommandPalette
                isOpen={commandPaletteOpen}
                onClose={() => setCommandPaletteOpen(false)}
                onRunAgent={handleRunAgent}
            />
        </div>
    );
}
