import { useState, useId } from 'react';

interface FormFieldProps {
    label: string;
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    type?: 'text' | 'email' | 'password' | 'number';
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    pattern?: RegExp;
    errorMessage?: string;
    helperText?: string;
    disabled?: boolean;
    onSubmit?: () => void;
}

interface ValidationResult {
    isValid: boolean;
    message: string;
}

export function FormField({
    label,
    value,
    onChange,
    placeholder,
    type = 'text',
    required = false,
    minLength,
    maxLength,
    pattern,
    errorMessage,
    helperText,
    disabled = false,
    onSubmit,
}: FormFieldProps) {
    const id = useId();
    const errorId = `${id}-error`;
    const helperId = `${id}-helper`;

    const [touched, setTouched] = useState(false);
    const [focused, setFocused] = useState(false);

    const validate = (): ValidationResult => {
        if (required && !value.trim()) {
            return { isValid: false, message: errorMessage || `${label} is required` };
        }
        if (minLength && value.length < minLength) {
            return { isValid: false, message: `${label} must be at least ${minLength} characters` };
        }
        if (maxLength && value.length > maxLength) {
            return { isValid: false, message: `${label} must be less than ${maxLength} characters` };
        }
        if (pattern && !pattern.test(value)) {
            return { isValid: false, message: errorMessage || `${label} format is invalid` };
        }
        return { isValid: true, message: '' };
    };

    const validation = validate();
    const showError = touched && !focused && !validation.isValid;

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && onSubmit && validation.isValid) {
            onSubmit();
        }
    };

    return (
        <div style={{ marginBottom: '16px' }}>
            <label
                htmlFor={id}
                style={{
                    display: 'block',
                    marginBottom: '6px',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    color: showError ? 'var(--accent-red, #ef4444)' : 'var(--text-secondary, #9ca3af)',
                }}
            >
                {label}
                {required && <span style={{ color: 'var(--accent-red, #ef4444)', marginLeft: '4px' }}>*</span>}
            </label>

            <input
                id={id}
                type={type}
                value={value}
                onChange={e => onChange(e.target.value)}
                onBlur={() => { setTouched(true); setFocused(false); }}
                onFocus={() => setFocused(true)}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                disabled={disabled}
                aria-invalid={showError}
                aria-describedby={showError ? errorId : helperText ? helperId : undefined}
                style={{
                    width: '100%',
                    padding: '10px 12px',
                    fontSize: '0.9rem',
                    background: 'var(--bg-primary, #0a0e17)',
                    border: `2px solid ${showError ? 'var(--accent-red, #ef4444)' : focused ? 'var(--accent-blue, #3b82f6)' : 'var(--border-color, #374151)'}`,
                    borderRadius: '8px',
                    color: 'var(--text-primary, #f9fafb)',
                    outline: 'none',
                    transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
                    boxShadow: focused ? '0 0 0 3px rgba(59, 130, 246, 0.2)' : showError ? '0 0 0 3px rgba(239, 68, 68, 0.2)' : 'none',
                    opacity: disabled ? 0.5 : 1,
                    cursor: disabled ? 'not-allowed' : 'text',
                }}
            />

            {/* Error message */}
            {showError && (
                <div
                    id={errorId}
                    role="alert"
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        marginTop: '6px',
                        fontSize: '0.8rem',
                        color: 'var(--accent-red, #ef4444)',
                    }}
                >
                    <span aria-hidden="true">⚠️</span>
                    {validation.message}
                </div>
            )}

            {/* Helper text */}
            {helperText && !showError && (
                <div
                    id={helperId}
                    style={{
                        marginTop: '6px',
                        fontSize: '0.75rem',
                        color: 'var(--text-muted, #6b7280)',
                    }}
                >
                    {helperText}
                </div>
            )}
        </div>
    );
}

// Select variant
interface SelectFieldProps {
    label: string;
    value: string | number;
    onChange: (value: string) => void;
    options: Array<{ value: string | number; label: string; icon?: string }>;
    required?: boolean;
    disabled?: boolean;
    helperText?: string;
}

export function SelectField({
    label,
    value,
    onChange,
    options,
    required = false,
    disabled = false,
    helperText,
}: SelectFieldProps) {
    const id = useId();
    const helperId = `${id}-helper`;

    return (
        <div style={{ marginBottom: '16px' }}>
            <label
                htmlFor={id}
                style={{
                    display: 'block',
                    marginBottom: '6px',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    color: 'var(--text-secondary, #9ca3af)',
                }}
            >
                {label}
                {required && <span style={{ color: 'var(--accent-red, #ef4444)', marginLeft: '4px' }}>*</span>}
            </label>

            <select
                id={id}
                value={value}
                onChange={e => onChange(e.target.value)}
                disabled={disabled}
                aria-describedby={helperText ? helperId : undefined}
                style={{
                    width: '100%',
                    padding: '10px 12px',
                    fontSize: '0.9rem',
                    background: 'var(--bg-primary, #0a0e17)',
                    border: '2px solid var(--border-color, #374151)',
                    borderRadius: '8px',
                    color: 'var(--text-primary, #f9fafb)',
                    outline: 'none',
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    opacity: disabled ? 0.5 : 1,
                }}
            >
                {options.map(opt => (
                    <option key={opt.value} value={opt.value}>
                        {opt.icon ? `${opt.icon} ${opt.label}` : opt.label}
                    </option>
                ))}
            </select>

            {helperText && (
                <div
                    id={helperId}
                    style={{
                        marginTop: '6px',
                        fontSize: '0.75rem',
                        color: 'var(--text-muted, #6b7280)',
                    }}
                >
                    {helperText}
                </div>
            )}
        </div>
    );
}
