import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { api } from '../api';
import { v4 as uuidv4 } from 'uuid';
import {
    TIERS, AGENT_TYPES, AGENT_STATUS,
    CLI_COMMANDS, getHITLLevel, formatTime,
    getAgentIcon, getEntryConfig,
} from '../constants';
import type { Agent, BlackboardEntry, ApprovalRequest } from '../types';
import { Tooltip, TOOLTIP_CONTENT } from './Tooltip';

/**
 * Aurais Console
 *
 * Unified interface where users talk to Aria, who orchestrates the agents.
 * Features:
 * - CLI input for commands
 * - Voice input (speech-to-text)
 * - Voice output (text-to-speech for Aria)
 * - Live blackboard feed showing agent activity
 * - Aria responses and guidance
 */

// =============================================================================
// VOICE INTERFACE SUPPORT
// =============================================================================

// Check for browser support
const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
const speechSynthesis = window.speechSynthesis;

interface VoiceSettings {
    enabled: boolean;
    speakAria: boolean;
    voice: SpeechSynthesisVoice | null;
    rate: number;
    pitch: number;
}

const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
    enabled: false,
    speakAria: true,
    voice: null,
    rate: 1.0,
    pitch: 1.0,
};

// Strip markdown for TTS
function stripMarkdown(text: string): string {
    return text
        .replace(/\*\*([^*]+)\*\*/g, '$1') // Bold
        .replace(/`([^`]+)`/g, '$1')       // Code
        .replace(/\n/g, '. ')              // Newlines to pauses
        .replace(/\s+/g, ' ')              // Collapse whitespace
        .trim();
}

interface UserInfo {
    email: string;
    name: string;
    picture?: string;
}

interface ConsoleProps {
    agents: Agent[];
    blackboardEntries: BlackboardEntry[];
    approvals: ApprovalRequest[];
    hitlLevel: number;
    user?: UserInfo | null;
    onSpawn?: (name: string, type: string, tier: number) => void;
    onSetHITL?: (level: number) => void;
    onApprove?: (id: string, approved: boolean) => void;
    onSelectAgent?: (agentId: string) => void;
    onOpenControls?: () => void;
    onOpenAgentList?: () => void;
    onOpenMetrics?: () => void;
    onOpenTasks?: () => void;
    onOpenHelp?: () => void;
    onOpenTutorial?: () => void;
    onOpenGlossary?: () => void;
    onOpenPending?: () => void;
    onOpenSpawnWizard?: () => void;
    onOpenInsights?: () => void;
    onLogout?: () => void;
    // Auto-tick alarm clock props
    autoTickEnabled?: boolean;
    autoTickInterval?: number;
    onToggleAutoTick?: () => void;
    onSetAutoTickInterval?: (interval: number) => void;
}

interface ConsoleMessage {
    id: string;
    type: 'user' | 'aria' | 'system' | 'agent' | 'error' | 'approval';
    content: string;
    timestamp: Date;
    agentId?: string;
    agentName?: string;
    agentTier?: number;
    entryType?: string;
    approvalId?: string;
    metadata?: Record<string, unknown>;
}

// Aria personality and responses
const ARIA_INTRO = `Welcome to Aurais. I'm **Aria**, your AI operations assistant.

I help you manage and communicate with the agent network. You can:
- Create tasks and spawn agents
- Monitor what agents are doing
- Approve or deny agent requests
- Adjust system governance

Type \`help\` to see available commands, or just tell me what you need.`;

export function Console({
    agents,
    blackboardEntries,
    approvals,
    hitlLevel,
    user: _user,
    onSpawn,
    onSetHITL,
    onApprove,
    onSelectAgent,
    onOpenControls: _onOpenControls,
    onOpenAgentList: _onOpenAgentList,
    onOpenMetrics: _onOpenMetrics,
    onOpenTasks: _onOpenTasks,
    onOpenHelp: _onOpenHelp,
    onOpenTutorial: _onOpenTutorial,
    onOpenGlossary: _onOpenGlossary,
    onOpenPending,
    onOpenSpawnWizard,
    onOpenInsights,
    onLogout: _onLogout,
    // Auto-tick props
    autoTickEnabled = false,
    autoTickInterval = 5000,
    onToggleAutoTick,
    onSetAutoTickInterval,
}: ConsoleProps) {
    // Alias for compatibility
    const entries = blackboardEntries;
    const [messages, setMessages] = useState<ConsoleMessage[]>([]);
    const [input, setInput] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [commandHistory, setCommandHistory] = useState<string[]>([]);
    const [historyIndex, setHistoryIndex] = useState(-1);
    const inputRef = useRef<HTMLInputElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const lastEntryCountRef = useRef(entries.length);

    // Voice interface state
    const [voiceSettings, setVoiceSettings] = useState<VoiceSettings>(DEFAULT_VOICE_SETTINGS);
    const [isListening, setIsListening] = useState(false);
    const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
    const recognitionRef = useRef<any>(null);

    // Memory session ID - persists for the browser session
    const sessionId = useMemo(() => {
        const stored = sessionStorage.getItem('aria-session-id');
        if (stored) return stored;
        const newId = uuidv4();
        sessionStorage.setItem('aria-session-id', newId);
        return newId;
    }, []);

    // Store conversation message to memory (async, non-blocking)
    const storeToMemory = useCallback(async (role: 'user' | 'aria', content: string) => {
        try {
            await api.storeConversation({
                sessionId,
                role,
                content,
                userId: _user?.email,
            });
        } catch (err) {
            // Silently fail - memory is optional enhancement
            console.debug('Memory storage failed:', err);
        }
    }, [sessionId, _user?.email]);

    // Retrieve memory context for RAG (async)
    const getMemoryContext = useCallback(async (query: string): Promise<string> => {
        try {
            // Search relevant conversations and knowledge in parallel
            const [convResults, knowledgeResults] = await Promise.all([
                api.searchConversations(query, { userId: _user?.email, limit: 5 }).catch(() => []),
                api.searchKnowledge(query, { limit: 5 }).catch(() => []),
            ]);

            const parts: string[] = [];

            // Add relevant past conversations
            if (convResults.length > 0) {
                parts.push('**Recent relevant conversations:**');
                convResults.slice(0, 3).forEach((r: any) => {
                    parts.push(`- [${r.role}]: ${r.content.substring(0, 200)}${r.content.length > 200 ? '...' : ''}`);
                });
            }

            // Add relevant knowledge
            if (knowledgeResults.length > 0) {
                parts.push('\n**Relevant knowledge:**');
                knowledgeResults.slice(0, 3).forEach((k: any) => {
                    parts.push(`- ${k.title}: ${k.content.substring(0, 200)}${k.content.length > 200 ? '...' : ''}`);
                });
            }

            return parts.join('\n');
        } catch (err) {
            console.debug('Memory retrieval failed:', err);
            return '';
        }
    }, [_user?.email]);

    // Initialize speech recognition
    useEffect(() => {
        if (SpeechRecognition) {
            const recognition = new SpeechRecognition();
            recognition.continuous = false;
            recognition.interimResults = true;
            recognition.lang = 'en-US';

            recognition.onresult = (event: any) => {
                const transcript = Array.from(event.results)
                    .map((result: any) => result[0].transcript)
                    .join('');

                setInput(transcript);

                // If final result, submit
                if (event.results[event.results.length - 1].isFinal) {
                    setIsListening(false);
                    if (transcript.trim()) {
                        handleCommand(transcript.trim());
                        setInput('');
                    }
                }
            };

            recognition.onerror = (event: any) => {
                console.error('Speech recognition error:', event.error);
                setIsListening(false);
            };

            recognition.onend = () => {
                setIsListening(false);
            };

            recognitionRef.current = recognition;
        }

        // Load available voices
        if (speechSynthesis) {
            const loadVoices = () => {
                const voices = speechSynthesis.getVoices();
                setAvailableVoices(voices);
                // Try to find a nice female voice for Aria
                const preferred = voices.find(v =>
                    v.name.includes('Samantha') ||
                    v.name.includes('Victoria') ||
                    v.name.includes('Karen') ||
                    v.name.includes('Google UK English Female') ||
                    (v.lang.startsWith('en') && v.name.toLowerCase().includes('female'))
                );
                if (preferred) {
                    setVoiceSettings(prev => ({ ...prev, voice: preferred }));
                }
            };
            loadVoices();
            speechSynthesis.onvoiceschanged = loadVoices;
        }

        return () => {
            if (recognitionRef.current) {
                recognitionRef.current.abort();
            }
        };
    }, []);

    // Speak Aria messages
    const speakAria = useCallback((text: string) => {
        if (!voiceSettings.enabled || !voiceSettings.speakAria || !speechSynthesis) return;

        // Cancel any current speech
        speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(stripMarkdown(text));
        utterance.voice = voiceSettings.voice;
        utterance.rate = voiceSettings.rate;
        utterance.pitch = voiceSettings.pitch;

        speechSynthesis.speak(utterance);
    }, [voiceSettings]);

    // Toggle voice listening
    const toggleListening = useCallback(() => {
        if (!recognitionRef.current) {
            addMessage('error', 'Voice input not supported in this browser.');
            return;
        }

        if (isListening) {
            recognitionRef.current.abort();
            setIsListening(false);
        } else {
            setInput('');
            recognitionRef.current.start();
            setIsListening(true);
        }
    }, [isListening]);

    // Auto-scroll to bottom
    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, []);

    useEffect(() => {
        scrollToBottom();
    }, [messages, scrollToBottom]);

    // Show Aria intro on mount (and speak it if voice enabled) - Ensure only once
    const hasGreeted = useRef(false);
    useEffect(() => {
        if (!hasGreeted.current && messages.length === 0) {
            addMessage('aria', ARIA_INTRO);
            hasGreeted.current = true;
        }
    }, []);

    // Watch for new blackboard entries and show them
    useEffect(() => {
        if (entries.length > lastEntryCountRef.current) {
            const newEntries = entries.slice(lastEntryCountRef.current);
            newEntries.forEach(entry => {
                const agent = agents.find(a => a.id === entry.author);
                addMessage('agent', entry.title, {
                    agentId: entry.author,
                    agentName: agent?.name || entry.author,
                    agentTier: agent?.tier,
                    entryType: entry.type,
                    metadata: { content: entry.content, status: entry.status },
                });
            });
        }
        lastEntryCountRef.current = entries.length;
    }, [entries, agents]);

    // Watch for new approvals
    useEffect(() => {
        approvals.forEach(approval => {
            const existingMsg = messages.find(m => m.approvalId === approval.id);
            if (!existingMsg) {
                addMessage('approval', `**Approval Required**: ${approval.summary}`, {
                    approvalId: approval.id,
                    metadata: { type: approval.type },
                });
            }
        });
    }, [approvals]);

    const addMessage = useCallback((type: ConsoleMessage['type'], content: string, extra?: Partial<ConsoleMessage>) => {
        const msg: ConsoleMessage = {
            id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            type,
            content,
            timestamp: new Date(),
            ...extra,
        };
        setMessages(prev => [...prev, msg]);

        // Store to memory (non-blocking)
        if (type === 'user') {
            storeToMemory('user', content);
        } else if (type === 'aria') {
            storeToMemory('aria', content);
            // Speak Aria messages
            speakAria(content);
        }
    }, [speakAria, storeToMemory]);

    const parseCommand = (input: string): { command: string; args: string[] } => {
        const parts = input.trim().match(/(?:[^\s"]+|"[^"]*")+/g) || [];
        const command = parts[0]?.toLowerCase() || '';
        const args = parts.slice(1).map(a => a.replace(/^"|"$/g, ''));
        return { command, args };
    };

    const handleCommand = async (rawInput: string) => {
        const trimmed = rawInput.trim();
        if (!trimmed) return;

        // Add to history
        setCommandHistory(prev => [...prev.filter(c => c !== trimmed), trimmed]);
        setHistoryIndex(-1);

        // Show user input
        addMessage('user', trimmed);

        const { command, args } = parseCommand(trimmed);

        setIsProcessing(true);

        try {
            switch (command) {
                case 'help':
                    handleHelp(args[0]);
                    break;

                case 'status':
                    handleStatus();
                    break;

                case 'agents':
                    handleAgents(args);
                    break;

                case 'agent':
                    handleAgentDetail(args[0]);
                    break;

                case 'spawn':
                    await handleSpawn(args);
                    break;

                case 'task':
                    await handleTask(args);
                    break;

                case 'tick':
                    await handleTick();
                    break;

                case 'hitl':
                    await handleHITL(args[0]);
                    break;

                case 'approve':
                    await handleApprove(args[0], true);
                    break;

                case 'deny':
                    await handleApprove(args[0], false, args.slice(1).join(' '));
                    break;

                case 'tasks':
                case 'pending':
                case 'phases': {
                    // Show tasks grouped by phase/status
                    const phaseFilter = args[0]?.toUpperCase();
                    const taskEntries = entries.filter(e => e.type === 'TASK');
                    const problemEntries = entries.filter(e => e.type === 'PROBLEM' && e.status === 'OPEN');

                    if (taskEntries.length === 0 && approvals.length === 0 && problemEntries.length === 0) {
                        addMessage('aria', '✅ **All Clear!** No pending tasks, approvals, or problems.');
                        break;
                    }

                    // Group tasks by status
                    const byStatus: Record<string, typeof taskEntries> = {};
                    taskEntries.forEach(t => {
                        const status = t.status || 'OPEN';
                        if (!byStatus[status]) byStatus[status] = [];
                        byStatus[status].push(t);
                    });

                    // If filter provided, show only that phase
                    if (phaseFilter && byStatus[phaseFilter]) {
                        const filtered = byStatus[phaseFilter];
                        const list = filtered.map(t => `  📋 **${t.title}** - ${t.author}`).join('\n');
                        addMessage('aria', `**${phaseFilter} Tasks** (${filtered.length}):\n\n${list}`);
                        break;
                    }

                    // Build summary
                    let summary = '**📋 Task Phases Overview**\n\n';

                    // Approvals first (highest priority)
                    if (approvals.length > 0) {
                        summary += `⏳ **AWAITING APPROVAL** (${approvals.length})\n`;
                        approvals.slice(0, 3).forEach(a => {
                            summary += `  • ${a.summary} — \`approve ${a.id.slice(0, 8)}\`\n`;
                        });
                        if (approvals.length > 3) summary += `  _(+${approvals.length - 3} more)_\n`;
                        summary += '\n';
                    }

                    // Open tasks
                    if (byStatus['OPEN']?.length) {
                        summary += `📥 **OPEN** (${byStatus['OPEN'].length}) — Awaiting assignment\n`;
                        byStatus['OPEN'].slice(0, 3).forEach(t => {
                            summary += `  • ${t.title}\n`;
                        });
                        if (byStatus['OPEN'].length > 3) summary += `  _(+${byStatus['OPEN'].length - 3} more)_\n`;
                        summary += '\n';
                    }

                    // In Progress
                    if (byStatus['IN_PROGRESS']?.length) {
                        summary += `🔄 **IN PROGRESS** (${byStatus['IN_PROGRESS'].length}) — Being worked on\n`;
                        byStatus['IN_PROGRESS'].slice(0, 3).forEach(t => {
                            summary += `  • ${t.title} — ${t.author}\n`;
                        });
                        if (byStatus['IN_PROGRESS'].length > 3) summary += `  _(+${byStatus['IN_PROGRESS'].length - 3} more)_\n`;
                        summary += '\n';
                    }

                    // Problems
                    if (problemEntries.length > 0) {
                        summary += `⚠️ **PROBLEMS** (${problemEntries.length})\n`;
                        problemEntries.slice(0, 3).forEach(p => {
                            summary += `  • ${p.title}\n`;
                        });
                        if (problemEntries.length > 3) summary += `  _(+${problemEntries.length - 3} more)_\n`;
                        summary += '\n';
                    }

                    // Resolved (recent)
                    if (byStatus['RESOLVED']?.length) {
                        summary += `✅ **RESOLVED** (${byStatus['RESOLVED'].length}) — Completed\n`;
                    }

                    summary += '\n💡 _Use_ `tasks OPEN` _or_ `tasks IN_PROGRESS` _to filter by phase._';
                    addMessage('aria', summary);
                    break;
                }

                case 'clear':
                    setMessages([]);
                    addMessage('aria', 'Console cleared. How can I help you?');
                    break;

                case 'gather':
                    await handleGather(args.join(' '));
                    break;

                case 'ask':
                    await handleAsk(args);
                    break;

                case 'aria':
                    await handleAriaSettings(args);
                    break;

                case 'advisors':
                    await handleAdvisors(args);
                    break;

                default:
                    // Natural language - interpret intent
                    handleNaturalLanguage(trimmed);
            }
        } catch (error) {
            addMessage('error', `Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }

        setIsProcessing(false);
    };

    const handleHelp = (command?: string) => {
        if (command && CLI_COMMANDS[command as keyof typeof CLI_COMMANDS]) {
            const cmd = CLI_COMMANDS[command as keyof typeof CLI_COMMANDS];
            addMessage('aria', `**${command}**\n\n${cmd.description}\n\nUsage: \`${cmd.usage}\`\n\nExamples:\n${cmd.examples.map(e => `  \`${e}\``).join('\n')}`);
        } else {
            const cmdList = Object.entries(CLI_COMMANDS)
                .map(([name, cmd]) => `  \`${name}\` - ${cmd.description}`)
                .join('\n');
            addMessage('aria', `**Available Commands**\n\n${cmdList}\n\nType \`help <command>\` for details.`);
        }
    };

    const handleStatus = () => {
        const working = agents.filter(a => a.status === 'WORKING').length;
        const idle = agents.filter(a => a.status === 'IDLE').length;
        const inMeeting = agents.filter(a => a.status === 'IN_MEETING').length;
        const level = getHITLLevel(hitlLevel);
        const openProblems = entries.filter(e => e.type === 'PROBLEM' && e.status === 'OPEN');
        const openTasks = entries.filter(e => e.type === 'TASK' && e.status === 'OPEN');
        const inProgressTasks = entries.filter(e => e.type === 'TASK' && e.status === 'IN_PROGRESS');
        const avgTrust = agents.length > 0
            ? Math.round(agents.reduce((sum, a) => sum + a.trustScore, 0) / agents.length)
            : 0;

        let status = `**System Status**

🤖 **Agents**: ${agents.length} total (${working} working, ${idle} idle${inMeeting > 0 ? `, ${inMeeting} in meeting` : ''})
📊 **Avg Trust**: ${avgTrust}
${level.icon} **Governance**: ${hitlLevel}% - ${level.label}
`;

        // Show pending items requiring attention
        const hasPending = approvals.length > 0 || openTasks.length > 0 || openProblems.length > 0;

        if (hasPending) {
            status += `\n---\n**⏳ Pending Actions**\n`;

            // Approvals awaiting human decision
            if (approvals.length > 0) {
                status += `\n🔐 **Awaiting Approval** (${approvals.length}) — _Requires your decision_\n`;
                approvals.slice(0, 3).forEach(a => {
                    const reason = a.type === 'SPAWN' ? 'Agent wants to spawn' :
                                   a.type === 'DECISION' ? 'Decision requires approval' :
                                   a.type === 'STRATEGY' ? 'Strategy needs review' : 'Needs approval';
                    status += `  • ${a.summary}\n    _Reason: ${reason}_ — \`approve ${a.id.slice(0, 8)}\`\n`;
                });
                if (approvals.length > 3) status += `  _(+${approvals.length - 3} more)_\n`;
            }

            // Open tasks waiting for assignment
            if (openTasks.length > 0) {
                status += `\n📥 **Unassigned Tasks** (${openTasks.length}) — _Need agent assignment_\n`;
                openTasks.slice(0, 3).forEach(t => {
                    status += `  • ${t.title}\n    _Reason: No agent assigned yet. Run \`tick\` to assign._\n`;
                });
                if (openTasks.length > 3) status += `  _(+${openTasks.length - 3} more)_\n`;
            }

            // In-progress tasks
            if (inProgressTasks.length > 0) {
                status += `\n🔄 **In Progress** (${inProgressTasks.length}) — _Being worked on_\n`;
                inProgressTasks.slice(0, 2).forEach(t => {
                    status += `  • ${t.title} — ${t.author}\n`;
                });
                if (inProgressTasks.length > 2) status += `  _(+${inProgressTasks.length - 2} more)_\n`;
            }

            // Open problems
            if (openProblems.length > 0) {
                status += `\n⚠️ **Open Problems** (${openProblems.length}) — _Need investigation_\n`;
                openProblems.slice(0, 2).forEach(p => {
                    status += `  • ${p.title}\n`;
                });
                if (openProblems.length > 2) status += `  _(+${openProblems.length - 2} more)_\n`;
            }

            status += `\n---\n💡 _Use \`pending\` for detailed view or click **⏳ Pending** button._`;
        } else {
            status += `\n✅ **All Clear!** No pending actions. Agents are working autonomously.`;
        }

        addMessage('aria', status);
    };

    const handleAgents = (args: string[]) => {
        let filtered = [...agents];
        const filter = args[0]?.toLowerCase();

        if (filter) {
            if (['working', 'idle', 'waiting'].includes(filter)) {
                filtered = agents.filter(a => a.status.toLowerCase() === filter.toUpperCase());
            } else if (filter.startsWith('tier=')) {
                const tier = parseInt(filter.split('=')[1]);
                filtered = agents.filter(a => a.tier === tier);
            } else if (filter.startsWith('type=')) {
                const type = filter.split('=')[1].toUpperCase();
                filtered = agents.filter(a => a.type === type);
            }
        }

        if (filtered.length === 0) {
            addMessage('aria', 'No agents match that filter.');
            return;
        }

        const grouped = filtered.reduce((acc, a) => {
            acc[a.tier] = acc[a.tier] || [];
            acc[a.tier].push(a);
            return acc;
        }, {} as Record<number, Agent[]>);

        const lines = Object.entries(grouped)
            .sort(([a], [b]) => Number(b) - Number(a))
            .map(([tier, agents]) => {
                const tierConfig = TIERS[Number(tier) as keyof typeof TIERS];
                const agentLines = agents.map(a => {
                    const status = AGENT_STATUS[a.status as keyof typeof AGENT_STATUS];
                    return `  ${getAgentIcon(a.type)} **${a.name}** - ${status?.icon || '⚪'} ${a.status} (Trust: ${a.trustScore})`;
                }).join('\n');
                return `**T${tier} ${tierConfig.label}** (${agents.length})\n${agentLines}`;
            })
            .join('\n\n');

        addMessage('aria', `**Agent Directory** (${filtered.length}/${agents.length})\n\n${lines}`);
    };

    const handleAgentDetail = (idOrName?: string) => {
        if (!idOrName) {
            addMessage('aria', 'Please specify an agent ID or name. Example: `agent exec-1`');
            return;
        }

        const agent = agents.find(a =>
            a.id === idOrName ||
            a.name.toLowerCase() === idOrName.toLowerCase() ||
            a.name.toLowerCase().includes(idOrName.toLowerCase())
        );

        if (!agent) {
            addMessage('aria', `No agent found matching "${idOrName}".`);
            return;
        }

        const tierConfig = TIERS[agent.tier as keyof typeof TIERS];
        const status = AGENT_STATUS[agent.status as keyof typeof AGENT_STATUS];
        const recentEntries = entries
            .filter(e => e.author === agent.id)
            .slice(-3)
            .map(e => `  ${getEntryConfig(e.type).icon} ${e.title}`)
            .join('\n') || '  (none)';

        addMessage('aria', `**${getAgentIcon(agent.type)} ${agent.name}**

📍 **ID**: ${agent.id}
🏷️ **Type**: ${agent.type}
🎖️ **Tier**: T${agent.tier} ${tierConfig.label}
💯 **Trust**: ${agent.trustScore}
${status?.icon || '⚪'} **Status**: ${agent.status}
📍 **Location**: ${agent.location.floor} / ${agent.location.room}

**Recent Activity**:
${recentEntries}${onSelectAgent ? '\n\n_Click "Open Profile" below to see full details._' : ''}`);

        // If callback is provided, offer to open full profile
        if (onSelectAgent) {
            onSelectAgent(agent.id);
        }
    };

    const handleSpawn = async (args: string[]) => {
        if (args.length < 2) {
            addMessage('aria', 'Please provide type and name. Example: `spawn worker "DataAnalyst" tier=2`');
            return;
        }

        const type = args[0].toUpperCase();
        const name = args[1];
        let tier = 1;

        const tierArg = args.find(a => a.startsWith('tier='));
        if (tierArg) {
            tier = parseInt(tierArg.split('=')[1]) || 1;
        }

        if (!AGENT_TYPES[type as keyof typeof AGENT_TYPES]) {
            const types = Object.keys(AGENT_TYPES).map(t => t.toLowerCase()).join(', ');
            addMessage('aria', `Unknown agent type "${type}". Available: ${types}`);
            return;
        }

        addMessage('aria', `Spawning ${type} agent "${name}" at Tier ${tier}...`);

        try {
            if (onSpawn) {
                onSpawn(name, type, tier);
            } else {
                await api.spawnAgent({ name, type, tier });
            }
            const tierConfig = TIERS[tier as keyof typeof TIERS];
            addMessage('system', `✅ Agent **${name}** spawned successfully!\n\n${getAgentIcon(type)} Type: ${type}\n🎖️ Tier: T${tier} ${tierConfig.label}`);
        } catch (e) {
            addMessage('error', `Failed to spawn agent: ${e instanceof Error ? e.message : 'Unknown error'}`);
        }
    };

    const handleTask = async (args: string[]) => {
        if (args.length === 0) {
            addMessage('aria', 'Please provide a task description. Example: `task "Analyze user engagement data" priority=high`');
            return;
        }

        const description = args[0];
        let priority = 'NORMAL';

        const priorityArg = args.find(a => a.startsWith('priority='));
        if (priorityArg) {
            priority = priorityArg.split('=')[1].toUpperCase();
        }

        addMessage('aria', `Creating task: "${description}"...`);

        try {
            const result = await api.createTask(description, 'Human', priority);
            addMessage('system', `✅ Task created!\n\n📋 "${description}"\n🔼 Priority: ${priority}\n\n${result.message || 'Task added to queue.'}`);
        } catch (e) {
            addMessage('error', `Failed to create task: ${e instanceof Error ? e.message : 'Unknown error'}`);
        }
    };

    const handleTick = async () => {
        addMessage('aria', 'Running agent work cycle...');

        try {
            const result = await api.tick();
            const events = result.events?.slice(0, 8).map((e: string) => `  • ${e}`).join('\n') || '  (no events)';

            // Build comprehensive tick result
            let tickResult = `✅ **Tick completed!**

📊 **Processed**: ${result.processed || 0}
📋 **Assigned**: ${result.assigned || 0}
✅ **Completed**: ${result.completed || 0}
🤖 **Idle Agents**: ${result.idleAgentsAvailable ?? 'N/A'}

**Events**:
${events}`;

            // Show assignments if any
            if (result.assignments && result.assignments.length > 0) {
                tickResult += `\n\n---\n**📋 New Assignments:**`;
                result.assignments.slice(0, 5).forEach((a: { agentName: string; taskTitle: string }) => {
                    tickResult += `\n  • ${a.agentName} → "${a.taskTitle}"`;
                });
                if (result.assignments.length > 5) {
                    tickResult += `\n  _(+${result.assignments.length - 5} more)_`;
                }
            }

            // Show pending summary from API
            const queue = result.queue || {};
            const hasPending = (queue.pending || 0) > 0 || (queue.awaitingApproval || 0) > 0;

            if (hasPending) {
                tickResult += `\n\n---\n**⏳ Still Pending:**`;

                if (queue.awaitingApproval > 0) {
                    tickResult += `\n  🔐 ${queue.awaitingApproval} awaiting approval — _Requires your decision_`;
                }
                if (queue.pending > 0) {
                    tickResult += `\n  📥 ${queue.pending} queued — _Waiting for idle agents_`;
                }
                if (queue.inProgress > 0) {
                    tickResult += `\n  🔄 ${queue.inProgress} in-progress — _Agents working_`;
                }

                // Show specific pending items if available
                const pendingItems = result.pendingSummary?.items;
                if (pendingItems && pendingItems.length > 0) {
                    tickResult += `\n\n**Details:**`;
                    pendingItems.slice(0, 3).forEach((item: { title: string; reason: string }) => {
                        tickResult += `\n  • "${item.title}" — ${item.reason}`;
                    });
                }

                tickResult += `\n\n💡 _Run \`tick\` again to process more._`;
            } else if (result.completed === 0 && result.assigned === 0) {
                tickResult += `\n\n✅ **All caught up!** No pending work.`;
            }

            addMessage('system', tickResult);
        } catch (e) {
            addMessage('error', `Tick failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
        }
    };

    const handleHITL = async (level?: string) => {
        if (!level) {
            const current = getHITLLevel(hitlLevel);
            addMessage('aria', `Current governance level: **${hitlLevel}%** (${current.label})\n\nUse \`hitl <0-100>\` to adjust.`);
            return;
        }

        const newLevel = parseInt(level);
        if (isNaN(newLevel) || newLevel < 0 || newLevel > 100) {
            addMessage('aria', 'Please provide a number between 0 and 100.');
            return;
        }

        try {
            if (onSetHITL) {
                onSetHITL(newLevel);
            } else {
                await api.setHITL(newLevel);
            }
            const levelConfig = getHITLLevel(newLevel);
            addMessage('system', `✅ Governance level set to **${newLevel}%**\n\n${levelConfig.icon} ${levelConfig.label}: ${levelConfig.description}`);
        } catch (e) {
            addMessage('error', `Failed to set HITL: ${e instanceof Error ? e.message : 'Unknown error'}`);
        }
    };

    const handleApprove = async (id?: string, approved: boolean = true, reason?: string) => {
        if (!id) {
            if (approvals.length === 0) {
                addMessage('aria', 'No pending approvals.');
                return;
            }
            const list = approvals.map(a => `  \`${a.id}\` - ${a.summary}`).join('\n');
            addMessage('aria', `**Pending Approvals** (${approvals.length}):\n\n${list}\n\nUse \`approve <id>\` or \`deny <id> [reason]\``);
            return;
        }

        const approval = approvals.find(a => a.id === id || a.id.includes(id));
        if (!approval) {
            addMessage('aria', `No approval found with ID "${id}".`);
            return;
        }

        try {
            if (onApprove) {
                onApprove(approval.id, approved);
            } else {
                await api.approve(approval.id, approved);
            }
            if (approved) {
                addMessage('system', `✅ Approved: ${approval.summary}`);
            } else {
                addMessage('system', `❌ Denied: ${approval.summary}${reason ? `\nReason: ${reason}` : ''}`);
            }
        } catch (e) {
            addMessage('error', `Failed to process approval: ${e instanceof Error ? e.message : 'Unknown error'}`);
        }
    };

    // Gather perspectives from all AI providers
    const handleGather = async (question: string) => {
        if (!question.trim()) {
            addMessage('aria', `**Gather Perspectives**

Ask all available AI providers for their perspective on a question.

Usage: \`gather <your question>\`

Examples:
- \`gather What are the best practices for AI agent orchestration?\`
- \`gather How should we handle trust decay in multi-agent systems?\`

I'll query all configured AI providers and synthesize their responses.`);
            return;
        }

        addMessage('aria', `🔍 Gathering perspectives from all AI providers...`);

        try {
            const result = await api.gatherPerspectives(question);

            if (!result.success) {
                setMessages(prev => prev.slice(0, -1));
                addMessage('aria', `Failed to gather perspectives: ${result.error}`);
                return;
            }

            // Remove the "gathering" message
            setMessages(prev => prev.slice(0, -1));

            // Show individual perspectives
            const perspectiveLines = result.perspectives
                .filter(p => p.success)
                .map(p => `**${p.provider.toUpperCase()}** (${p.model}):\n${p.perspective}`)
                .join('\n\n---\n\n');

            const failed = result.perspectives.filter(p => !p.success);
            const failedNote = failed.length > 0
                ? `\n\n⚠️ *${failed.length} provider(s) unavailable*`
                : '';

            if (result.synthesis) {
                addMessage('aria', `**Gathered ${result.providersSucceeded}/${result.providersQueried} Perspectives**

${perspectiveLines}

---

**🔮 Aria ascertains**:
${result.synthesis}${failedNote}`);
            } else {
                addMessage('aria', `**Gathered ${result.providersSucceeded}/${result.providersQueried} Perspectives**

${perspectiveLines}${failedNote}`);
            }
        } catch (error) {
            setMessages(prev => prev.slice(0, -1));
            addMessage('error', `Failed to gather perspectives: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    };

    // Ask a specific AI provider
    const handleAsk = async (args: string[]) => {
        const provider = args[0]?.toLowerCase() as 'claude' | 'grok' | 'openai' | 'gemini' | undefined;
        const question = args.slice(1).join(' ');

        if (!provider || !['claude', 'grok', 'openai', 'gemini'].includes(provider)) {
            addMessage('aria', `**Ask a Specific AI**

Query a specific AI provider directly.

Usage: \`ask <provider> <your question>\`

Providers: claude, grok, openai, gemini

Examples:
- \`ask claude How should we structure agent hierarchies?\`
- \`ask grok What's the latest on AI safety research?\`
- \`ask openai Explain quantum computing in simple terms\``);
            return;
        }

        if (!question.trim()) {
            addMessage('aria', `Please provide a question for ${provider}. Example: \`ask ${provider} What is...\``);
            return;
        }

        addMessage('aria', `🤔 Asking ${provider.toUpperCase()}...`);

        try {
            const result = await api.consultProvider(question, provider);

            setMessages(prev => prev.slice(0, -1));

            if (!result.success) {
                if (result.availableProviders) {
                    addMessage('aria', `${provider} is not available. Available providers: ${result.availableProviders.join(', ')}`);
                } else {
                    addMessage('aria', `Failed to consult ${provider}: ${result.error}`);
                }
                return;
            }

            addMessage('aria', `**${provider.toUpperCase()}** (${result.model}):\n\n${result.response}`);
        } catch (error) {
            setMessages(prev => prev.slice(0, -1));
            addMessage('error', `Failed to consult ${provider}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    };

    // Aria AI settings
    const handleAriaSettings = async (args: string[]) => {
        const subcommand = args[0]?.toLowerCase();

        try {
            const settingsResult = await api.getAriaSettings();

            if (!subcommand) {
                const s = settingsResult.settings;
                addMessage('aria', `**Aria AI Settings**

🤖 **Status**: ${s.enabled ? '✅ Enabled' : '❌ Disabled'}
🎯 **Mode**: ${s.mode === 'single' ? 'Single Provider' : s.mode === 'all' ? 'All Providers' : 'Selected Providers'}
🎪 **Default Provider**: ${s.defaultProvider || 'auto'}
📋 **Enabled Providers**: ${s.enabledProviders.join(', ')}
🔄 **Auto-Synthesize**: ${s.synthesize ? 'Yes' : 'No'}
📊 **Token Limit**: ${s.maxTokensPerQuery}
📈 **Daily Limit**: ${s.dailyQueryLimit || 'Unlimited'} (used: ${s.queriesUsedToday})

**Available Providers**: ${settingsResult.availableProviders.join(', ') || 'None configured'}

**Commands**:
- \`aria on\` / \`aria off\` - Enable/disable AI
- \`aria mode <single|all|select>\` - Set query mode
- \`aria provider <name>\` - Set default provider
- \`aria synthesize <on|off>\` - Toggle auto-synthesis
- \`aria limit <number>\` - Set daily query limit (0 = unlimited)`);
                return;
            }

            switch (subcommand) {
                case 'on':
                    await api.setAriaSettings({ enabled: true });
                    addMessage('aria', '✅ Aria AI is now **enabled**.');
                    break;

                case 'off':
                    await api.setAriaSettings({ enabled: false });
                    addMessage('aria', '❌ Aria AI is now **disabled**. Use direct commands or type `aria on` to re-enable.');
                    break;

                case 'mode':
                    const mode = args[1]?.toLowerCase() as 'single' | 'all' | 'select';
                    if (!mode || !['single', 'all', 'select'].includes(mode)) {
                        addMessage('aria', 'Usage: `aria mode <single|all|select>`\n- single: Use one provider\n- all: Query all providers\n- select: Use only enabled providers');
                        return;
                    }
                    await api.setAriaSettings({ mode });
                    addMessage('aria', `🎯 AI mode set to **${mode}**.`);
                    break;

                case 'provider':
                    const provider = args[1]?.toLowerCase() as 'claude' | 'grok' | 'openai' | 'gemini';
                    if (!provider || !['claude', 'grok', 'openai', 'gemini'].includes(provider)) {
                        addMessage('aria', 'Usage: `aria provider <claude|grok|openai|gemini>`');
                        return;
                    }
                    await api.setAriaSettings({ defaultProvider: provider });
                    addMessage('aria', `🎪 Default provider set to **${provider}**.`);
                    break;

                case 'synthesize':
                    const synth = args[1]?.toLowerCase();
                    if (!synth || !['on', 'off'].includes(synth)) {
                        addMessage('aria', 'Usage: `aria synthesize <on|off>`');
                        return;
                    }
                    await api.setAriaSettings({ synthesize: synth === 'on' });
                    addMessage('aria', `🔄 Auto-synthesis is now **${synth === 'on' ? 'enabled' : 'disabled'}**.`);
                    break;

                case 'limit':
                    const limit = parseInt(args[1] || '');
                    if (isNaN(limit) || limit < 0) {
                        addMessage('aria', 'Usage: `aria limit <number>` (0 = unlimited)');
                        return;
                    }
                    await api.setAriaSettings({ dailyQueryLimit: limit });
                    addMessage('aria', `📈 Daily query limit set to **${limit || 'unlimited'}**.`);
                    break;

                default:
                    addMessage('aria', `Unknown setting: ${subcommand}. Type \`aria\` to see all settings.`);
            }
        } catch (error) {
            addMessage('error', `Failed to update settings: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    };

    // Advisor management commands
    const handleAdvisors = async (args: string[]) => {
        const subcommand = args[0]?.toLowerCase();

        try {
            if (!subcommand) {
                // List all advisors
                const result = await api.getAdvisors();
                if (!result.success) {
                    addMessage('error', 'Failed to load advisors');
                    return;
                }

                const advisorList = result.advisors.map(a => {
                    const status = a.available ? '✅' : '❌';
                    const aliases = a.aliases.length > 0 ? ` (aliases: ${a.aliases.join(', ')})` : '';
                    return `  ${a.icon || '🤖'} **${a.name}** → ${a.provider} ${status}${aliases}`;
                }).join('\n');

                addMessage('aria', `**Configured Advisors**

${advisorList}

**Council**: "${result.councilName}" (aliases: ${result.councilAliases.join(', ')})

**Commands**:
- \`advisors add <name> <provider> [aliases...]\` - Add/update advisor
- \`advisors remove <name>\` - Remove advisor
- \`advisors alias <name> <alias>\` - Add alias to advisor
- \`advisors council <name>\` - Rename the council
- \`advisors personality <name> <description>\` - Set advisor personality
- \`advisors icon <name> <emoji>\` - Set advisor icon

**Example**: \`advisors add Jarvis claude jarv j\``);
                return;
            }

            switch (subcommand) {
                case 'add': {
                    const name = args[1];
                    const provider = args[2]?.toLowerCase() as 'claude' | 'grok' | 'openai' | 'gemini';
                    const aliases = args.slice(3);

                    if (!name || !provider) {
                        addMessage('aria', 'Usage: `advisors add <name> <provider> [aliases...]`\n\nProviders: claude, grok, openai, gemini\n\nExample: `advisors add Jarvis claude jarv j`');
                        return;
                    }

                    if (!['claude', 'grok', 'openai', 'gemini'].includes(provider)) {
                        addMessage('aria', `Invalid provider "${provider}". Valid providers: claude, grok, openai, gemini`);
                        return;
                    }

                    const result = await api.addAdvisor({ name, provider, aliases });
                    if (result.success) {
                        addMessage('aria', `✅ Advisor **${name}** ${result.action}!\n\n🔗 Provider: ${provider}\n🏷️ Aliases: ${aliases.length > 0 ? aliases.join(', ') : '(none)'}\n\nYou can now say things like:\n- "What does ${name} think about X?"\n- "Ask ${name} about Y"`);

                        // Refresh config
                        const updated = await api.getAdvisors();
                        if (updated.success) {
                            setAdvisorConfig({
                                advisors: updated.advisors,
                                councilName: updated.councilName,
                                councilAliases: updated.councilAliases,
                            });
                        }
                    } else {
                        addMessage('error', `Failed to add advisor: ${(result as any).error}`);
                    }
                    break;
                }

                case 'remove': {
                    const name = args[1];
                    if (!name) {
                        addMessage('aria', 'Usage: `advisors remove <name>`');
                        return;
                    }

                    const result = await api.removeAdvisor(name);
                    if (result.success) {
                        addMessage('aria', `✅ Advisor **${name}** removed.`);

                        // Refresh config
                        const updated = await api.getAdvisors();
                        if (updated.success) {
                            setAdvisorConfig({
                                advisors: updated.advisors,
                                councilName: updated.councilName,
                                councilAliases: updated.councilAliases,
                            });
                        }
                    } else {
                        addMessage('error', result.error || 'Failed to remove advisor');
                    }
                    break;
                }

                case 'alias': {
                    const name = args[1];
                    const newAliases = args.slice(2);

                    if (!name || newAliases.length === 0) {
                        addMessage('aria', 'Usage: `advisors alias <name> <alias1> [alias2...]`');
                        return;
                    }

                    // Get current advisor
                    const current = await api.getAdvisors();
                    const advisor = current.advisors.find(a => a.name.toLowerCase() === name.toLowerCase());
                    if (!advisor) {
                        addMessage('aria', `Advisor "${name}" not found`);
                        return;
                    }

                    // Add new aliases
                    const updatedAliases = [...new Set([...advisor.aliases, ...newAliases])];
                    const result = await api.addAdvisor({
                        name: advisor.name,
                        provider: advisor.provider,
                        aliases: updatedAliases,
                        personality: advisor.personality,
                        icon: advisor.icon,
                    });

                    if (result.success) {
                        addMessage('aria', `✅ Aliases for **${advisor.name}** updated: ${updatedAliases.join(', ')}`);

                        // Refresh config
                        const updated = await api.getAdvisors();
                        if (updated.success) {
                            setAdvisorConfig({
                                advisors: updated.advisors,
                                councilName: updated.councilName,
                                councilAliases: updated.councilAliases,
                            });
                        }
                    }
                    break;
                }

                case 'council': {
                    const newName = args[1];
                    const newAliases = args.slice(2);

                    if (!newName) {
                        addMessage('aria', 'Usage: `advisors council <name> [aliases...]`\n\nExample: `advisors council tribunal judges panel`');
                        return;
                    }

                    const result = await api.setCouncilConfig({
                        name: newName,
                        aliases: newAliases.length > 0 ? newAliases : undefined,
                    });

                    if (result.success) {
                        addMessage('aria', `✅ Council renamed to **${result.councilName}**\n\nAliases: ${result.councilAliases.join(', ')}\n\nYou can now say things like:\n- "Ask the ${newName} about X"\n- "What does the ${newName} think?"`);

                        // Refresh config
                        const updated = await api.getAdvisors();
                        if (updated.success) {
                            setAdvisorConfig({
                                advisors: updated.advisors,
                                councilName: updated.councilName,
                                councilAliases: updated.councilAliases,
                            });
                        }
                    }
                    break;
                }

                case 'personality': {
                    const name = args[1];
                    const personality = args.slice(2).join(' ');

                    if (!name || !personality) {
                        addMessage('aria', 'Usage: `advisors personality <name> <description>`\n\nExample: `advisors personality Jarvis You are Jarvis, a sophisticated AI butler with dry British wit.`');
                        return;
                    }

                    // Get current advisor
                    const current = await api.getAdvisors();
                    const advisor = current.advisors.find(a => a.name.toLowerCase() === name.toLowerCase());
                    if (!advisor) {
                        addMessage('aria', `Advisor "${name}" not found`);
                        return;
                    }

                    const result = await api.addAdvisor({
                        name: advisor.name,
                        provider: advisor.provider,
                        aliases: advisor.aliases,
                        personality: personality,
                        icon: advisor.icon,
                    });

                    if (result.success) {
                        addMessage('aria', `✅ Personality for **${advisor.name}** updated.\n\n"${personality.substring(0, 100)}${personality.length > 100 ? '...' : ''}"`);
                    }
                    break;
                }

                case 'icon': {
                    const name = args[1];
                    const icon = args[2];

                    if (!name || !icon) {
                        addMessage('aria', 'Usage: `advisors icon <name> <emoji>`\n\nExample: `advisors icon Jarvis 🎩`');
                        return;
                    }

                    // Get current advisor
                    const current = await api.getAdvisors();
                    const advisor = current.advisors.find(a => a.name.toLowerCase() === name.toLowerCase());
                    if (!advisor) {
                        addMessage('aria', `Advisor "${name}" not found`);
                        return;
                    }

                    const result = await api.addAdvisor({
                        name: advisor.name,
                        provider: advisor.provider,
                        aliases: advisor.aliases,
                        personality: advisor.personality,
                        icon: icon,
                    });

                    if (result.success) {
                        addMessage('aria', `✅ Icon for **${advisor.name}** set to ${icon}`);

                        // Refresh config
                        const updated = await api.getAdvisors();
                        if (updated.success) {
                            setAdvisorConfig({
                                advisors: updated.advisors,
                                councilName: updated.councilName,
                                councilAliases: updated.councilAliases,
                            });
                        }
                    }
                    break;
                }

                default:
                    addMessage('aria', `Unknown subcommand: ${subcommand}. Type \`advisors\` to see all commands.`);
            }
        } catch (error) {
            addMessage('error', `Failed to update advisors: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    };

    // Cached advisor configuration
    const [advisorConfig, setAdvisorConfig] = useState<{
        advisors: Array<{
            name: string;
            provider: 'claude' | 'grok' | 'openai' | 'gemini';
            aliases: string[];
            icon?: string;
            available?: boolean;
        }>;
        councilName: string;
        councilAliases: string[];
    } | null>(null);

    // Load advisor config on mount
    useEffect(() => {
        api.getAdvisors().then(result => {
            if (result.success) {
                setAdvisorConfig({
                    advisors: result.advisors,
                    councilName: result.councilName,
                    councilAliases: result.councilAliases,
                });
            }
        }).catch(() => {
            // Use defaults if API fails
            setAdvisorConfig({
                advisors: [
                    { name: 'Claude', provider: 'claude', aliases: ['anthropic', 'sonnet', 'opus'], icon: '🧠' },
                    { name: 'Grok', provider: 'grok', aliases: ['x', 'xai'], icon: '⚡' },
                    { name: 'GPT', provider: 'openai', aliases: ['openai', 'chatgpt'], icon: '🤖' },
                    { name: 'Gemini', provider: 'gemini', aliases: ['google', 'bard'], icon: '💎' },
                ],
                councilName: 'council',
                councilAliases: ['advisors', 'team', 'minds', 'ais', 'everyone', 'all'],
            });
        });
    }, []);

    // Detect advisor consultation requests from natural language (uses dynamic config)
    const detectAdvisorRequest = (input: string): { type: 'ask' | 'gather' | null; provider?: string; advisorName?: string; question?: string } => {
        if (!advisorConfig) {
            return { type: null };
        }

        // Build advisor name pattern from config
        const allAdvisorNames = advisorConfig.advisors.flatMap(a => [a.name.toLowerCase(), ...a.aliases.map(x => x.toLowerCase())]);
        const advisorNamesPattern = allAdvisorNames.join('|');

        // Build council pattern from config
        const councilPatterns = [advisorConfig.councilName.toLowerCase(), ...advisorConfig.councilAliases.map(x => x.toLowerCase())].join('|');

        // Check for single advisor patterns
        const askPatterns = [
            // "What does Claude think about X?"
            new RegExp(`what\\s+does\\s+(${advisorNamesPattern})\\s+(?:think|say|recommend|suggest)(?:\\s+about)?\\s*(.+)`, 'i'),
            // "Ask Claude about X"
            new RegExp(`ask\\s+(${advisorNamesPattern})\\s+(?:about\\s+)?(.+)`, 'i'),
            // "Claude, what is X?" / "Claude: what about X?"
            new RegExp(`^(${advisorNamesPattern})[,:]\\s*(.+)`, 'i'),
            // "Get Claude's opinion on X"
            new RegExp(`get\\s+(${advisorNamesPattern})(?:'s)?\\s+(?:opinion|thoughts?|view|perspective|take)\\s+(?:on\\s+)?(.+)`, 'i'),
            // "Consult Claude about X"
            new RegExp(`consult\\s+(${advisorNamesPattern})\\s+(?:about\\s+)?(.+)`, 'i'),
            // "What would Claude say about X?"
            new RegExp(`what\\s+would\\s+(${advisorNamesPattern})\\s+(?:say|think|recommend)\\s+(?:about\\s+)?(.+)`, 'i'),
        ];

        for (const pattern of askPatterns) {
            const match = input.match(pattern);
            if (match) {
                const nameOrAlias = match[1].toLowerCase();
                // Find the advisor and get its provider
                const advisor = advisorConfig.advisors.find(
                    a => a.name.toLowerCase() === nameOrAlias || a.aliases.map(x => x.toLowerCase()).includes(nameOrAlias)
                );
                if (advisor) {
                    return {
                        type: 'ask',
                        provider: advisor.provider,
                        advisorName: advisor.name,
                        question: match[2].trim().replace(/\?$/, ''),
                    };
                }
            }
        }

        // Patterns for consulting all advisors / the council
        const gatherPatterns = [
            // "Ask the council about X"
            new RegExp(`ask\\s+(?:the\\s+)?(?:${councilPatterns})\\s+(?:about\\s+)?(.+)`, 'i'),
            // "Consult the advisors about X"
            new RegExp(`consult\\s+(?:the\\s+)?(?:${councilPatterns})\\s+(?:about\\s+)?(.+)`, 'i'),
            // "What do the advisors think about X?"
            new RegExp(`what\\s+do\\s+(?:the\\s+)?(?:${councilPatterns})\\s+(?:think|say|recommend)\\s+(?:about\\s+)?(.+)`, 'i'),
            // "Get everyone's opinion on X"
            /get\s+(?:everyone|all|every|the)(?:'s)?\s+(?:opinion|thoughts?|views?|perspectives?|takes?)\s+(?:on\s+)?(.+)/i,
            // "Ask all the AIs about X"
            new RegExp(`ask\\s+all\\s+(?:the\\s+)?(?:${councilPatterns})\\s+(?:about\\s+)?(.+)`, 'i'),
            // "What does everyone think about X?"
            /what\s+(?:do|does)\s+everyone\s+(?:think|say)\s+(?:about\s+)?(.+)/i,
            // "Gather perspectives on X"
            /gather\s+(?:perspectives?|opinions?|thoughts?|views?)\s+(?:on\s+|about\s+)?(.+)/i,
        ];

        for (const pattern of gatherPatterns) {
            const match = input.match(pattern);
            if (match) {
                return {
                    type: 'gather',
                    question: match[1].trim().replace(/\?$/, ''),
                };
            }
        }

        return { type: null };
    };

    const handleNaturalLanguage = async (input: string) => {
        // First check for advisor consultation patterns
        const advisorRequest = detectAdvisorRequest(input);

        if (advisorRequest.type === 'ask' && advisorRequest.provider && advisorRequest.question) {
            addMessage('aria', `🔮 Let me consult ${advisorRequest.provider.toUpperCase()} for you...`);
            await handleAsk([advisorRequest.provider, advisorRequest.question]);
            return;
        }

        if (advisorRequest.type === 'gather' && advisorRequest.question) {
            await handleGather(advisorRequest.question);
            return;
        }

        // Show thinking indicator
        addMessage('aria', '🤔 Let me understand what you need...');

        try {
            // Call AI interpretation API with context
            const result = await api.interpretMessage(input, {
                agents: agents.map(a => ({
                    id: a.id,
                    name: a.name,
                    type: a.type,
                    tier: a.tier,
                    status: a.status,
                })),
                pendingApprovals: approvals.length,
                hitlLevel: hitlLevel,
                recentTasks: entries.filter(e => e.type === 'TASK').slice(-5).map(e => ({
                    title: e.title,
                    status: e.status,
                })),
            });

            const { interpretation } = result;

            // Remove the "thinking" message by replacing it
            setMessages(prev => prev.slice(0, -1));

            // Execute the interpreted action
            switch (interpretation.action) {
                case 'SPAWN':
                    if (interpretation.params.name && interpretation.params.type) {
                        await handleSpawn([
                            interpretation.params.type,
                            interpretation.params.name,
                            `tier=${interpretation.params.tier || 1}`,
                        ]);
                    } else {
                        addMessage('aria', interpretation.response);
                    }
                    break;

                case 'TASK':
                    if (interpretation.params.description) {
                        await handleTask([
                            interpretation.params.description,
                            `priority=${interpretation.params.priority || 'NORMAL'}`,
                        ]);
                    } else {
                        addMessage('aria', interpretation.response);
                    }
                    break;

                case 'STATUS':
                    handleStatus();
                    break;

                case 'AGENTS':
                    handleAgents(interpretation.params.filter ? [interpretation.params.filter] : []);
                    break;

                case 'AGENT_DETAIL':
                    handleAgentDetail(interpretation.params.identifier || interpretation.params.name);
                    break;

                case 'APPROVE':
                    await handleApprove(interpretation.params.id, true);
                    break;

                case 'DENY':
                    await handleApprove(interpretation.params.id, false, interpretation.params.reason);
                    break;

                case 'HITL':
                    await handleHITL(String(interpretation.params.level));
                    break;

                case 'TICK':
                    await handleTick();
                    break;

                case 'HELP':
                    handleHelp(interpretation.params.command);
                    break;

                case 'CHAT':
                default:
                    // Full AI conversation - Aria responds intelligently to anything
                    if (interpretation.response && interpretation.confidence > 0.3) {
                        addMessage('aria', interpretation.response);
                    } else {
                        // Low confidence - get a full AI response
                        await handleFullConversation(input);
                    }
                    break;
            }

            // Show provider info if high confidence action
            if (result.provider && interpretation.confidence > 0.8 && interpretation.action !== 'CHAT') {
                // Silent - action already executed
            }

        } catch (error) {
            // Remove thinking message
            setMessages(prev => prev.slice(0, -1));

            // AI interpretation failed - try full conversation mode
            await handleFullConversation(input);
        }
    };

    // Full AI conversation - Aria as a super-intelligent assistant like J.A.R.V.I.S.
    // Uses all available AIs to validate and enhance responses
    const handleFullConversation = async (input: string) => {
        addMessage('aria', '💭 Consulting my neural networks...');

        try {
            // Retrieve memory context in parallel with settings check
            const [settingsResult, memoryContext] = await Promise.all([
                api.getAriaSettings().catch(() => null),
                getMemoryContext(input),
            ]);

            const mode = settingsResult?.settings?.mode || 'single';
            const availableProviders = settingsResult?.availableProviders || ['claude'];

            // If multiple providers available and mode is 'all', use collective intelligence
            if (mode === 'all' && availableProviders.length > 1) {
                await handleCollectiveIntelligence(input, availableProviders, memoryContext);
                return;
            }

            // Build context with memory
            let systemContext = `Current Aurais context:
- ${agents.length} agents active (${agents.filter(a => a.status === 'WORKING').length} working)
- ${approvals.length} pending approvals
- HITL governance level: ${hitlLevel}%
- Recent activity: ${entries.slice(-3).map(e => e.title).join(', ') || 'none'}`;

            // Add memory context if available
            if (memoryContext) {
                systemContext += `\n\n--- Memory Context ---\n${memoryContext}`;
            }

            const result = await api.consultProvider(input, 'claude',
                'You are Aria, an advanced AI assistant for Aurais HQ - like J.A.R.V.I.S. from Iron Man. You are intelligent, helpful, witty, and knowledgeable about everything. You can discuss any topic, answer any question, provide analysis, and engage in natural conversation. Be concise but thorough. Show personality. You have access to memory of past conversations and system knowledge - use this context when relevant to provide continuity and personalized assistance.',
                systemContext
            );

            setMessages(prev => prev.slice(0, -1)); // Remove thinking

            if (result.success && result.response) {
                addMessage('aria', result.response);
            } else {
                handleBasicFallback(input);
            }
        } catch (error) {
            setMessages(prev => prev.slice(0, -1));
            handleBasicFallback(input);
        }
    };

    // Collective Intelligence - consult all AIs and synthesize the best answer
    const handleCollectiveIntelligence = async (input: string, providers: string[], memoryContext?: string) => {
        setMessages(prev => prev.slice(0, -1)); // Remove old thinking
        addMessage('aria', `🧠 Consulting ${providers.length} AI minds: ${providers.join(', ')}...`);

        try {
            let systemContext = `Aurais system: ${agents.length} agents, ${approvals.length} pending approvals, HITL: ${hitlLevel}%`;
            if (memoryContext) {
                systemContext += `\n\nMemory Context:\n${memoryContext}`;
            }

            const result = await api.gatherPerspectives(
                input,
                `You are part of Aria's collective intelligence. ${systemContext}. Answer as a helpful, intelligent AI assistant with memory of past interactions.`,
                true // synthesize
            );

            setMessages(prev => prev.slice(0, -1)); // Remove consulting message

            if (!result.success || result.providersSucceeded === 0) {
                handleBasicFallback(input);
                return;
            }

            // If we got a synthesis, use it as the main response
            if (result.synthesis) {
                // Show synthesis as main response
                addMessage('aria', result.synthesis);

                // If there were interesting differences, note them
                const successfulPerspectives = result.perspectives.filter(p => p.success);
                if (successfulPerspectives.length > 1) {
                    const providerNames = successfulPerspectives.map(p => p.provider.toUpperCase()).join(', ');
                    addMessage('system', `💡 *Validated across ${successfulPerspectives.length} AIs: ${providerNames}*`);
                }
            } else if (result.perspectives.length > 0) {
                // No synthesis, show the first successful response
                const best = result.perspectives.find(p => p.success);
                if (best) {
                    addMessage('aria', best.perspective);
                } else {
                    handleBasicFallback(input);
                }
            }
        } catch (error) {
            setMessages(prev => prev.slice(0, -1));
            handleBasicFallback(input);
        }
    };

    // Basic fallback when AI is completely unavailable
    const handleBasicFallback = (input: string) => {
        const lower = input.toLowerCase().trim();

        if (/^(hi|hello|hey)\b/i.test(lower)) {
            addMessage('aria', `Hello! I'm Aria. My AI connection seems limited right now, but I can still help with system commands. Try \`status\`, \`agents\`, or \`help\`.`);
        } else if (/\b(thanks|thank you)\b/i.test(lower)) {
            addMessage('aria', `You're welcome! 😊`);
        } else {
            addMessage('aria', `I'm having trouble connecting to my AI backend. In the meantime, try:\n\n- \`status\` - System overview\n- \`agents\` - List agents\n- \`help\` - All commands\n\nOr check that the API is running.`);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleCommand(input);
            setInput('');
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (commandHistory.length > 0) {
                const newIndex = historyIndex < commandHistory.length - 1 ? historyIndex + 1 : historyIndex;
                setHistoryIndex(newIndex);
                setInput(commandHistory[commandHistory.length - 1 - newIndex] || '');
            }
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (historyIndex > 0) {
                const newIndex = historyIndex - 1;
                setHistoryIndex(newIndex);
                setInput(commandHistory[commandHistory.length - 1 - newIndex] || '');
            } else {
                setHistoryIndex(-1);
                setInput('');
            }
        }
    };

    const renderMessage = (msg: ConsoleMessage) => {
        const styles: Record<ConsoleMessage['type'], { bg: string; border: string; icon: string }> = {
            user: { bg: 'rgba(59, 130, 246, 0.1)', border: 'var(--accent-blue)', icon: '👤' },
            aria: { bg: 'rgba(139, 92, 246, 0.1)', border: 'var(--accent-purple)', icon: '✨' },
            system: { bg: 'rgba(16, 185, 129, 0.1)', border: 'var(--accent-green)', icon: '⚙️' },
            agent: { bg: 'rgba(245, 158, 11, 0.05)', border: 'var(--border-color)', icon: getAgentIcon(msg.metadata?.type as string || '') },
            error: { bg: 'rgba(239, 68, 68, 0.1)', border: 'var(--accent-red)', icon: '❌' },
            approval: { bg: 'rgba(245, 158, 11, 0.15)', border: 'var(--accent-gold)', icon: '⏳' },
        };

        const style = styles[msg.type];

        return (
            <div
                key={msg.id}
                style={{
                    padding: '12px 16px',
                    marginBottom: '8px',
                    background: style.bg,
                    borderLeft: `3px solid ${style.border}`,
                    borderRadius: '0 8px 8px 0',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    {/* Icon/Avatar */}
                    {msg.type === 'agent' ? (
                        <div style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '50%',
                            background: TIERS[msg.agentTier as keyof typeof TIERS]?.gradient || 'var(--bg-card)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '14px',
                            flexShrink: 0,
                        }}>
                            {msg.entryType ? getEntryConfig(msg.entryType).icon : style.icon}
                        </div>
                    ) : (
                        <span style={{ fontSize: '16px', flexShrink: 0 }}>{style.icon}</span>
                    )}

                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                        {/* Header */}
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            marginBottom: '4px',
                            fontSize: '0.75rem',
                            color: 'var(--text-muted)',
                        }}>
                            {msg.type === 'user' && <span style={{ fontWeight: 600, color: 'var(--accent-blue)' }}>You</span>}
                            {msg.type === 'aria' && <span style={{ fontWeight: 600, color: 'var(--accent-purple)' }}>Aria</span>}
                            {msg.type === 'agent' && (
                                <>
                                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{msg.agentName}</span>
                                    {msg.entryType && (
                                        <span style={{
                                            padding: '1px 6px',
                                            background: getEntryConfig(msg.entryType).color,
                                            color: 'white',
                                            borderRadius: '4px',
                                            fontSize: '0.65rem',
                                            fontWeight: 600,
                                        }}>
                                            {msg.entryType}
                                        </span>
                                    )}
                                </>
                            )}
                            {msg.type === 'approval' && <span style={{ fontWeight: 600, color: 'var(--accent-gold)' }}>Approval Needed</span>}
                            <span>{formatTime(msg.timestamp)}</span>
                        </div>

                        {/* Body - render markdown-like formatting */}
                        <div style={{
                            fontSize: '0.9rem',
                            lineHeight: 1.5,
                            color: msg.type === 'error' ? 'var(--accent-red)' : 'var(--text-primary)',
                            whiteSpace: 'pre-wrap',
                        }}>
                            {msg.content.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, i) => {
                                if (part.startsWith('**') && part.endsWith('**')) {
                                    return <strong key={i}>{part.slice(2, -2)}</strong>;
                                }
                                if (part.startsWith('`') && part.endsWith('`')) {
                                    return (
                                        <code
                                            key={i}
                                            style={{
                                                padding: '2px 6px',
                                                background: 'var(--bg-secondary)',
                                                borderRadius: '4px',
                                                fontSize: '0.85em',
                                                fontFamily: 'var(--font-mono)',
                                            }}
                                        >
                                            {part.slice(1, -1)}
                                        </code>
                                    );
                                }
                                return part;
                            })}
                        </div>

                        {/* Approval actions */}
                        {msg.type === 'approval' && msg.approvalId && (
                            <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                                <button
                                    onClick={() => handleApprove(msg.approvalId, true)}
                                    style={{
                                        padding: '6px 14px',
                                        background: 'var(--accent-green)',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '6px',
                                        fontSize: '0.8rem',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                    }}
                                >
                                    ✓ Approve
                                </button>
                                <button
                                    onClick={() => handleApprove(msg.approvalId, false)}
                                    style={{
                                        padding: '6px 14px',
                                        background: 'var(--accent-red)',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '6px',
                                        fontSize: '0.8rem',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                    }}
                                >
                                    ✗ Deny
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            background: 'var(--bg-primary)',
            borderRadius: '12px',
            overflow: 'hidden',
            border: '1px solid var(--border-color)',
        }}>
            {/* Header - Simplified (NavBar handles main navigation) */}
            <div className="console-header console-header--compact">
                {/* Left: Aria Title + Stats */}
                <div className="console-header-brand">
                    <span className="console-header-icon">✨</span>
                    <span className="console-title">Aria Console</span>
                    <div className="console-stats-inline">
                        <span className="console-stat">{agents.length} agents</span>
                        <span className="console-stat">{approvals.length} pending</span>
                        <span className="console-stat">HITL {hitlLevel}%</span>
                    </div>
                </div>

                {/* Right: Console-specific quick actions */}
                <div className="console-header-actions">
                    <Tooltip
                        content={TOOLTIP_CONTENT.ACTION_STATUS.content}
                        title={TOOLTIP_CONTENT.ACTION_STATUS.title}
                        position="bottom"
                    >
                        <button className="console-btn console-btn--compact" onClick={() => handleCommand('status')}>
                            📊
                        </button>
                    </Tooltip>
                    <Tooltip
                        content={TOOLTIP_CONTENT.ACTION_TICK.content}
                        title={TOOLTIP_CONTENT.ACTION_TICK.title}
                        position="bottom"
                    >
                        <button className="console-btn console-btn-primary console-btn--compact" onClick={() => handleCommand('tick')}>
                            ⚡ Tick
                        </button>
                    </Tooltip>
                    {/* Auto-tick alarm clock toggle */}
                    {onToggleAutoTick && (
                        <div className="auto-tick-control">
                            <button
                                className={`console-btn console-btn--compact auto-tick-btn ${autoTickEnabled ? 'auto-tick-btn--active' : ''}`}
                                onClick={onToggleAutoTick}
                                title={autoTickEnabled ? `Auto-tick ON (every ${autoTickInterval / 1000}s) - Click to stop` : 'Enable auto-tick'}
                            >
                                ⏰ {autoTickEnabled ? 'ON' : 'Auto'}
                            </button>
                            {autoTickEnabled && onSetAutoTickInterval && (
                                <select
                                    className="auto-tick-interval"
                                    value={autoTickInterval}
                                    onChange={(e) => onSetAutoTickInterval(Number(e.target.value))}
                                    title="Auto-tick interval"
                                >
                                    <option value={3000}>3s</option>
                                    <option value={5000}>5s</option>
                                    <option value={10000}>10s</option>
                                    <option value={30000}>30s</option>
                                    <option value={60000}>1m</option>
                                </select>
                            )}
                        </div>
                    )}
                    {onOpenPending && approvals.length > 0 && (
                        <button
                            className="pending-indicator pending-indicator-pulse pending-indicator--compact"
                            onClick={onOpenPending}
                        >
                            ⏳ <span className="pending-indicator-count">{approvals.length}</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Messages */}
            <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: '16px',
            }}>
                {messages.map(renderMessage)}
                {isProcessing && (
                    <div style={{
                        padding: '12px 16px',
                        color: 'var(--text-muted)',
                        fontSize: '0.9rem',
                    }}>
                        <span style={{ animation: 'pulse 1s infinite' }}>✨ Aria is thinking...</span>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div style={{
                padding: '16px',
                background: 'var(--bg-secondary)',
                borderTop: '1px solid var(--border-color)',
            }}>
                {/* Voice controls bar */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '12px',
                    padding: '8px 12px',
                    background: voiceSettings.enabled ? 'rgba(139, 92, 246, 0.1)' : 'transparent',
                    borderRadius: '8px',
                    border: voiceSettings.enabled ? '1px solid var(--accent-purple)' : '1px solid transparent',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {/* Voice toggle */}
                        <button
                            onClick={() => setVoiceSettings(prev => ({ ...prev, enabled: !prev.enabled }))}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '6px 12px',
                                background: voiceSettings.enabled ? 'var(--accent-purple)' : 'var(--bg-card)',
                                color: voiceSettings.enabled ? 'white' : 'var(--text-muted)',
                                border: 'none',
                                borderRadius: '6px',
                                fontSize: '0.8rem',
                                cursor: 'pointer',
                            }}
                        >
                            {voiceSettings.enabled ? '🔊' : '🔇'} Voice {voiceSettings.enabled ? 'On' : 'Off'}
                        </button>

                        {voiceSettings.enabled && (
                            <>
                                {/* Speak Aria toggle */}
                                <label style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    fontSize: '0.75rem',
                                    color: 'var(--text-secondary)',
                                    cursor: 'pointer',
                                }}>
                                    <input
                                        type="checkbox"
                                        checked={voiceSettings.speakAria}
                                        onChange={e => setVoiceSettings(prev => ({ ...prev, speakAria: e.target.checked }))}
                                    />
                                    Aria speaks
                                </label>

                                {/* Voice selector */}
                                {availableVoices.length > 0 && (
                                    <select
                                        value={voiceSettings.voice?.name || ''}
                                        onChange={e => {
                                            const voice = availableVoices.find(v => v.name === e.target.value);
                                            setVoiceSettings(prev => ({ ...prev, voice: voice || null }));
                                        }}
                                        style={{
                                            padding: '4px 8px',
                                            background: 'var(--bg-card)',
                                            border: '1px solid var(--border-color)',
                                            borderRadius: '4px',
                                            color: 'var(--text-secondary)',
                                            fontSize: '0.7rem',
                                            maxWidth: '150px',
                                        }}
                                    >
                                        {availableVoices.filter(v => v.lang.startsWith('en')).map(voice => (
                                            <option key={voice.name} value={voice.name}>
                                                {voice.name.replace('Microsoft ', '').replace(' Online (Natural)', '')}
                                            </option>
                                        ))}
                                    </select>
                                )}
                            </>
                        )}
                    </div>

                    {/* Listening indicator */}
                    {isListening && (
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            color: 'var(--accent-red)',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                        }}>
                            <span style={{
                                width: '10px',
                                height: '10px',
                                borderRadius: '50%',
                                background: 'var(--accent-red)',
                                animation: 'pulse 1s infinite',
                            }} />
                            Listening...
                        </div>
                    )}
                </div>

                {/* Input row */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    background: isListening ? 'rgba(239, 68, 68, 0.1)' : 'var(--bg-primary)',
                    borderRadius: '10px',
                    padding: '4px 4px 4px 16px',
                    border: isListening ? '2px solid var(--accent-red)' : '2px solid var(--border-color)',
                    transition: 'all 0.2s ease',
                }}>
                    <span style={{ color: 'var(--accent-purple)', fontWeight: 600 }}>›</span>
                    <input
                        ref={inputRef}
                        type="text"
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={isListening ? 'Listening... speak now' : 'Type a command or ask Aria...'}
                        disabled={isProcessing}
                        style={{
                            flex: 1,
                            padding: '12px 0',
                            background: 'transparent',
                            border: 'none',
                            outline: 'none',
                            color: 'var(--text-primary)',
                            fontSize: '0.95rem',
                            fontFamily: 'var(--font-mono)',
                        }}
                    />

                    {/* Microphone button */}
                    {SpeechRecognition && (
                        <button
                            onClick={toggleListening}
                            disabled={isProcessing}
                            title={isListening ? 'Stop listening' : 'Start voice input'}
                            style={{
                                width: '44px',
                                height: '44px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                background: isListening ? 'var(--accent-red)' : 'var(--bg-card)',
                                color: isListening ? 'white' : 'var(--text-muted)',
                                border: 'none',
                                borderRadius: '8px',
                                fontSize: '1.2rem',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                            }}
                        >
                            {isListening ? '⏹️' : '🎤'}
                        </button>
                    )}

                    <button
                        onClick={() => { handleCommand(input); setInput(''); }}
                        disabled={isProcessing || !input.trim()}
                        style={{
                            padding: '10px 20px',
                            background: input.trim() ? 'var(--accent-purple)' : 'var(--bg-card)',
                            color: input.trim() ? 'white' : 'var(--text-muted)',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: '0.9rem',
                            fontWeight: 600,
                            cursor: input.trim() ? 'pointer' : 'not-allowed',
                        }}
                    >
                        Send
                    </button>
                </div>
                {/* Quick Actions */}
                <div className="console-quick-actions">
                    <button
                        className="quick-action-btn"
                        onClick={() => handleCommand('spawn')}
                        title="Spawn a new agent"
                    >
                        <span className="quick-action-icon">➕</span>
                        <span className="quick-action-label">Spawn</span>
                    </button>
                    <button
                        className="quick-action-btn"
                        onClick={() => handleCommand('status')}
                        title="View system status"
                    >
                        <span className="quick-action-icon">📊</span>
                        <span className="quick-action-label">Status</span>
                    </button>
                    <button
                        className="quick-action-btn"
                        onClick={() => handleCommand('list agents')}
                        title="List all agents"
                    >
                        <span className="quick-action-icon">🤖</span>
                        <span className="quick-action-label">Agents</span>
                    </button>
                    <button
                        className="quick-action-btn"
                        onClick={() => handleCommand('feed')}
                        title="View activity feed"
                    >
                        <span className="quick-action-icon">📰</span>
                        <span className="quick-action-label">Feed</span>
                    </button>
                    <button
                        className="quick-action-btn quick-action-primary"
                        onClick={() => handleCommand('tick')}
                        title="Run a system tick"
                    >
                        <span className="quick-action-icon">⚡</span>
                        <span className="quick-action-label">Tick</span>
                    </button>
                    {onOpenInsights && (
                        <button
                            className="quick-action-btn"
                            onClick={onOpenInsights}
                            title="View AI insights and suggestions"
                            style={{ background: 'rgba(139, 92, 246, 0.2)' }}
                        >
                            <span className="quick-action-icon">💡</span>
                            <span className="quick-action-label">Insights</span>
                        </button>
                    )}
                    {onOpenSpawnWizard && (
                        <button
                            className="quick-action-btn"
                            onClick={onOpenSpawnWizard}
                            title="Aria-guided agent creation"
                            style={{ background: 'rgba(16, 185, 129, 0.2)' }}
                        >
                            <span className="quick-action-icon">✨</span>
                            <span className="quick-action-label">Wizard</span>
                        </button>
                    )}
                </div>

                {/* Keyboard hints */}
                <div className="console-hints">
                    <span><kbd>Enter</kbd> Send</span>
                    <span><kbd>↑↓</kbd> History</span>
                    {SpeechRecognition && <span><kbd>🎤</kbd> Voice</span>}
                    <span><kbd>help</kbd> Commands</span>
                </div>
            </div>
        </div>
    );
}
