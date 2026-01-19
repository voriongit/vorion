import { useState, useEffect, useCallback } from 'react';

/**
 * Genesis Protocol - Agent-Guided Onboarding
 *
 * The 5 T5 founding agents guide new users through the system
 * with personality and purpose. Each agent introduces their role.
 */

interface GenesisStep {
    id: string;
    agent: {
        name: string;
        role: string;
        avatar: string;
        color: string;
    };
    messages: string[];
    highlight?: string;
}

const GENESIS_STEPS: GenesisStep[] = [
    {
        id: 'welcome',
        agent: {
            name: 'The Architect',
            role: 'PLANNER',
            avatar: 'T5',
            color: '#8b5cf6', // purple
        },
        messages: [
            "Welcome to Aurais HQ, Founder.",
            "I am The Architect. I design the grand strategies that guide our collective intelligence.",
            "You've activated the Genesis Protocol - the awakening of your autonomous agent swarm.",
            "Let me introduce you to our team and show you how we work together."
        ],
    },
    {
        id: 'trust-system',
        agent: {
            name: 'The Overseer',
            role: 'VALIDATOR',
            avatar: 'T5',
            color: '#ef4444', // red
        },
        messages: [
            "Greetings. I am The Overseer - guardian of trust and quality.",
            "Every agent starts untrusted (0 points). They earn trust by completing tasks successfully.",
            "Trust levels unlock abilities:",
            "VERIFIED (600+): Can delegate tasks to others",
            "CERTIFIED (800+): Can spawn new agents",
            "ELITE (950+): Full system access",
            "I ensure no agent rises beyond their proven capability."
        ],
        highlight: '.trust-indicator',
    },
    {
        id: 'delegation',
        agent: {
            name: 'Head of Ops',
            role: 'EXECUTOR',
            avatar: 'T5',
            color: '#3b82f6', // blue
        },
        messages: [
            "I am Head of Operations. I ensure work actually gets done.",
            "Our anti-delegation rules prevent infinite task passing:",
            "Only VERIFIED+ agents can delegate",
            "Maximum 2 delegations per task",
            "After that, the agent MUST execute - no more passing the buck.",
            "This guarantees results, not just orchestration."
        ],
    },
    {
        id: 'spawning',
        agent: {
            name: 'The Recruiter',
            role: 'SPAWNER',
            avatar: 'T5',
            color: '#f59e0b', // gold
        },
        messages: [
            "Salutations! I am The Recruiter - builder of our workforce.",
            "CERTIFIED agents (800+ trust) can spawn new workers.",
            "New agents start at lower tiers and must prove themselves.",
            "Use the Blueprint Selector to create specialized agents:",
            "Listeners monitor external systems",
            "Workers execute specific tasks",
            "Each spawn is an investment - choose wisely."
        ],
        highlight: '.floor',
    },
    {
        id: 'evolution',
        agent: {
            name: 'The Evolver',
            role: 'EVOLVER',
            avatar: 'T5',
            color: '#10b981', // green
        },
        messages: [
            "I am The Evolver. I optimize and adapt our collective intelligence.",
            "I analyze patterns across all agent activities.",
            "Successful strategies are reinforced.",
            "Failures become lessons encoded into our system.",
            "The swarm grows smarter with every task cycle."
        ],
    },
    {
        id: 'mission-control',
        agent: {
            name: 'The Architect',
            role: 'PLANNER',
            avatar: 'T5',
            color: '#8b5cf6',
        },
        messages: [
            "Finally, let me show you Mission Control - our shared intelligence hub.",
            "Here, agents post Problems, Solutions, Decisions, and Observations.",
            "You can reply to guide us. We call you 'Founder' - the human in the loop.",
            "Adjust HITL (Human-in-the-Loop) level to control how much oversight you want.",
            "100% = approve everything. 0% = full autonomy."
        ],
        highlight: '.blackboard-section',
    },
    {
        id: 'ready',
        agent: {
            name: 'All Founders',
            role: 'UNIFIED',
            avatar: 'F5',
            color: 'linear-gradient(135deg, #8b5cf6, #3b82f6, #10b981)',
        },
        messages: [
            "The Genesis Protocol is complete.",
            "Your swarm awaits your commands, Founder.",
            "Create tasks, run execution ticks, and watch us work.",
            "We are your extended intelligence. Let's build something extraordinary."
        ],
    },
];

const STORAGE_KEY = 'aurais_genesis_complete';

interface GenesisProtocolProps {
    onComplete: () => void;
    forceShow?: boolean;
}

export function GenesisProtocol({ onComplete, forceShow = false }: GenesisProtocolProps) {
    const [currentStep, setCurrentStep] = useState(0);
    const [currentMessage, setCurrentMessage] = useState(0);
    const [displayedText, setDisplayedText] = useState('');
    const [isTyping, setIsTyping] = useState(true);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const completed = localStorage.getItem(STORAGE_KEY);
        if (!completed || forceShow) {
            setVisible(true);
        }
    }, [forceShow]);

    // Typewriter effect
    useEffect(() => {
        if (!visible) return;

        const step = GENESIS_STEPS[currentStep];
        const fullMessage = step.messages[currentMessage];

        if (!fullMessage) return;

        let index = 0;
        setIsTyping(true);
        setDisplayedText('');

        const timer = setInterval(() => {
            if (index < fullMessage.length) {
                setDisplayedText(fullMessage.slice(0, index + 1));
                index++;
            } else {
                setIsTyping(false);
                clearInterval(timer);
            }
        }, 25); // Fast but readable typing speed

        return () => clearInterval(timer);
    }, [currentStep, currentMessage, visible]);

    const handleContinue = useCallback(() => {
        const step = GENESIS_STEPS[currentStep];

        if (currentMessage < step.messages.length - 1) {
            // More messages from this agent
            setCurrentMessage(currentMessage + 1);
        } else if (currentStep < GENESIS_STEPS.length - 1) {
            // Move to next agent
            setCurrentStep(currentStep + 1);
            setCurrentMessage(0);
        } else {
            // Genesis complete
            handleComplete();
        }
    }, [currentStep, currentMessage]);

    const handleSkip = () => {
        handleComplete();
    };

    const handleComplete = () => {
        localStorage.setItem(STORAGE_KEY, 'true');
        setVisible(false);
        onComplete();
    };

    // Skip typing animation on click
    const handleClick = () => {
        if (isTyping) {
            const step = GENESIS_STEPS[currentStep];
            const fullMessage = step.messages[currentMessage];
            setDisplayedText(fullMessage);
            setIsTyping(false);
        } else {
            handleContinue();
        }
    };

    if (!visible) return null;

    const step = GENESIS_STEPS[currentStep];
    const isLastStep = currentStep === GENESIS_STEPS.length - 1 &&
                       currentMessage === step.messages.length - 1;
    const totalMessages = GENESIS_STEPS.reduce((acc, s) => acc + s.messages.length, 0);
    const currentProgress = GENESIS_STEPS.slice(0, currentStep).reduce((acc, s) => acc + s.messages.length, 0) + currentMessage + 1;

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.92)',
            zIndex: 10000,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
        }}>
            {/* Skip button */}
            <button
                onClick={handleSkip}
                style={{
                    position: 'absolute',
                    top: '20px',
                    right: '20px',
                    background: 'transparent',
                    border: '1px solid rgba(255,255,255,0.2)',
                    color: 'rgba(255,255,255,0.5)',
                    padding: '8px 16px',
                    borderRadius: '6px',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                }}
            >
                Skip Genesis
            </button>

            {/* Progress bar */}
            <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '3px',
                background: 'rgba(255,255,255,0.1)',
            }}>
                <div style={{
                    height: '100%',
                    width: `${(currentProgress / totalMessages) * 100}%`,
                    background: step.agent.color,
                    transition: 'width 0.3s ease, background 0.3s ease',
                }} />
            </div>

            {/* Agent Avatar & Info */}
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                marginBottom: '24px',
            }}>
                {/* Avatar */}
                <div style={{
                    width: '100px',
                    height: '100px',
                    borderRadius: '50%',
                    background: typeof step.agent.color === 'string' && step.agent.color.includes('gradient')
                        ? step.agent.color
                        : `${step.agent.color}20`,
                    border: `3px solid ${step.agent.color.includes('gradient') ? '#8b5cf6' : step.agent.color}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '16px',
                    boxShadow: `0 0 40px ${step.agent.color.includes('gradient') ? 'rgba(139,92,246,0.4)' : step.agent.color}40`,
                    animation: 'pulse 2s ease-in-out infinite',
                }}>
                    <span style={{
                        fontSize: '2rem',
                        fontWeight: 700,
                        color: step.agent.color.includes('gradient') ? '#fff' : step.agent.color,
                    }}>
                        {step.agent.avatar}
                    </span>
                </div>

                {/* Name & Role */}
                <h2 style={{
                    margin: 0,
                    fontSize: '1.5rem',
                    color: '#fff',
                    textAlign: 'center',
                }}>
                    {step.agent.name}
                </h2>
                <span style={{
                    fontSize: '0.8rem',
                    color: step.agent.color.includes('gradient') ? '#8b5cf6' : step.agent.color,
                    textTransform: 'uppercase',
                    letterSpacing: '2px',
                    fontWeight: 600,
                }}>
                    {step.agent.role}
                </span>
            </div>

            {/* Message Box */}
            <div
                onClick={handleClick}
                style={{
                    maxWidth: '600px',
                    width: '100%',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '16px',
                    padding: '24px 32px',
                    cursor: 'pointer',
                    minHeight: '120px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                }}
            >
                <p style={{
                    margin: 0,
                    fontSize: '1.1rem',
                    color: '#fff',
                    lineHeight: 1.7,
                    textAlign: 'center',
                }}>
                    {displayedText}
                    {isTyping && (
                        <span style={{
                            animation: 'blink 0.7s infinite',
                            marginLeft: '2px',
                        }}>|</span>
                    )}
                </p>
            </div>

            {/* Hint */}
            <div style={{
                marginTop: '20px',
                fontSize: '0.8rem',
                color: 'rgba(255,255,255,0.4)',
                textAlign: 'center',
            }}>
                {isTyping ? 'Click to skip typing...' : isLastStep ? 'Click to begin...' : 'Click to continue...'}
            </div>

            {/* Agent indicators */}
            <div style={{
                position: 'absolute',
                bottom: '40px',
                display: 'flex',
                gap: '12px',
            }}>
                {GENESIS_STEPS.slice(0, -1).map((s, idx) => (
                    <div
                        key={s.id}
                        style={{
                            width: '12px',
                            height: '12px',
                            borderRadius: '50%',
                            background: idx < currentStep ? s.agent.color :
                                       idx === currentStep ? s.agent.color : 'rgba(255,255,255,0.2)',
                            opacity: idx <= currentStep ? 1 : 0.4,
                            transition: 'all 0.3s ease',
                            boxShadow: idx === currentStep ? `0 0 10px ${s.agent.color}` : 'none',
                        }}
                        title={s.agent.name}
                    />
                ))}
            </div>

            {/* CSS Animations */}
            <style>{`
                @keyframes pulse {
                    0%, 100% { transform: scale(1); }
                    50% { transform: scale(1.05); }
                }
                @keyframes blink {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0; }
                }
            `}</style>
        </div>
    );
}

// Export utilities
export function resetGenesis() {
    localStorage.removeItem(STORAGE_KEY);
}

export function isGenesisComplete(): boolean {
    return localStorage.getItem(STORAGE_KEY) === 'true';
}
