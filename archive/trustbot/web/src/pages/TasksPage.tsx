/**
 * Tasks Page - Task Board with active tasks table
 */
import { useState, useCallback } from 'react';
import { TaskBoard } from '../components/TaskBoard';
import { workflowApi } from '../api';
import { HumanAuthModal } from '../components/HumanAuthModal';

// Token storage keys
const TOKEN_KEY = 'aurais_human_token';
const TOKEN_EXPIRY_KEY = 'aurais_human_token_expiry';

function getStoredToken(): string | null {
    const token = sessionStorage.getItem(TOKEN_KEY);
    const expiry = sessionStorage.getItem(TOKEN_EXPIRY_KEY);

    if (!token || !expiry) return null;

    // Check if expired
    if (new Date(expiry) < new Date()) {
        sessionStorage.removeItem(TOKEN_KEY);
        sessionStorage.removeItem(TOKEN_EXPIRY_KEY);
        return null;
    }

    return token;
}

function storeToken(tokenId: string, expiresAt?: string) {
    sessionStorage.setItem(TOKEN_KEY, tokenId);
    // Default to 1 hour if no expiry provided
    const expiry = expiresAt || new Date(Date.now() + 60 * 60 * 1000).toISOString();
    sessionStorage.setItem(TOKEN_EXPIRY_KEY, expiry);
}

export function TasksPage() {
    const [showAuthModal, setShowAuthModal] = useState(false);
    const [pendingAction, setPendingAction] = useState<{
        type: 'approve' | 'reject';
        taskId: string;
        reason?: string;
    } | null>(null);

    // Execute the pending action after authentication
    const executePendingAction = useCallback(async (tokenId: string) => {
        if (!pendingAction) return;

        try {
            if (pendingAction.type === 'approve') {
                await workflowApi.approveTask(pendingAction.taskId, true, tokenId);
            } else {
                // Use approveTask with approve=false for rejection
                // The backend handles this by calling failTask with "Rejected by human operator"
                await workflowApi.approveTask(pendingAction.taskId, false, tokenId);
            }
        } catch (error) {
            console.error(`Failed to ${pendingAction.type} task:`, error);
            throw error;
        } finally {
            setPendingAction(null);
        }
    }, [pendingAction]);

    const handleAuthenticated = async (tokenId: string) => {
        storeToken(tokenId);
        setShowAuthModal(false);

        if (pendingAction) {
            await executePendingAction(tokenId);
        }
    };

    const handleApproveTask = async (taskId: string) => {
        const token = getStoredToken();

        if (!token) {
            // Need to authenticate first
            setPendingAction({ type: 'approve', taskId });
            setShowAuthModal(true);
            return;
        }

        try {
            await workflowApi.approveTask(taskId, true, token);
        } catch (error: unknown) {
            // Token might be expired or invalid
            if ((error as Error).message?.includes('403') || (error as Error).message?.includes('unauthorized')) {
                sessionStorage.removeItem(TOKEN_KEY);
                sessionStorage.removeItem(TOKEN_EXPIRY_KEY);
                setPendingAction({ type: 'approve', taskId });
                setShowAuthModal(true);
            } else {
                throw error;
            }
        }
    };

    const handleRejectTask = async (taskId: string, reason?: string) => {
        const token = getStoredToken();

        if (!token) {
            // Need to authenticate first
            setPendingAction({ type: 'reject', taskId, reason });
            setShowAuthModal(true);
            return;
        }

        try {
            // For rejection with a custom reason, use failTask directly
            if (reason) {
                await workflowApi.failTask(taskId, reason, token);
            } else {
                // Use approveTask with approve=false for standard rejection
                await workflowApi.approveTask(taskId, false, token);
            }
        } catch (error: unknown) {
            // Token might be expired or invalid
            if ((error as Error).message?.includes('403') || (error as Error).message?.includes('unauthorized')) {
                sessionStorage.removeItem(TOKEN_KEY);
                sessionStorage.removeItem(TOKEN_EXPIRY_KEY);
                setPendingAction({ type: 'reject', taskId, reason });
                setShowAuthModal(true);
            } else {
                throw error;
            }
        }
    };

    return (
        <div className="tasks-page" style={{ height: '100%', overflow: 'hidden' }}>
            <TaskBoard
                embedded
                onApproveTask={handleApproveTask}
                onRejectTask={handleRejectTask}
            />

            {showAuthModal && (
                <HumanAuthModal
                    onAuthenticated={handleAuthenticated}
                    onClose={() => {
                        setShowAuthModal(false);
                        setPendingAction(null);
                    }}
                />
            )}
        </div>
    );
}
