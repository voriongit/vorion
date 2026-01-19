/**
 * GameUX - Video Game-Style UI Components
 *
 * Makes Aurais feel like an engaging game:
 * - Achievement notifications
 * - Level-up celebrations
 * - XP progress bars
 * - Streak counters
 * - Sound-ready animations
 */

import { useState, useEffect, createContext, useContext, useCallback } from 'react';

// ============================================================================
// Achievement System
// ============================================================================

export interface Achievement {
    id: string;
    title: string;
    description: string;
    icon: string;
    rarity: 'common' | 'rare' | 'epic' | 'legendary';
    xpReward: number;
    unlockedAt?: string;
}

const RARITY_CONFIG = {
    common: { color: '#6b7280', glow: 'none', label: 'Common' },
    rare: { color: '#3b82f6', glow: '0 0 20px rgba(59, 130, 246, 0.5)', label: 'Rare' },
    epic: { color: '#8b5cf6', glow: '0 0 25px rgba(139, 92, 246, 0.6)', label: 'Epic' },
    legendary: { color: '#f59e0b', glow: '0 0 30px rgba(245, 158, 11, 0.7)', label: 'Legendary' },
};

// Predefined achievements
export const ACHIEVEMENTS: Achievement[] = [
    { id: 'first-agent', title: 'Genesis', description: 'Created your first agent', icon: '🌟', rarity: 'common', xpReward: 50 },
    { id: 'first-approval', title: 'Guardian', description: 'Made your first HITL decision', icon: '🛡️', rarity: 'common', xpReward: 25 },
    { id: 'trust-100', title: 'Trust Builder', description: 'Agent reached 100 trust score', icon: '📈', rarity: 'common', xpReward: 50 },
    { id: 'trust-500', title: 'Reputation Master', description: 'Agent reached 500 trust score', icon: '⭐', rarity: 'rare', xpReward: 100 },
    { id: 'trust-900', title: 'Elite Status', description: 'Agent reached 900 trust score', icon: '👑', rarity: 'epic', xpReward: 250 },
    { id: 'tier-upgrade', title: 'Level Up!', description: 'An agent gained a tier', icon: '⬆️', rarity: 'rare', xpReward: 100 },
    { id: '10-tasks', title: 'Productive', description: 'Completed 10 tasks', icon: '✅', rarity: 'common', xpReward: 75 },
    { id: '100-tasks', title: 'Workhorse', description: 'Completed 100 tasks', icon: '💪', rarity: 'rare', xpReward: 200 },
    { id: 'perfect-week', title: 'Flawless', description: 'No failed tasks in a week', icon: '💎', rarity: 'epic', xpReward: 300 },
    { id: 'council-vote', title: 'Democracy', description: 'Participated in council voting', icon: '🗳️', rarity: 'rare', xpReward: 100 },
    { id: 'delegation-master', title: 'Delegation Master', description: 'Successfully delegated 50 tasks', icon: '🤝', rarity: 'epic', xpReward: 200 },
    { id: 'zero-to-hero', title: 'Zero to Hero', description: 'Agent went from T0 to T5', icon: '🦸', rarity: 'legendary', xpReward: 500 },
];

// ============================================================================
// Achievement Toast
// ============================================================================

interface AchievementToastProps {
    achievement: Achievement;
    onClose: () => void;
}

export function AchievementToast({ achievement, onClose }: AchievementToastProps) {
    const rarity = RARITY_CONFIG[achievement.rarity];

    useEffect(() => {
        const timer = setTimeout(onClose, 5000);
        return () => clearTimeout(timer);
    }, [onClose]);

    return (
        <div
            style={{
                position: 'fixed',
                top: '20px',
                right: '20px',
                zIndex: 9999,
                animation: 'achievementSlideIn 0.5s ease-out',
            }}
        >
            <div
                style={{
                    background: 'linear-gradient(135deg, var(--bg-secondary), var(--bg-card))',
                    border: `2px solid ${rarity.color}`,
                    borderRadius: '16px',
                    padding: '20px',
                    minWidth: '300px',
                    boxShadow: rarity.glow,
                    position: 'relative',
                    overflow: 'hidden',
                }}
            >
                {/* Shine animation overlay */}
                <div
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: '-100%',
                        width: '100%',
                        height: '100%',
                        background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)',
                        animation: 'shine 1.5s ease-in-out',
                    }}
                />

                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    {/* Icon with glow */}
                    <div
                        style={{
                            width: '60px',
                            height: '60px',
                            borderRadius: '50%',
                            background: `${rarity.color}20`,
                            border: `2px solid ${rarity.color}`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '2rem',
                            animation: 'iconPop 0.5s ease-out 0.2s both',
                        }}
                    >
                        {achievement.icon}
                    </div>

                    <div style={{ flex: 1 }}>
                        <div style={{
                            fontSize: '0.7rem',
                            color: rarity.color,
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: '0.1em',
                            marginBottom: '4px',
                        }}>
                            🏆 Achievement Unlocked!
                        </div>
                        <div style={{
                            fontSize: '1.1rem',
                            fontWeight: 700,
                            color: 'var(--text-primary)',
                            marginBottom: '4px',
                        }}>
                            {achievement.title}
                        </div>
                        <div style={{
                            fontSize: '0.8rem',
                            color: 'var(--text-secondary)',
                        }}>
                            {achievement.description}
                        </div>
                    </div>

                    {/* XP Reward */}
                    <div style={{
                        background: `${rarity.color}20`,
                        padding: '8px 12px',
                        borderRadius: '8px',
                        textAlign: 'center',
                    }}>
                        <div style={{
                            fontSize: '1.25rem',
                            fontWeight: 700,
                            color: rarity.color,
                        }}>
                            +{achievement.xpReward}
                        </div>
                        <div style={{
                            fontSize: '0.65rem',
                            color: 'var(--text-muted)',
                            textTransform: 'uppercase',
                        }}>
                            XP
                        </div>
                    </div>
                </div>

                {/* Close button */}
                <button
                    onClick={onClose}
                    style={{
                        position: 'absolute',
                        top: '8px',
                        right: '8px',
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        fontSize: '1rem',
                    }}
                >
                    ✕
                </button>
            </div>

            <style>{`
                @keyframes achievementSlideIn {
                    0% { transform: translateX(120%); opacity: 0; }
                    100% { transform: translateX(0); opacity: 1; }
                }
                @keyframes shine {
                    0% { left: -100%; }
                    100% { left: 200%; }
                }
                @keyframes iconPop {
                    0% { transform: scale(0); }
                    50% { transform: scale(1.2); }
                    100% { transform: scale(1); }
                }
            `}</style>
        </div>
    );
}

// ============================================================================
// Level Up Celebration
// ============================================================================

interface LevelUpProps {
    oldTier: number;
    newTier: number;
    agentName: string;
    onClose: () => void;
}

export function LevelUpCelebration({ oldTier, newTier, agentName, onClose }: LevelUpProps) {
    useEffect(() => {
        const timer = setTimeout(onClose, 4000);
        return () => clearTimeout(timer);
    }, [onClose]);

    return (
        <div
            style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.8)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 10000,
                animation: 'fadeIn 0.3s ease-out',
            }}
            onClick={onClose}
        >
            <div
                style={{
                    textAlign: 'center',
                    animation: 'levelUpPop 0.5s ease-out',
                }}
            >
                {/* Particles */}
                <div style={{
                    position: 'absolute',
                    inset: 0,
                    overflow: 'hidden',
                    pointerEvents: 'none',
                }}>
                    {[...Array(20)].map((_, i) => (
                        <div
                            key={i}
                            style={{
                                position: 'absolute',
                                left: `${Math.random() * 100}%`,
                                top: '50%',
                                width: '10px',
                                height: '10px',
                                background: ['#f59e0b', '#8b5cf6', '#3b82f6', '#10b981'][i % 4],
                                borderRadius: '50%',
                                animation: `particle${i % 4} 1.5s ease-out forwards`,
                                animationDelay: `${Math.random() * 0.3}s`,
                            }}
                        />
                    ))}
                </div>

                <div style={{
                    fontSize: '6rem',
                    marginBottom: '20px',
                    animation: 'tierBounce 0.6s ease-out',
                }}>
                    ⬆️
                </div>
                <div style={{
                    fontSize: '1rem',
                    color: 'var(--accent-gold)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.2em',
                    marginBottom: '8px',
                }}>
                    Level Up!
                </div>
                <div style={{
                    fontSize: '2rem',
                    fontWeight: 700,
                    color: 'white',
                    marginBottom: '16px',
                }}>
                    {agentName}
                </div>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '20px',
                }}>
                    <div style={{
                        fontSize: '3rem',
                        opacity: 0.5,
                    }}>
                        T{oldTier}
                    </div>
                    <div style={{
                        fontSize: '2rem',
                        color: 'var(--accent-gold)',
                    }}>
                        →
                    </div>
                    <div style={{
                        fontSize: '4rem',
                        fontWeight: 700,
                        color: 'var(--accent-gold)',
                        textShadow: '0 0 30px rgba(245, 158, 11, 0.5)',
                    }}>
                        T{newTier}
                    </div>
                </div>
            </div>

            <style>{`
                @keyframes levelUpPop {
                    0% { transform: scale(0.5); opacity: 0; }
                    50% { transform: scale(1.1); }
                    100% { transform: scale(1); opacity: 1; }
                }
                @keyframes tierBounce {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-20px); }
                }
                @keyframes particle0 { to { transform: translate(-100px, -200px) scale(0); opacity: 0; } }
                @keyframes particle1 { to { transform: translate(100px, -180px) scale(0); opacity: 0; } }
                @keyframes particle2 { to { transform: translate(-80px, -220px) scale(0); opacity: 0; } }
                @keyframes particle3 { to { transform: translate(120px, -190px) scale(0); opacity: 0; } }
            `}</style>
        </div>
    );
}

// ============================================================================
// XP Progress Bar
// ============================================================================

interface XPBarProps {
    currentXP: number;
    nextLevelXP: number;
    level: number;
    size?: 'small' | 'medium' | 'large';
}

export function XPProgressBar({ currentXP, nextLevelXP, level, size = 'medium' }: XPBarProps) {
    const progress = (currentXP / nextLevelXP) * 100;

    const sizes = {
        small: { height: 6, fontSize: 10, padding: '4px 8px' },
        medium: { height: 10, fontSize: 12, padding: '8px 12px' },
        large: { height: 14, fontSize: 14, padding: '12px 16px' },
    };

    const config = sizes[size];

    return (
        <div style={{
            background: 'var(--bg-card)',
            borderRadius: '12px',
            padding: config.padding,
            border: '1px solid var(--border-color)',
        }}>
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: '6px',
                fontSize: config.fontSize,
            }}>
                <span style={{ fontWeight: 700, color: 'var(--accent-purple)' }}>
                    Level {level}
                </span>
                <span style={{ color: 'var(--text-muted)' }}>
                    {currentXP} / {nextLevelXP} XP
                </span>
            </div>
            <div style={{
                height: config.height,
                background: 'var(--bg-secondary)',
                borderRadius: config.height / 2,
                overflow: 'hidden',
                position: 'relative',
            }}>
                <div
                    style={{
                        height: '100%',
                        width: `${progress}%`,
                        background: 'linear-gradient(90deg, var(--accent-blue), var(--accent-purple))',
                        borderRadius: config.height / 2,
                        transition: 'width 0.5s ease-out',
                        position: 'relative',
                    }}
                >
                    {/* Shimmer effect */}
                    <div
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)',
                            animation: 'shimmer 2s infinite',
                        }}
                    />
                </div>
            </div>
            <style>{`
                @keyframes shimmer {
                    0% { transform: translateX(-100%); }
                    100% { transform: translateX(100%); }
                }
            `}</style>
        </div>
    );
}

// ============================================================================
// Streak Counter
// ============================================================================

interface StreakCounterProps {
    count: number;
    type: 'daily' | 'success' | 'approval';
    isActive: boolean;
}

export function StreakCounter({ count, type, isActive }: StreakCounterProps) {
    const config = {
        daily: { icon: '🔥', label: 'Day Streak', color: '#ef4444' },
        success: { icon: '✅', label: 'Success Streak', color: '#10b981' },
        approval: { icon: '👍', label: 'Approval Streak', color: '#3b82f6' },
    }[type];

    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 14px',
            background: isActive ? `${config.color}15` : 'var(--bg-card)',
            border: `1px solid ${isActive ? config.color : 'var(--border-color)'}`,
            borderRadius: '999px',
            transition: 'all 0.3s ease',
        }}>
            <span style={{
                fontSize: '1.25rem',
                animation: isActive ? 'flame 0.5s ease-in-out infinite alternate' : 'none',
            }}>
                {config.icon}
            </span>
            <div>
                <div style={{
                    fontSize: '1.1rem',
                    fontWeight: 700,
                    color: isActive ? config.color : 'var(--text-muted)',
                    fontFamily: "'JetBrains Mono', monospace",
                }}>
                    {count}
                </div>
                <div style={{
                    fontSize: '0.6rem',
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                }}>
                    {config.label}
                </div>
            </div>
            <style>{`
                @keyframes flame {
                    0% { transform: scale(1) rotate(-5deg); }
                    100% { transform: scale(1.1) rotate(5deg); }
                }
            `}</style>
        </div>
    );
}

// ============================================================================
// Quick Action Feedback
// ============================================================================

export function ActionFeedback({
    type,
    message,
}: {
    type: 'success' | 'error' | 'info' | 'warning';
    message: string;
}) {
    const config = {
        success: { icon: '✅', color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)' },
        error: { icon: '❌', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)' },
        info: { icon: 'ℹ️', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)' },
        warning: { icon: '⚠️', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)' },
    }[type];

    return (
        <div
            style={{
                position: 'fixed',
                bottom: '100px',
                left: '50%',
                transform: 'translateX(-50%)',
                padding: '12px 24px',
                background: config.bg,
                border: `1px solid ${config.color}40`,
                borderRadius: '999px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                animation: 'feedbackPop 0.3s ease-out',
                zIndex: 9999,
            }}
        >
            <span style={{ fontSize: '1.25rem' }}>{config.icon}</span>
            <span style={{ color: config.color, fontWeight: 500 }}>{message}</span>
            <style>{`
                @keyframes feedbackPop {
                    0% { transform: translateX(-50%) translateY(20px); opacity: 0; }
                    100% { transform: translateX(-50%) translateY(0); opacity: 1; }
                }
            `}</style>
        </div>
    );
}

// ============================================================================
// Game UX Context & Provider
// ============================================================================

interface GameUXState {
    xp: number;
    level: number;
    achievements: string[];
    streak: number;
}

interface GameUXContextValue {
    state: GameUXState;
    unlockAchievement: (achievementId: string) => void;
    addXP: (amount: number) => void;
    triggerLevelUp: (oldTier: number, newTier: number, agentName: string) => void;
}

const GameUXContext = createContext<GameUXContextValue | null>(null);

export function GameUXProvider({ children }: { children: React.ReactNode }) {
    const [state, setState] = useState<GameUXState>({
        xp: 0,
        level: 1,
        achievements: [],
        streak: 0,
    });

    const [activeAchievement, setActiveAchievement] = useState<Achievement | null>(null);
    const [levelUp, setLevelUp] = useState<{ oldTier: number; newTier: number; agentName: string } | null>(null);

    const unlockAchievement = useCallback((achievementId: string) => {
        if (state.achievements.includes(achievementId)) return;

        const achievement = ACHIEVEMENTS.find(a => a.id === achievementId);
        if (!achievement) return;

        setState(prev => ({
            ...prev,
            achievements: [...prev.achievements, achievementId],
            xp: prev.xp + achievement.xpReward,
        }));

        setActiveAchievement(achievement);
    }, [state.achievements]);

    const addXP = useCallback((amount: number) => {
        setState(prev => {
            const newXP = prev.xp + amount;
            const xpForNextLevel = prev.level * 500;
            if (newXP >= xpForNextLevel) {
                return { ...prev, xp: newXP - xpForNextLevel, level: prev.level + 1 };
            }
            return { ...prev, xp: newXP };
        });
    }, []);

    const triggerLevelUp = useCallback((oldTier: number, newTier: number, agentName: string) => {
        setLevelUp({ oldTier, newTier, agentName });
    }, []);

    return (
        <GameUXContext.Provider value={{ state, unlockAchievement, addXP, triggerLevelUp }}>
            {children}

            {/* Achievement Toast */}
            {activeAchievement && (
                <AchievementToast
                    achievement={activeAchievement}
                    onClose={() => setActiveAchievement(null)}
                />
            )}

            {/* Level Up Celebration */}
            {levelUp && (
                <LevelUpCelebration
                    oldTier={levelUp.oldTier}
                    newTier={levelUp.newTier}
                    agentName={levelUp.agentName}
                    onClose={() => setLevelUp(null)}
                />
            )}
        </GameUXContext.Provider>
    );
}

export function useGameUX() {
    const context = useContext(GameUXContext);
    if (!context) {
        throw new Error('useGameUX must be used within GameUXProvider');
    }
    return context;
}

export default GameUXProvider;
