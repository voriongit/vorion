/**
 * OverrideRationale Component Tests
 *
 * Story 3.3: HITL Override with Rationale
 * FRs: FR21
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import {
    OverrideRationale,
    MIN_RATIONALE_LENGTH,
    MAX_RATIONALE_LENGTH,
    getOverrideActionLabel,
    getCharacterCountColor,
    validateRationale,
} from './OverrideRationale';
import type { OverrideRecord } from '../../../types';

// ============================================================================
// Test Data
// ============================================================================

const mockExistingOverride: OverrideRecord = {
    id: 'override-001',
    decisionId: 'ar-005',
    tribunalId: 'trib-003',
    overriddenBy: 'user-123',
    overriddenByName: 'John Operator',
    overrideType: 'approve',
    originalRecommendation: 'deny',
    rationale: 'After careful review of the agent error logs and consulting with the technical team, the error state was caused by a transient network issue that has been resolved. The agent can safely proceed with the data correction.',
    overriddenAt: '2025-12-23T12:00:00Z',
};

const validRationale = 'This is a valid rationale that meets the minimum character requirement for tribunal override documentation.';
const shortRationale = 'Too short';

// ============================================================================
// Helper Function Tests
// ============================================================================

describe('getOverrideActionLabel', () => {
    it('returns correct label for approve override', () => {
        expect(getOverrideActionLabel('deny', 'approve')).toBe('Override to Approve');
    });

    it('returns correct label for deny override', () => {
        expect(getOverrideActionLabel('approve', 'deny')).toBe('Override to Deny');
    });
});

describe('getCharacterCountColor', () => {
    it('returns red when below minimum', () => {
        expect(getCharacterCountColor(10)).toContain('ef4444');
    });

    it('returns green when valid', () => {
        expect(getCharacterCountColor(100)).toContain('10b981');
    });

    it('returns warning when approaching max', () => {
        expect(getCharacterCountColor(MAX_RATIONALE_LENGTH * 0.95)).toContain('f59e0b');
    });
});

describe('validateRationale', () => {
    it('returns invalid for empty string', () => {
        const result = validateRationale('');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('required');
    });

    it('returns invalid for whitespace only', () => {
        const result = validateRationale('   ');
        expect(result.valid).toBe(false);
    });

    it('returns invalid when below minimum length', () => {
        const result = validateRationale(shortRationale);
        expect(result.valid).toBe(false);
        expect(result.error).toContain(`${MIN_RATIONALE_LENGTH}`);
    });

    it('returns valid for sufficient length', () => {
        const result = validateRationale(validRationale);
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
    });

    it('returns invalid when exceeding max length', () => {
        const longRationale = 'a'.repeat(MAX_RATIONALE_LENGTH + 1);
        const result = validateRationale(longRationale);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('exceed');
    });
});

// ============================================================================
// Component Tests
// ============================================================================

describe('OverrideRationale', () => {
    const defaultProps = {
        decisionId: 'ar-005',
        tribunalRecommendation: 'deny' as const,
        onSubmit: vi.fn().mockResolvedValue(undefined),
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    // ========================================================================
    // Basic Rendering
    // ========================================================================

    describe('Basic Rendering', () => {
        it('renders override form', () => {
            render(<OverrideRationale {...defaultProps} />);

            expect(screen.getByRole('region', { name: 'Override Tribunal Decision' })).toBeInTheDocument();
        });

        it('displays title', () => {
            render(<OverrideRationale {...defaultProps} />);

            expect(screen.getByText('Override Tribunal Decision')).toBeInTheDocument();
        });

        it('renders with custom className', () => {
            const { container } = render(
                <OverrideRationale {...defaultProps} className="custom-class" />
            );

            expect(container.querySelector('.override-rationale')).toHaveClass('custom-class');
        });

        it('shows warning about tribunal recommendation', () => {
            render(<OverrideRationale {...defaultProps} />);

            // Use class selector to find the warning specifically
            expect(screen.getByText(/The Bot Tribunal recommended/)).toHaveTextContent(/deny/i);
        });
    });

    // ========================================================================
    // Override Type Selection
    // ========================================================================

    describe('Override Type Selection', () => {
        it('shows approve and deny buttons', () => {
            render(<OverrideRationale {...defaultProps} />);

            expect(screen.getByLabelText('Override to approve')).toBeInTheDocument();
            expect(screen.getByLabelText('Override to deny')).toBeInTheDocument();
        });

        it('pre-selects opposite of tribunal recommendation', () => {
            render(<OverrideRationale {...defaultProps} tribunalRecommendation="deny" />);

            expect(screen.getByLabelText('Override to approve')).toHaveAttribute('aria-pressed', 'true');
        });

        it('disables button matching tribunal recommendation', () => {
            render(<OverrideRationale {...defaultProps} tribunalRecommendation="deny" />);

            expect(screen.getByLabelText('Override to deny')).toBeDisabled();
        });

        it('allows switching override type', async () => {
            render(<OverrideRationale {...defaultProps} tribunalRecommendation="abstain" />);

            const denyButton = screen.getByLabelText('Override to deny');
            fireEvent.click(denyButton);

            expect(denyButton).toHaveAttribute('aria-pressed', 'true');
        });
    });

    // ========================================================================
    // Rationale Input
    // ========================================================================

    describe('Rationale Input', () => {
        it('displays textarea for rationale', () => {
            render(<OverrideRationale {...defaultProps} />);

            expect(screen.getByLabelText(/Rationale/)).toBeInTheDocument();
        });

        it('shows character count', () => {
            render(<OverrideRationale {...defaultProps} />);

            expect(screen.getByLabelText(/0 of \d+ characters/)).toBeInTheDocument();
        });

        it('updates character count on input', () => {
            render(<OverrideRationale {...defaultProps} />);

            const textarea = screen.getByLabelText(/Rationale/);
            fireEvent.change(textarea, { target: { value: 'Test input' } });

            expect(screen.getByLabelText(/10 of \d+ characters/)).toBeInTheDocument();
        });

        it('shows minimum length hint', () => {
            render(<OverrideRationale {...defaultProps} />);

            expect(screen.getByText(/Minimum \d+ characters required/)).toBeInTheDocument();
        });
    });

    // ========================================================================
    // Validation
    // ========================================================================

    describe('Validation', () => {
        it('shows error when rationale too short on blur', () => {
            render(<OverrideRationale {...defaultProps} />);

            const textarea = screen.getByLabelText(/Rationale/);
            fireEvent.change(textarea, { target: { value: shortRationale } });
            fireEvent.blur(textarea);

            // Get error element specifically by ID
            expect(screen.getByText(/Rationale must be at least/)).toBeInTheDocument();
        });

        it('clears error when rationale becomes valid', () => {
            render(<OverrideRationale {...defaultProps} />);

            const textarea = screen.getByLabelText(/Rationale/);
            fireEvent.change(textarea, { target: { value: shortRationale } });
            fireEvent.blur(textarea);

            // Should show validation error
            expect(screen.getByText(/Rationale must be at least/)).toBeInTheDocument();

            // Type more to make it valid
            fireEvent.change(textarea, { target: { value: validRationale } });

            // Error should be gone from validation (form error clears on change)
            expect(textarea).toHaveAttribute('aria-invalid', 'false');
        });

        it('disables submit button when rationale invalid', () => {
            const { container } = render(<OverrideRationale {...defaultProps} />);

            // Target submit button specifically via type="submit"
            const submitButton = container.querySelector('button[type="submit"]');
            expect(submitButton).toBeDisabled();
        });

        it('enables submit button when rationale valid', () => {
            const { container } = render(<OverrideRationale {...defaultProps} />);

            const textarea = screen.getByLabelText(/Rationale/);
            fireEvent.change(textarea, { target: { value: validRationale } });

            // Target submit button specifically via type="submit"
            const submitButton = container.querySelector('button[type="submit"]');
            expect(submitButton).not.toBeDisabled();
        });
    });

    // ========================================================================
    // Form Submission
    // ========================================================================

    describe('Form Submission', () => {
        it('calls onSubmit with correct values', async () => {
            const onSubmit = vi.fn().mockResolvedValue(undefined);
            const { container } = render(<OverrideRationale {...defaultProps} onSubmit={onSubmit} />);

            const textarea = screen.getByLabelText(/Rationale/);
            fireEvent.change(textarea, { target: { value: validRationale } });

            // Target submit button specifically via type="submit"
            const submitButton = container.querySelector('button[type="submit"]') as HTMLButtonElement;
            fireEvent.click(submitButton);

            await waitFor(() => {
                expect(onSubmit).toHaveBeenCalledWith('approve', validRationale);
            });
        });

        it('shows submitting state', () => {
            render(<OverrideRationale {...defaultProps} isSubmitting={true} />);

            const textarea = screen.getByLabelText(/Rationale/);
            expect(textarea).toBeDisabled();

            expect(screen.getByText('Submitting...')).toBeInTheDocument();
        });

        it('shows error on submission failure', async () => {
            const error = new Error('Network error');
            const onSubmit = vi.fn().mockRejectedValue(error);
            const { container } = render(<OverrideRationale {...defaultProps} onSubmit={onSubmit} />);

            const textarea = screen.getByLabelText(/Rationale/);
            fireEvent.change(textarea, { target: { value: validRationale } });

            // Target submit button specifically via type="submit"
            const submitButton = container.querySelector('button[type="submit"]') as HTMLButtonElement;
            fireEvent.click(submitButton);

            await waitFor(() => {
                expect(screen.getByText('Network error')).toBeInTheDocument();
            });
        });
    });

    // ========================================================================
    // Cancel Button
    // ========================================================================

    describe('Cancel Button', () => {
        it('shows cancel button when onCancel provided', () => {
            render(<OverrideRationale {...defaultProps} onCancel={() => {}} />);

            expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
        });

        it('hides cancel button when onCancel not provided', () => {
            render(<OverrideRationale {...defaultProps} />);

            expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
        });

        it('calls onCancel when clicked', () => {
            const onCancel = vi.fn();
            render(<OverrideRationale {...defaultProps} onCancel={onCancel} />);

            fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

            expect(onCancel).toHaveBeenCalled();
        });
    });

    // ========================================================================
    // Read-Only Mode (Existing Override)
    // ========================================================================

    describe('Read-Only Mode', () => {
        it('shows read-only view when existingOverride provided', () => {
            render(<OverrideRationale {...defaultProps} existingOverride={mockExistingOverride} />);

            expect(screen.getByRole('region', { name: 'Override Record' })).toBeInTheDocument();
        });

        it('displays overridden badge', () => {
            render(<OverrideRationale {...defaultProps} existingOverride={mockExistingOverride} />);

            expect(screen.getByText('Overridden')).toBeInTheDocument();
        });

        it('shows original recommendation', () => {
            render(<OverrideRationale {...defaultProps} existingOverride={mockExistingOverride} />);

            expect(screen.getByText('Original Recommendation:')).toBeInTheDocument();
            expect(screen.getByText('Deny')).toBeInTheDocument();
        });

        it('shows override decision', () => {
            render(<OverrideRationale {...defaultProps} existingOverride={mockExistingOverride} />);

            expect(screen.getByText('Override Decision:')).toBeInTheDocument();
            expect(screen.getByText('Approve')).toBeInTheDocument();
        });

        it('shows overridden by name', () => {
            render(<OverrideRationale {...defaultProps} existingOverride={mockExistingOverride} />);

            expect(screen.getByText('John Operator')).toBeInTheDocument();
        });

        it('displays rationale text', () => {
            render(<OverrideRationale {...defaultProps} existingOverride={mockExistingOverride} />);

            expect(screen.getByLabelText('Override rationale')).toHaveTextContent(/error state was caused/);
        });

        it('shows override timestamp', () => {
            render(<OverrideRationale {...defaultProps} existingOverride={mockExistingOverride} />);

            expect(screen.getByText(/Overridden:/)).toBeInTheDocument();
        });

        it('does not show form elements', () => {
            render(<OverrideRationale {...defaultProps} existingOverride={mockExistingOverride} />);

            expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
            expect(screen.queryByRole('button', { name: /Override to/i })).not.toBeInTheDocument();
        });
    });

    // ========================================================================
    // Accessibility
    // ========================================================================

    describe('Accessibility', () => {
        it('has accessible region label', () => {
            render(<OverrideRationale {...defaultProps} />);

            expect(screen.getByRole('region', { name: 'Override Tribunal Decision' })).toBeInTheDocument();
        });

        it('textarea has aria-describedby', () => {
            render(<OverrideRationale {...defaultProps} />);

            const textarea = screen.getByLabelText(/Rationale/);
            expect(textarea).toHaveAttribute('aria-describedby');
        });

        it('shows aria-invalid when validation fails', () => {
            render(<OverrideRationale {...defaultProps} />);

            const textarea = screen.getByLabelText(/Rationale/);
            fireEvent.change(textarea, { target: { value: shortRationale } });
            fireEvent.blur(textarea);

            expect(textarea).toHaveAttribute('aria-invalid', 'true');
        });

        it('type buttons have aria-pressed', () => {
            render(<OverrideRationale {...defaultProps} />);

            const approveButton = screen.getByLabelText('Override to approve');
            expect(approveButton).toHaveAttribute('aria-pressed');
        });

        it('submit button shows aria-busy when submitting', () => {
            render(<OverrideRationale {...defaultProps} isSubmitting={true} />);

            const submitButton = screen.getByRole('button', { name: /Submitting/i });
            expect(submitButton).toHaveAttribute('aria-busy', 'true');
        });
    });
});
