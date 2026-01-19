/**
 * OverrideRationale Component
 *
 * Story 3.3: HITL Override with Rationale
 * FRs: FR21
 *
 * Provides a form for HITL operators to override Bot Tribunal decisions
 * with documented rationale. Includes validation for minimum rationale length.
 */

import { memo, useState, useCallback } from 'react';
import type { OverrideRecord, TribunalVoteType } from '../../../types';

// ============================================================================
// Constants
// ============================================================================

export const MIN_RATIONALE_LENGTH = 50;
export const MAX_RATIONALE_LENGTH = 2000;

// ============================================================================
// Helper Functions (exported for testing)
// ============================================================================

export function getOverrideActionLabel(
    _currentRecommendation: TribunalVoteType,
    overrideType: 'approve' | 'deny'
): string {
    return `Override to ${overrideType === 'approve' ? 'Approve' : 'Deny'}`;
}

export function getCharacterCountColor(length: number): string {
    if (length < MIN_RATIONALE_LENGTH) {
        return '#ef4444'; // red - below minimum
    }
    if (length > MAX_RATIONALE_LENGTH * 0.9) {
        return '#f59e0b'; // warning - approaching max
    }
    return '#10b981'; // green - valid
}

export function validateRationale(rationale: string): { valid: boolean; error?: string } {
    const trimmed = rationale.trim();

    if (!trimmed) {
        return { valid: false, error: 'Rationale is required for tribunal override' };
    }

    if (trimmed.length < MIN_RATIONALE_LENGTH) {
        return {
            valid: false,
            error: `Rationale must be at least ${MIN_RATIONALE_LENGTH} characters (${trimmed.length}/${MIN_RATIONALE_LENGTH})`,
        };
    }

    if (trimmed.length > MAX_RATIONALE_LENGTH) {
        return {
            valid: false,
            error: `Rationale must not exceed ${MAX_RATIONALE_LENGTH} characters`,
        };
    }

    return { valid: true };
}

// ============================================================================
// Sub-Components
// ============================================================================

interface OverrideButtonProps {
    type: 'approve' | 'deny';
    selected: boolean;
    disabled: boolean;
    onClick: () => void;
}

const OverrideButton = memo(function OverrideButton({
    type,
    selected,
    disabled,
    onClick,
}: OverrideButtonProps) {
    const isApprove = type === 'approve';

    return (
        <button
            type="button"
            className={`override-rationale__type-btn ${selected ? 'override-rationale__type-btn--selected' : ''} ${isApprove ? 'override-rationale__type-btn--approve' : 'override-rationale__type-btn--deny'}`}
            onClick={onClick}
            disabled={disabled}
            aria-pressed={selected}
            aria-label={`Override to ${isApprove ? 'approve' : 'deny'}`}
        >
            <span className="override-rationale__type-icon" aria-hidden="true">
                {isApprove ? '✓' : '✗'}
            </span>
            <span className="override-rationale__type-label">
                {isApprove ? 'Approve' : 'Deny'}
            </span>
        </button>
    );
});

// ============================================================================
// Main Component
// ============================================================================

export interface OverrideRationaleProps {
    decisionId: string;
    tribunalRecommendation: TribunalVoteType;
    onSubmit: (overrideType: 'approve' | 'deny', rationale: string) => Promise<void>;
    onCancel?: () => void;
    existingOverride?: OverrideRecord;
    isSubmitting?: boolean;
    className?: string;
}

export const OverrideRationale = memo(function OverrideRationale({
    decisionId: _decisionId,
    tribunalRecommendation,
    onSubmit,
    onCancel,
    existingOverride,
    isSubmitting = false,
    className = '',
}: OverrideRationaleProps) {
    // Determine default override type (opposite of tribunal recommendation)
    const defaultOverrideType = tribunalRecommendation === 'approve' ? 'deny' : 'approve';

    const [overrideType, setOverrideType] = useState<'approve' | 'deny'>(
        existingOverride?.overrideType || defaultOverrideType
    );
    const [rationale, setRationale] = useState(existingOverride?.rationale || '');
    const [error, setError] = useState<string | null>(null);
    const [touched, setTouched] = useState(false);

    const validation = validateRationale(rationale);
    const characterCount = rationale.trim().length;
    const characterCountColor = getCharacterCountColor(characterCount);

    const handleRationaleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setRationale(e.target.value);
        setError(null);
    }, []);

    const handleRationaleBlur = useCallback(() => {
        setTouched(true);
    }, []);

    const handleSubmit = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        setTouched(true);

        const validationResult = validateRationale(rationale);
        if (!validationResult.valid) {
            setError(validationResult.error || 'Invalid rationale');
            return;
        }

        try {
            await onSubmit(overrideType, rationale.trim());
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to submit override');
        }
    }, [rationale, overrideType, onSubmit]);

    // If already overridden, show read-only view
    if (existingOverride) {
        return (
            <section
                className={`override-rationale override-rationale--readonly ${className}`}
                aria-label="Override Record"
            >
                <header className="override-rationale__header">
                    <h3 className="override-rationale__title">
                        <span className="override-rationale__title-icon" aria-hidden="true">⚖️</span>
                        Tribunal Override
                    </h3>
                    <span className="override-rationale__badge override-rationale__badge--overridden">
                        Overridden
                    </span>
                </header>

                <div className="override-rationale__summary">
                    <div className="override-rationale__summary-row">
                        <span className="override-rationale__summary-label">Original Recommendation:</span>
                        <span className={`override-rationale__summary-value override-rationale__summary-value--${existingOverride.originalRecommendation}`}>
                            {existingOverride.originalRecommendation.charAt(0).toUpperCase() + existingOverride.originalRecommendation.slice(1)}
                        </span>
                    </div>
                    <div className="override-rationale__summary-row">
                        <span className="override-rationale__summary-label">Override Decision:</span>
                        <span className={`override-rationale__summary-value override-rationale__summary-value--${existingOverride.overrideType}`}>
                            {existingOverride.overrideType.charAt(0).toUpperCase() + existingOverride.overrideType.slice(1)}
                        </span>
                    </div>
                    <div className="override-rationale__summary-row">
                        <span className="override-rationale__summary-label">Overridden By:</span>
                        <span className="override-rationale__summary-value">
                            {existingOverride.overriddenByName}
                        </span>
                    </div>
                </div>

                <div className="override-rationale__rationale-display">
                    <h4 className="override-rationale__rationale-label">Rationale:</h4>
                    <p className="override-rationale__rationale-text" aria-label="Override rationale">
                        {existingOverride.rationale}
                    </p>
                </div>

                <footer className="override-rationale__footer">
                    <span className="override-rationale__timestamp">
                        Overridden: {new Date(existingOverride.overriddenAt).toLocaleString()}
                    </span>
                </footer>
            </section>
        );
    }

    return (
        <section
            className={`override-rationale ${className}`}
            aria-label="Override Tribunal Decision"
        >
            <header className="override-rationale__header">
                <h3 className="override-rationale__title">
                    <span className="override-rationale__title-icon" aria-hidden="true">⚖️</span>
                    Override Tribunal Decision
                </h3>
            </header>

            <div className="override-rationale__warning" role="alert">
                <span className="override-rationale__warning-icon" aria-hidden="true">⚠️</span>
                <p className="override-rationale__warning-text">
                    The Bot Tribunal recommended <strong>{tribunalRecommendation}</strong> for this action.
                    Overriding requires detailed justification for audit compliance.
                </p>
            </div>

            <form onSubmit={handleSubmit} className="override-rationale__form">
                {/* Override Type Selection */}
                <div className="override-rationale__type-section">
                    <label className="override-rationale__label">
                        Override Action:
                    </label>
                    <div className="override-rationale__type-buttons" role="group" aria-label="Override type">
                        <OverrideButton
                            type="approve"
                            selected={overrideType === 'approve'}
                            disabled={isSubmitting || tribunalRecommendation === 'approve'}
                            onClick={() => setOverrideType('approve')}
                        />
                        <OverrideButton
                            type="deny"
                            selected={overrideType === 'deny'}
                            disabled={isSubmitting || tribunalRecommendation === 'deny'}
                            onClick={() => setOverrideType('deny')}
                        />
                    </div>
                    {tribunalRecommendation !== 'abstain' && (
                        <p className="override-rationale__type-hint">
                            Cannot override to same recommendation as tribunal
                        </p>
                    )}
                </div>

                {/* Rationale Textarea */}
                <div className="override-rationale__rationale-section">
                    <label htmlFor="override-rationale-input" className="override-rationale__label">
                        Rationale <span className="override-rationale__required">*</span>
                    </label>
                    <textarea
                        id="override-rationale-input"
                        className={`override-rationale__textarea ${touched && !validation.valid ? 'override-rationale__textarea--error' : ''}`}
                        value={rationale}
                        onChange={handleRationaleChange}
                        onBlur={handleRationaleBlur}
                        placeholder="Provide detailed justification for overriding the tribunal's recommendation..."
                        disabled={isSubmitting}
                        rows={5}
                        maxLength={MAX_RATIONALE_LENGTH}
                        aria-describedby="rationale-hint rationale-error"
                        aria-invalid={touched && !validation.valid}
                        required
                    />
                    <div className="override-rationale__textarea-footer">
                        <span id="rationale-hint" className="override-rationale__hint">
                            Minimum {MIN_RATIONALE_LENGTH} characters required
                        </span>
                        <span
                            className="override-rationale__char-count"
                            style={{ color: characterCountColor }}
                            aria-label={`${characterCount} of ${MAX_RATIONALE_LENGTH} characters`}
                        >
                            {characterCount}/{MAX_RATIONALE_LENGTH}
                        </span>
                    </div>
                    {touched && !validation.valid && (
                        <p id="rationale-error" className="override-rationale__error" role="alert">
                            {validation.error}
                        </p>
                    )}
                    {error && (
                        <p className="override-rationale__error override-rationale__error--submit" role="alert">
                            {error}
                        </p>
                    )}
                </div>

                {/* Action Buttons */}
                <div className="override-rationale__actions">
                    {onCancel && (
                        <button
                            type="button"
                            className="override-rationale__btn override-rationale__btn--cancel"
                            onClick={onCancel}
                            disabled={isSubmitting}
                        >
                            Cancel
                        </button>
                    )}
                    <button
                        type="submit"
                        className={`override-rationale__btn override-rationale__btn--submit override-rationale__btn--${overrideType}`}
                        disabled={isSubmitting || !validation.valid}
                        aria-busy={isSubmitting}
                    >
                        {isSubmitting ? 'Submitting...' : `Override to ${overrideType === 'approve' ? 'Approve' : 'Deny'}`}
                    </button>
                </div>
            </form>
        </section>
    );
});

// ============================================================================
// Styles
// ============================================================================

const styles = `
.override-rationale {
    background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
    border: 1px solid #334155;
    border-radius: 12px;
    padding: 20px;
    color: #e2e8f0;
}

.override-rationale--readonly {
    background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
}

.override-rationale__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
    padding-bottom: 12px;
    border-bottom: 1px solid #334155;
}

.override-rationale__title {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    font-size: 1.125rem;
    font-weight: 600;
    color: #f8fafc;
}

.override-rationale__title-icon {
    font-size: 1.25rem;
}

.override-rationale__badge {
    font-size: 0.75rem;
    font-weight: 600;
    padding: 4px 10px;
    border-radius: 9999px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
}

.override-rationale__badge--overridden {
    background: rgba(245, 158, 11, 0.2);
    color: #f59e0b;
    border: 1px solid rgba(245, 158, 11, 0.3);
}

.override-rationale__warning {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    background: rgba(245, 158, 11, 0.1);
    border: 1px solid rgba(245, 158, 11, 0.3);
    border-radius: 8px;
    padding: 12px 16px;
    margin-bottom: 20px;
}

.override-rationale__warning-icon {
    font-size: 1.25rem;
    flex-shrink: 0;
}

.override-rationale__warning-text {
    margin: 0;
    font-size: 0.9375rem;
    color: #fbbf24;
    line-height: 1.5;
}

.override-rationale__warning-text strong {
    text-transform: uppercase;
}

.override-rationale__form {
    display: flex;
    flex-direction: column;
    gap: 20px;
}

.override-rationale__label {
    display: block;
    font-size: 0.875rem;
    font-weight: 500;
    color: #94a3b8;
    margin-bottom: 8px;
}

.override-rationale__required {
    color: #ef4444;
}

.override-rationale__type-section {
    margin-bottom: 4px;
}

.override-rationale__type-buttons {
    display: flex;
    gap: 12px;
}

.override-rationale__type-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 12px 16px;
    border: 2px solid #334155;
    border-radius: 8px;
    background: #0f172a;
    color: #94a3b8;
    font-size: 1rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
}

.override-rationale__type-btn:hover:not(:disabled) {
    border-color: #475569;
    color: #e2e8f0;
}

.override-rationale__type-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.override-rationale__type-btn--selected.override-rationale__type-btn--approve {
    border-color: #10b981;
    background: rgba(16, 185, 129, 0.1);
    color: #10b981;
}

.override-rationale__type-btn--selected.override-rationale__type-btn--deny {
    border-color: #ef4444;
    background: rgba(239, 68, 68, 0.1);
    color: #ef4444;
}

.override-rationale__type-icon {
    font-size: 1.25rem;
}

.override-rationale__type-hint {
    margin: 8px 0 0;
    font-size: 0.8125rem;
    color: #64748b;
}

.override-rationale__rationale-section {
    display: flex;
    flex-direction: column;
}

.override-rationale__textarea {
    width: 100%;
    padding: 12px 16px;
    border: 1px solid #334155;
    border-radius: 8px;
    background: #0f172a;
    color: #e2e8f0;
    font-size: 0.9375rem;
    font-family: inherit;
    line-height: 1.5;
    resize: vertical;
    min-height: 120px;
    transition: border-color 0.2s;
}

.override-rationale__textarea:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.override-rationale__textarea--error {
    border-color: #ef4444;
}

.override-rationale__textarea--error:focus {
    border-color: #ef4444;
    box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
}

.override-rationale__textarea::placeholder {
    color: #64748b;
}

.override-rationale__textarea-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 8px;
}

.override-rationale__hint {
    font-size: 0.8125rem;
    color: #64748b;
}

.override-rationale__char-count {
    font-size: 0.8125rem;
    font-weight: 500;
}

.override-rationale__error {
    margin: 8px 0 0;
    font-size: 0.875rem;
    color: #ef4444;
}

.override-rationale__error--submit {
    margin-top: 0;
    padding: 8px 12px;
    background: rgba(239, 68, 68, 0.1);
    border-radius: 4px;
}

.override-rationale__actions {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    padding-top: 16px;
    border-top: 1px solid #334155;
}

.override-rationale__btn {
    padding: 10px 20px;
    border: none;
    border-radius: 6px;
    font-size: 0.9375rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
}

.override-rationale__btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.override-rationale__btn--cancel {
    background: #334155;
    color: #e2e8f0;
}

.override-rationale__btn--cancel:hover:not(:disabled) {
    background: #475569;
}

.override-rationale__btn--submit {
    color: white;
}

.override-rationale__btn--submit.override-rationale__btn--approve {
    background: #10b981;
}

.override-rationale__btn--submit.override-rationale__btn--approve:hover:not(:disabled) {
    background: #059669;
}

.override-rationale__btn--submit.override-rationale__btn--deny {
    background: #ef4444;
}

.override-rationale__btn--submit.override-rationale__btn--deny:hover:not(:disabled) {
    background: #dc2626;
}

/* Read-only styles */
.override-rationale__summary {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 16px;
}

.override-rationale__summary-row {
    display: flex;
    align-items: center;
    gap: 12px;
}

.override-rationale__summary-label {
    font-size: 0.875rem;
    color: #64748b;
    min-width: 160px;
}

.override-rationale__summary-value {
    font-size: 0.9375rem;
    font-weight: 500;
}

.override-rationale__summary-value--approve {
    color: #10b981;
}

.override-rationale__summary-value--deny {
    color: #ef4444;
}

.override-rationale__summary-value--abstain {
    color: #6b7280;
}

.override-rationale__rationale-display {
    background: #0f172a;
    border-radius: 8px;
    padding: 16px;
    margin-bottom: 16px;
}

.override-rationale__rationale-label {
    margin: 0 0 8px;
    font-size: 0.875rem;
    font-weight: 500;
    color: #94a3b8;
}

.override-rationale__rationale-text {
    margin: 0;
    font-size: 0.9375rem;
    color: #e2e8f0;
    line-height: 1.6;
    white-space: pre-wrap;
}

.override-rationale__footer {
    display: flex;
    justify-content: flex-end;
}

.override-rationale__timestamp {
    font-size: 0.8125rem;
    color: #64748b;
}
`;

// Inject styles
if (typeof document !== 'undefined') {
    const styleId = 'override-rationale-styles';
    if (!document.getElementById(styleId)) {
        const styleElement = document.createElement('style');
        styleElement.id = styleId;
        styleElement.textContent = styles;
        document.head.appendChild(styleElement);
    }
}

export default OverrideRationale;
