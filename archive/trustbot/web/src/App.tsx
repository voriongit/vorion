// Aurais - AI Agent Governance Platform powered by Vorion BASIS
import { useState, useEffect } from 'react';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { LoginScreen } from './components/LoginScreen';
import { Console } from './components/Console';
import { NavBar, type NavView } from './components/NavBar';
import { ControlPanel } from './components/ControlPanel';
import { BlueprintSelector } from './components/BlueprintSelector';
import { IntegrationConfig } from './components/IntegrationConfig';
import { HITLExplanation } from './components/HITLExplanation';
import { AgentListModal } from './components/AgentListModal';
import { TrustBreakdownModal } from './components/TrustBreakdownModal';
import { MetricsDashboard } from './components/MetricsDashboard';
import { ConnectionStatusModal } from './components/ConnectionStatusModal';
import { AgentProfilePage } from './components/AgentProfilePage';
import { TaskBoard } from './components/TaskBoard';
import { SkillsManagementModal } from './components/SkillsManagementModal';
import { CommsDashboard } from './components/CommsDashboard';
import { GenesisProtocol, isGenesisComplete, resetGenesis } from './components/GenesisProtocol';
import { HelpPanel } from './components/HelpPanel';
import { LoadingOverlay } from './components/LoadingOverlay';
import { ErrorBanner } from './components/ErrorBanner';
import { ThoughtLogPanel } from './components/ThoughtLogPanel';
import { GameUXProvider, AchievementToast, type Achievement } from './components/GameUX';
import { SkillLibrary } from './components/SkillLibrary';
import { AutonomyQuery } from './components/AutonomyQuery';
import { RequestGrantPanel } from './components/RequestGrantPanel';
import { CodeGovernance } from './components/CodeGovernance';
import { AgentPermissionsPanel } from './components/AgentPermissionsPanel';
import { GuidedOnboarding } from './components/GuidedOnboarding';
import { SpawnTutorial } from './components/SpawnTutorial';
import { Glossary } from './components/Glossary';
import { PendingActionsPanel } from './components/PendingActionsPanel';
import { AgentTaskQueue } from './components/AgentTaskQueue';
import { SpawnWizard, type SpawnConfig } from './components/SpawnWizard';
import { InsightsPanel } from './components/InsightsPanel';
import { ArtifactsView } from './components/ArtifactsView';
import { ReassignAgentModal } from './components/ReassignAgentModal';
import { ToastProvider } from './components/ui';
import { useAurais } from './hooks';
import { api } from './api';
import type { HITLUser } from './types';

// Modal state types - simplified for Console-first architecture
type ModalType = 'none' | 'agent' | 'blackboard' | 'controls' | 'blueprints' | 'integrations' | 'hitl' | 'agentList' | 'trustBreakdown' | 'metrics' | 'connectionStatus' | 'tasks' | 'adminSkills' | 'comms' | 'thoughtLog' | 'skillLibrary' | 'autonomyQuery' | 'requestGrant' | 'codeGovernance' | 'guidedOnboarding' | 'tutorial' | 'glossary' | 'pending' | 'permissions' | 'taskQueue' | 'spawnWizard' | 'insights' | 'artifacts' | 'reassign';

// Inner app component that can use game context
function AppContent() {
    // Unified Aurais hook - single source of truth
    const {
        agents,
        blackboardEntries,
        approvals,
        hitlLevel,
        avgTrust,
        uptime,
        loading,
        error,
        persistenceMode,
        spawnAgent,
        setHITL,
        approve,
        refresh,
    } = useAurais();

    // Game UX state (for achievements)
    const [showAchievement, setShowAchievement] = useState<Achievement | null>(null);

    const [activeModal, setActiveModal] = useState<ModalType>('none');
    const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

    // Navigation state for NavBar
    const [currentView, setCurrentView] = useState<NavView>('console');

    // Auto-tick alarm clock state
    const [autoTickEnabled, setAutoTickEnabled] = useState(false);
    const [autoTickInterval, setAutoTickInterval] = useState(5000); // 5 seconds default

    // Auto-tick effect
    useEffect(() => {
        if (!autoTickEnabled) return;

        const intervalId = setInterval(async () => {
            try {
                await api.tick();
                await refresh();
            } catch (e) {
                console.error('Auto-tick failed:', e);
            }
        }, autoTickInterval);

        return () => clearInterval(intervalId);
    }, [autoTickEnabled, autoTickInterval, refresh]);

    // User assistance state
    const [showGenesis, setShowGenesis] = useState(() => !isGenesisComplete());
    const [showHelpPanel, setShowHelpPanel] = useState(false);
    const [errorDismissed, setErrorDismissed] = useState(false);

    // Initial Load: Sync Settings
    useEffect(() => {
        api.getSettings().then(settings => {
            if (settings?.mcp) {
                // [Deleted MCP Config]
            }
        }).catch(e => console.warn('Failed to sync settings', e));
    }, []);

    // Auth state with user info
    const [authenticated, setAuthenticated] = useState(() => {
        return sessionStorage.getItem('aurais_auth') === 'true';
    });
    const [currentUser, setCurrentUser] = useState<{ email: string; name: string; picture?: string } | null>(() => {
        const stored = sessionStorage.getItem('aurais_user');
        return stored ? JSON.parse(stored) : null;
    });

    // HITL User - the human operator (CEO by default)
    const hitlUser: HITLUser | undefined = currentUser ? {
        id: 'hitl-primary',
        structuredId: '9901',           // CEO (9) + All Areas (0) + Instance (1)
        name: currentUser.name || 'Operator',
        authority: 9,                   // CEO level
        area: 0,                        // All areas
        status: 'ONLINE',
        spawnedAgentIds: agents.filter(a => a.createdByStructuredId === '9901').map(a => a.structuredId || a.id),
    } : undefined;

    const handleLogin = (user?: { email: string; name: string; picture?: string }) => {
        setAuthenticated(true);
        sessionStorage.setItem('aurais_auth', 'true');
        if (user) {
            setCurrentUser(user);
            sessionStorage.setItem('aurais_user', JSON.stringify(user));
        }
    };

    const handleLogout = () => {
        setAuthenticated(false);
        setCurrentUser(null);
        sessionStorage.removeItem('aurais_auth');
        sessionStorage.removeItem('aurais_user');
        sessionStorage.removeItem('aurais_credential');
    };

    // Keyboard accessibility - Escape to close modals
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && activeModal !== 'none') {
                setActiveModal('none');
                setSelectedAgentId(null);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [activeModal]);

    // Get selected data
    const selectedAgent = agents.find(a => a.id === selectedAgentId);

    if (!authenticated) {
        return <LoginScreen onLogin={handleLogin} />;
    }

    // Navigation handlers
    const openAgent = (agentId: string) => {
        setSelectedAgentId(agentId);
        setActiveModal('agent');
    };

    const closeModal = () => {
        setActiveModal('none');
    };

    // NavBar navigation handler
    const handleNavigation = (view: NavView) => {
        setCurrentView(view);
        // Map views to modals where applicable
        switch (view) {
            case 'agents':
                setActiveModal('agentList');
                break;
            case 'tasks':
                setActiveModal('tasks');
                break;
            case 'council':
                setActiveModal('pending'); // Council uses pending approvals
                break;
            case 'settings':
                setActiveModal('controls');
                break;
            case 'metrics':
                setActiveModal('metrics');
                break;
            case 'help':
                setShowHelpPanel(true);
                break;
            case 'glossary':
                setActiveModal('glossary');
                break;
            case 'artifacts':
                setActiveModal('artifacts');
                break;
            case 'console':
            default:
                setActiveModal('none');
                break;
        }
    };

    // NavBar quick action handler
    const handleQuickAction = (action: 'spawn' | 'tick' | 'task') => {
        switch (action) {
            case 'spawn':
                setActiveModal('spawnWizard');
                break;
            case 'tick':
                api.tick().then(() => refresh());
                break;
            case 'task':
                setActiveModal('tasks');
                break;
        }
    };

    // API handlers - delegate to hook
    const handleSpawnAgent = async (name: string, type: string, tier: number) => {
        await spawnAgent(name, type, tier);
    };

    const handleSetHITL = async (level: number) => {
        await setHITL(level);
    };

    const handleSendCommand = async (command: string) => {
        if (selectedAgentId && selectedAgent) {
            try {
                const result = await api.sendCommand(selectedAgentId, command, {
                    name: selectedAgent.name,
                    type: selectedAgent.type,
                    status: selectedAgent.status,
                    trustScore: selectedAgent.trustScore,
                });
                return result ? {
                    command: result.command,
                    response: result.response,
                    timestamp: result.timestamp,
                } : null;
            } catch (e) {
                // Provide context-aware fallback responses based on command
                const cmdLower = command.toLowerCase().trim();
                let response = '';

                if (cmdLower === 'status') {
                    response = `📊 ${selectedAgent.name} Status:\n• State: ${selectedAgent.status}\n• Trust: ${selectedAgent.trustScore}\n• Tier: T${selectedAgent.tier}\n• Type: ${selectedAgent.type}`;
                } else if (cmdLower === 'report') {
                    response = `📋 Activity Report for ${selectedAgent.name}:\n• Current task: Processing queue items\n• Uptime: Active\n• Recent: Completed 3 tasks successfully`;
                } else if (cmdLower === 'pause') {
                    response = `⏸️ Pause command received. Use the Pause button in controls for full functionality.`;
                } else if (cmdLower === 'resume') {
                    response = `▶️ Resume command received. Use the Resume button in controls for full functionality.`;
                } else if (cmdLower === 'review') {
                    response = `🔮 Trust review requested. Current score: ${selectedAgent.trustScore}. Use Evaluate button for full autonomy assessment.`;
                } else if (cmdLower === 'help') {
                    response = `📚 Available Commands:\n• status - Check agent state\n• report - Get activity summary\n• pause/resume - Control agent work\n• review - Request trust evaluation\n• prioritize <task> - Set priority\n• collaborate <agent> - Request help`;
                } else if (cmdLower.startsWith('prioritize')) {
                    response = `⚡ Priority adjustment noted. Open Task Queue (📋) for full task management.`;
                } else if (cmdLower.startsWith('collaborate')) {
                    response = `🤝 Collaboration request logged. The orchestrator will coordinate with available agents.`;
                } else {
                    response = `✅ Command "${command}" queued for ${selectedAgent.name}.\n💡 Tip: Run a system tick to process commands.`;
                }

                return {
                    command,
                    response,
                    timestamp: new Date().toISOString(),
                };
            }
        }
        return null;
    };

    // Show loading overlay on initial load (before any data)
    const showInitialLoading = loading && agents.length === 0;

    // Reset error dismissed when error changes
    const handleRetry = async () => {
        setErrorDismissed(false);
        await refresh();
    };

    return (
        <div className="app-container app-container--with-nav">
            {/* Initial loading state */}
            {showInitialLoading && <LoadingOverlay />}

            {/* API error banner (dismissible) */}
            {error && !errorDismissed && (
                <ErrorBanner
                    error={error}
                    onRetry={handleRetry}
                    onDismiss={() => setErrorDismissed(true)}
                    onOpenSettings={() => setActiveModal('integrations')}
                />
            )}

            {/* Unified Navigation Bar */}
            <NavBar
                currentView={currentView}
                onNavigate={handleNavigation}
                user={currentUser}
                userAuthority={hitlUser?.authority || 0}
                pendingCount={approvals.length}
                onLogout={handleLogout}
                onQuickAction={handleQuickAction}
            />

            {/* Aria Console - Primary Interface */}
            <Console
                agents={agents}
                blackboardEntries={blackboardEntries}
                hitlLevel={hitlLevel}
                approvals={approvals}
                user={currentUser}
                onSpawn={handleSpawnAgent}
                onSetHITL={handleSetHITL}
                onApprove={approve}
                onSelectAgent={openAgent}
                onOpenControls={() => setActiveModal('controls')}
                onOpenAgentList={() => setActiveModal('agentList')}
                onOpenMetrics={() => setActiveModal('metrics')}
                onOpenTasks={() => setActiveModal('tasks')}
                onOpenHelp={() => setShowHelpPanel(true)}
                onOpenTutorial={() => setActiveModal('tutorial')}
                onOpenGlossary={() => setActiveModal('glossary')}
                onOpenPending={() => setActiveModal('pending')}
                onOpenSpawnWizard={() => setActiveModal('spawnWizard')}
                onOpenInsights={() => setActiveModal('insights')}
                onLogout={handleLogout}
                autoTickEnabled={autoTickEnabled}
                autoTickInterval={autoTickInterval}
                onToggleAutoTick={() => setAutoTickEnabled(!autoTickEnabled)}
                onSetAutoTickInterval={setAutoTickInterval}
            />

            {/* Control Panel Modal */}
            {activeModal === 'controls' && (
                <ControlPanel
                    hitlLevel={hitlLevel}
                    onSetHITL={handleSetHITL}
                    onSpawn={handleSpawnAgent}
                    onClose={closeModal}
                    onOpenSpawnWizard={() => setActiveModal('spawnWizard')}
                    onOpenInsights={() => setActiveModal('insights')}
                />
            )}

            {/* Agent Detail Modal */}
            {activeModal === 'agent' && selectedAgent && (
                <AgentProfilePage
                    agent={selectedAgent}
                    allAgents={agents}
                    blackboardEntries={blackboardEntries}
                    onClose={closeModal}
                    onViewAgent={(id) => {
                        setSelectedAgentId(id);
                        // Modal stays open, just updates the agent
                    }}
                    onSendCommand={handleSendCommand}
                    onEvaluateAutonomy={() => {
                        setActiveModal('autonomyQuery');
                    }}
                    onPauseAgent={async (agentId) => {
                        try {
                            await api.pauseAgent(agentId);
                            await refresh();
                        } catch (e) {
                            console.error('Failed to pause agent:', e);
                        }
                    }}
                    onResumeAgent={async (agentId) => {
                        try {
                            await api.resumeAgent(agentId);
                            await refresh();
                        } catch (e) {
                            console.error('Failed to resume agent:', e);
                        }
                    }}
                    onDeleteAgent={async (agentId) => {
                        try {
                            await api.deleteAgent(agentId);
                            closeModal();
                            await refresh();
                            setShowAchievement({
                                id: 'agent-archived',
                                title: 'Agent Archived',
                                description: 'Agent has been archived and removed',
                                icon: '🗑️',
                                rarity: 'common',
                                xpReward: 10,
                            });
                        } catch (e) {
                            console.error('Failed to delete agent:', e);
                        }
                    }}
                    onReassignAgent={() => {
                        setActiveModal('reassign');
                    }}
                    onEditPermissions={() => {
                        setActiveModal('permissions');
                    }}
                    onOpenTaskQueue={() => setActiveModal('taskQueue')}
                />
            )}

            {/* Blueprint Selector */}
            {activeModal === 'blueprints' && (
                <BlueprintSelector
                    onSpawn={(blueprint, name) => {
                        handleSpawnAgent(name, blueprint.category, blueprint.tier);
                    }}
                    onClose={closeModal}
                />
            )}

            {/* Integration Config */}
            {activeModal === 'integrations' && (
                <IntegrationConfig onClose={closeModal} />
            )}

            {/* HITL Explanation */}
            {activeModal === 'hitl' && (
                <HITLExplanation currentLevel={hitlLevel} onClose={closeModal} />
            )}

            {/* Agent List */}
            {activeModal === 'agentList' && (
                <AgentListModal
                    agents={agents}
                    hitlUser={hitlUser}
                    onClose={closeModal}
                    onSelectAgent={(id) => {
                        closeModal();
                        setTimeout(() => openAgent(id), 100);
                    }}
                />
            )}

            {/* Trust Breakdown */}
            {activeModal === 'trustBreakdown' && (
                <TrustBreakdownModal agents={agents} avgTrust={avgTrust} onClose={closeModal} />
            )}

            {/* Blackboard Filter - now integrated into Sidebar with embedded={true} */}

            {/* Metrics Dashboard */}
            {activeModal === 'metrics' && (
                <MetricsDashboard
                    agents={agents}
                    blackboardEntries={blackboardEntries}
                    hitlLevel={hitlLevel}
                    avgTrust={avgTrust}
                    uptime={uptime}
                    onClose={closeModal}
                    onViewAgent={(id) => {
                        closeModal();
                        setTimeout(() => openAgent(id), 100);
                    }}
                />
            )}

            {activeModal === 'connectionStatus' && (
                <ConnectionStatusModal
                    isConnected={!error && !loading}
                    persistenceMode={persistenceMode}
                    onClose={closeModal}
                />
            )}

            {/* Task Board */}
            {activeModal === 'tasks' && (
                <TaskBoard onClose={closeModal} />
            )}

            {/* Admin Skills Panel */}
            {activeModal === 'adminSkills' && (
                <SkillsManagementModal onClose={closeModal} />
            )}

            {activeModal === 'comms' && (
                <CommsDashboard onClose={closeModal} />
            )}

            {/* Thought Log Panel */}
            {activeModal === 'thoughtLog' && (
                <ThoughtLogPanel
                    entries={[
                        {
                            id: 'log-1',
                            agentId: 'exec-1',
                            agentName: 'T5-EXECUTOR',
                            timestamp: new Date().toISOString(),
                            observation: {
                                context: 'System initialization sequence',
                                trigger: 'Boot process completed',
                                inputs: { systemState: 'ready', agentCount: 8 },
                            },
                            reasoning: [
                                { step: 1, thought: 'All subsystems are operational', consideration: 'Health check status', conclusion: 'Proceed with initialization' },
                                { step: 2, thought: 'Agent network is stable', consideration: 'Heartbeat signals received', conclusion: 'Network ready for operations' },
                            ],
                            intent: {
                                goal: 'Initialize morning operations',
                                expectedOutcome: 'All agents receive task assignments',
                                confidence: 0.88,
                            },
                            action: {
                                type: 'BROADCAST',
                                description: 'Sent initialization message to all T5 agents',
                                parameters: { recipients: ['plan-1', 'valid-1', 'evolve-1', 'spawn-1'] },
                            },
                            result: {
                                status: 'success',
                                output: 'Morning briefing completed successfully',
                            },
                            delta: {
                                intentMatched: true,
                                trustImpact: 2,
                                lessonsLearned: 'Early initialization improves throughput',
                            },
                        },
                        {
                            id: 'log-2',
                            agentId: 'plan-1',
                            agentName: 'T5-PLANNER',
                            timestamp: new Date(Date.now() - 300000).toISOString(),
                            observation: {
                                context: 'Strategic planning session',
                                trigger: 'Daily objectives review',
                                inputs: { pendingTasks: 12, priority: 'HIGH' },
                            },
                            reasoning: [
                                { step: 1, thought: 'Resource allocation needs optimization', consideration: 'Queue depth increasing', conclusion: 'Rebalancing required' },
                                { step: 2, thought: 'Should delegate routine tasks to T2 agents', consideration: 'Trust scores support delegation', conclusion: 'Safe to delegate 5 tasks' },
                            ],
                            intent: {
                                goal: 'Optimize task distribution',
                                expectedOutcome: 'Reduced queue depth by 40%',
                                confidence: 0.79,
                            },
                            action: {
                                type: 'DELEGATE',
                                description: 'Delegated 5 routine tasks to worker agents',
                                parameters: { taskIds: ['t-101', 't-102', 't-103', 't-104', 't-105'] },
                            },
                            result: {
                                status: 'success',
                                output: 'Tasks successfully delegated',
                                sideEffects: ['Worker load increased 15%'],
                            },
                            delta: {
                                intentMatched: true,
                                trustImpact: 3,
                            },
                        },
                    ]}
                    onClose={closeModal}
                />
            )}

            {/* Skill Library */}
            {activeModal === 'skillLibrary' && (
                <SkillLibrary
                    onClose={closeModal}
                    selectedAgentId={selectedAgentId || undefined}
                    selectedAgentTier={selectedAgent?.tier || 0}
                    selectedAgentTrustScore={selectedAgent?.trustScore || 0}
                    selectedAgentSkills={selectedAgent?.skills || []}
                    onAssignSkill={(skillId, agentId) => {
                        console.log('Assigned skill:', skillId, 'to agent:', agentId);
                        setShowAchievement({
                            id: 'skill-master',
                            title: 'Skill Assigned',
                            description: 'Assigned a new skill to an agent',
                            icon: '🎮',
                            rarity: 'rare',
                            xpReward: 50,
                        });
                    }}
                />
            )}

            {/* Autonomy Query */}
            {activeModal === 'autonomyQuery' && selectedAgent && (
                <AutonomyQuery
                    agent={selectedAgent}
                    onClose={closeModal}
                    onApprovePromotion={(agentId, newTier) => {
                        console.log('Approved promotion:', agentId, 'to tier', newTier);
                        setShowAchievement({
                            id: 'trust-granted',
                            title: 'Trust Granted',
                            description: `Promoted agent to Tier ${newTier}`,
                            icon: '⬆️',
                            rarity: 'epic',
                            xpReward: 150,
                        });
                    }}
                    onDenyPromotion={(agentId, reason) => {
                        console.log('Denied promotion:', agentId, 'reason:', reason);
                    }}
                />
            )}

            {/* Agent Permissions Panel */}
            {activeModal === 'permissions' && selectedAgent && (
                <AgentPermissionsPanel
                    agent={selectedAgent}
                    onClose={closeModal}
                    onSavePermissions={(agentId, permissions) => {
                        console.log('Saved permissions for:', agentId, permissions);
                        setShowAchievement({
                            id: 'permissions-updated',
                            title: 'Permissions Updated',
                            description: 'Agent access controls have been modified',
                            icon: '🔐',
                            rarity: 'rare',
                            xpReward: 50,
                        });
                    }}
                />
            )}

            {/* Request/Grant Panel */}
            {activeModal === 'requestGrant' && selectedAgent && (
                <RequestGrantPanel
                    currentAgent={selectedAgent}
                    allAgents={agents}
                    onClose={closeModal}
                    onSubmitRequest={(request) => {
                        console.log('Request submitted:', request);
                        setShowAchievement({
                            id: 'help-requested',
                            title: 'Help Requested',
                            description: 'Submitted a request to upper tiers',
                            icon: '🤝',
                            rarity: 'common',
                            xpReward: 25,
                        });
                    }}
                    onGrantRequest={(requestId, capabilities) => {
                        console.log('Request granted:', requestId, capabilities);
                        setShowAchievement({
                            id: 'trust-extended',
                            title: 'Trust Extended',
                            description: 'Granted capabilities to a lower-tier agent',
                            icon: '🎁',
                            rarity: 'rare',
                            xpReward: 75,
                        });
                    }}
                />
            )}

            {/* Code Governance Panel */}
            {activeModal === 'codeGovernance' && (
                <CodeGovernance
                    onClose={closeModal}
                    onApproveChange={(changeId) => {
                        console.log('Approved code change:', changeId);
                        setShowAchievement({
                            id: 'code-approved',
                            title: 'Code Approved',
                            description: 'Approved a code modification request',
                            icon: '✅',
                            rarity: 'rare',
                            xpReward: 50,
                        });
                    }}
                    onRejectChange={(changeId, reason) => {
                        console.log('Rejected code change:', changeId, 'reason:', reason);
                    }}
                />
            )}

            {/* Guided Onboarding Wizard */}
            {activeModal === 'guidedOnboarding' && (
                <GuidedOnboarding
                    onClose={closeModal}
                    onComplete={(config) => {
                        console.log('Onboarding complete:', config);
                        setShowAchievement({
                            id: 'integrations-configured',
                            title: 'Integrations Configured',
                            description: 'Set up MCP, RAG, and API integrations',
                            icon: '🔌',
                            rarity: 'epic',
                            xpReward: 200,
                        });
                    }}
                />
            )}

            {/* Spawn Tutorial */}
            {activeModal === 'tutorial' && (
                <SpawnTutorial
                    onClose={closeModal}
                    onSpawn={handleSpawnAgent}
                />
            )}

            {/* AI Glossary */}
            {activeModal === 'glossary' && (
                <Glossary onClose={closeModal} />
            )}

            {/* Pending Actions Panel */}
            {activeModal === 'pending' && (
                <PendingActionsPanel
                    approvals={approvals}
                    blackboardEntries={blackboardEntries}
                    agents={agents}
                    hitlLevel={hitlLevel}
                    onApprove={approve}
                    onClose={closeModal}
                    onOpenGlossary={() => setActiveModal('glossary')}
                />
            )}

            {/* Agent Task Queue */}
            {activeModal === 'taskQueue' && selectedAgent && (
                <AgentTaskQueue
                    agentId={selectedAgent.id}
                    agentName={selectedAgent.name}
                    onClose={closeModal}
                    onAddTask={async (agentId, task) => {
                        try {
                            await api.addAgentTask(agentId, task);
                            // Trigger agent tick to process the new task
                            await api.tickAgent(agentId);
                        } catch (e) {
                            console.error('Failed to add task:', e);
                        }
                    }}
                    onDeleteTask={async (agentId, taskId) => {
                        try {
                            await api.deleteAgentTask(agentId, taskId);
                        } catch (e) {
                            console.error('Failed to delete task:', e);
                        }
                    }}
                    onPauseTask={async (agentId, taskId) => {
                        try {
                            await api.updateAgentTask(agentId, taskId, { status: 'paused' });
                        } catch (e) {
                            console.error('Failed to pause task:', e);
                        }
                    }}
                    onResumeTask={async (agentId, taskId) => {
                        try {
                            await api.updateAgentTask(agentId, taskId, { status: 'pending' });
                            // Trigger tick to process
                            await api.tickAgent(agentId);
                        } catch (e) {
                            console.error('Failed to resume task:', e);
                        }
                    }}
                />
            )}

            {/* Spawn Wizard - Aria's step-by-step agent creation */}
            {activeModal === 'spawnWizard' && (
                <SpawnWizard
                    onClose={closeModal}
                    allAgents={agents}
                    onSpawn={async (config: SpawnConfig) => {
                        try {
                            await api.spawnAgent({
                                name: config.name,
                                type: config.type,
                                tier: config.tier,
                            });
                            await refresh();
                            setShowAchievement({
                                id: 'agent-spawned',
                                title: 'Agent Created',
                                description: `${config.name} has joined the team!`,
                                icon: '🤖',
                                rarity: 'common',
                                xpReward: 25,
                            });
                        } catch (e) {
                            console.error('Failed to spawn agent:', e);
                        }
                    }}
                />
            )}

            {/* Insights Panel - App Intelligence */}
            {activeModal === 'insights' && (
                <InsightsPanel
                    agents={agents}
                    onClose={closeModal}
                    onApplyInsight={(insightId, action) => {
                        console.log('Applying insight:', insightId, action);
                        if (action === 'spawn-sitter') {
                            setActiveModal('spawnWizard');
                        } else if (action === 'spawn-worker') {
                            setActiveModal('spawnWizard');
                        }
                    }}
                    onDismissInsight={(insightId) => {
                        console.log('Dismissed insight:', insightId);
                    }}
                />
            )}

            {/* Reassign Agent Modal */}
            {activeModal === 'reassign' && selectedAgent && (
                <ReassignAgentModal
                    agent={selectedAgent}
                    allAgents={agents}
                    onClose={closeModal}
                    onReassign={async (agentId, updates) => {
                        console.log('Reassigning agent:', agentId, updates);
                        // TODO: Call API to reassign agent
                        setShowAchievement({
                            id: 'agent-reassigned',
                            title: 'Agent Reassigned',
                            description: `${selectedAgent.name} has been reassigned`,
                            icon: '🔄',
                            rarity: 'rare',
                            xpReward: 50,
                        });
                    }}
                />
            )}

            {/* Artifacts View */}
            {activeModal === 'artifacts' && (
                <ArtifactsView onClose={closeModal} />
            )}

            {/* Achievement Toast */}
            {showAchievement && (
                <AchievementToast
                    achievement={showAchievement}
                    onClose={() => setShowAchievement(null)}
                />
            )}

            {/* Genesis Protocol (agent-guided onboarding for first-time users) */}
            {showGenesis && (
                <GenesisProtocol
                    onComplete={() => setShowGenesis(false)}
                />
            )}

            {/* Help Panel (slide-in sidebar) */}
            <HelpPanel
                isOpen={showHelpPanel}
                onClose={() => setShowHelpPanel(false)}
                onRestartTour={() => {
                    resetGenesis();
                    setShowGenesis(true);
                }}
            />
        </div>
    );
}

// Google OAuth Client ID from environment variable
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

// Main App wrapper with GoogleOAuthProvider, GameUXProvider and ToastProvider
function App() {
    // Show warning if no client ID configured
    if (!GOOGLE_CLIENT_ID) {
        console.warn('VITE_GOOGLE_CLIENT_ID not configured. Google Sign-In will not work.');
    }

    return (
        <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
            <ToastProvider maxToasts={5} defaultDuration={5000}>
                <GameUXProvider>
                    <AppContent />
                </GameUXProvider>
            </ToastProvider>
        </GoogleOAuthProvider>
    );
}

export default App;
