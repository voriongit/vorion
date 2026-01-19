/**
 * HelpPanel Component
 *
 * Epic 8: Onboarding & Education
 * Story 8.5: On-Demand Trust Explanations (FR50)
 * Story 8.6: Urgency Rule Configuration (FR54)
 */

import { memo, useState } from 'react';
import type {
    TrustExplanation,
    HelpPanelContent,
    UrgencyRule,
    UrgencyRuleConfig,
} from '../../../types';

// ============================================================================
// Helper Functions
// ============================================================================

export function getUrgencyColor(level: string): string {
    const colors: Record<string, string> = {
        low: '#10b981',
        medium: '#f59e0b',
        high: '#f97316',
        immediate: '#ef4444',
    };
    return colors[level] || '#6b7280';
}

// ============================================================================
// Sub-Components
// ============================================================================

interface ExplanationCardProps {
    explanation: TrustExplanation;
    expanded?: boolean;
    onToggle: () => void;
    onTopicClick?: (topic: string) => void;
}

export const ExplanationCard = memo(function ExplanationCard({
    explanation,
    expanded = false,
    onToggle,
    onTopicClick,
}: ExplanationCardProps) {
    return (
        <article className="help__explanation" aria-label={`Explanation: ${explanation.title}`}>
            <button className="help__explanation-header" onClick={onToggle}>
                <h4 className="help__explanation-title">{explanation.title}</h4>
                <span className="help__explanation-toggle">{expanded ? '−' : '+'}</span>
            </button>
            <p className="help__explanation-summary">{explanation.summary}</p>
            {expanded && (
                <div className="help__explanation-details">
                    <p>{explanation.details}</p>
                    {explanation.examples && explanation.examples.length > 0 && (
                        <div className="help__explanation-examples">
                            <h5>Examples:</h5>
                            {explanation.examples.map((ex, i) => (
                                <div key={i} className="help__explanation-example">
                                    <span className="help__example-scenario">{ex.scenario}</span>
                                    <span className="help__example-explain">{ex.explanation}</span>
                                </div>
                            ))}
                        </div>
                    )}
                    {explanation.relatedTopics.length > 0 && (
                        <div className="help__explanation-related">
                            <span>Related:</span>
                            {explanation.relatedTopics.map((topic) => (
                                <button
                                    key={topic}
                                    className="help__related-topic"
                                    onClick={() => onTopicClick?.(topic)}
                                >
                                    {topic.replace('-', ' ')}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </article>
    );
});

interface FAQItemProps {
    question: string;
    answer: string;
}

export const FAQItem = memo(function FAQItem({ question, answer }: FAQItemProps) {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="help__faq-item">
            <button className="help__faq-question" onClick={() => setIsOpen(!isOpen)}>
                <span>{question}</span>
                <span className="help__faq-toggle">{isOpen ? '−' : '+'}</span>
            </button>
            {isOpen && <p className="help__faq-answer">{answer}</p>}
        </div>
    );
});

interface UrgencyRuleCardProps {
    rule: UrgencyRule;
    onToggle?: (id: string, enabled: boolean) => void;
    onEdit?: (id: string) => void;
}

export const UrgencyRuleCard = memo(function UrgencyRuleCard({
    rule,
    onToggle,
    onEdit,
}: UrgencyRuleCardProps) {
    return (
        <div className="help__urgency-rule" aria-label={`Rule: ${rule.name}`}>
            <div className="help__urgency-rule-header">
                <label className="help__urgency-rule-toggle">
                    <input
                        type="checkbox"
                        checked={rule.enabled}
                        onChange={(e) => onToggle?.(rule.id, e.target.checked)}
                    />
                    <span className="help__toggle-slider" />
                </label>
                <div className="help__urgency-rule-info">
                    <span className="help__urgency-rule-name">{rule.name}</span>
                    <span className="help__urgency-rule-desc">{rule.description}</span>
                </div>
                <span
                    className="help__urgency-level"
                    style={{ backgroundColor: getUrgencyColor(rule.urgencyLevel) }}
                >
                    {rule.urgencyLevel}
                </span>
            </div>
            <div className="help__urgency-rule-condition">
                <code>
                    {rule.condition.field} {rule.condition.operator.replace('_', ' ')} {rule.condition.value}
                </code>
            </div>
            {onEdit && (
                <button className="help__urgency-edit" onClick={() => onEdit(rule.id)}>
                    Edit
                </button>
            )}
        </div>
    );
});

// ============================================================================
// Main Components
// ============================================================================

export interface HelpPanelProps {
    content: HelpPanelContent;
    isOpen: boolean;
    onClose: () => void;
    onTopicClick?: (topic: string) => void;
    className?: string;
}

export const HelpPanel = memo(function HelpPanel({
    content,
    isOpen,
    onClose,
    onTopicClick,
    className = '',
}: HelpPanelProps) {
    const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set());

    const toggleTopic = (topic: string) => {
        setExpandedTopics((prev) => {
            const next = new Set(prev);
            if (next.has(topic)) {
                next.delete(topic);
            } else {
                next.add(topic);
            }
            return next;
        });
    };

    if (!isOpen) return null;

    return (
        <aside className={`help__panel ${className}`} aria-label="Help Panel">
            <div className="help__panel-header">
                <h3>Help & Explanations</h3>
                <button className="help__panel-close" onClick={onClose} aria-label="Close help panel">
                    &times;
                </button>
            </div>

            <div className="help__panel-content">
                <section className="help__section">
                    <h4>Trust System</h4>
                    {content.explanations.map((exp) => (
                        <ExplanationCard
                            key={exp.topic}
                            explanation={exp}
                            expanded={expandedTopics.has(exp.topic)}
                            onToggle={() => toggleTopic(exp.topic)}
                            onTopicClick={onTopicClick}
                        />
                    ))}
                </section>

                {content.faqs.length > 0 && (
                    <section className="help__section">
                        <h4>Frequently Asked Questions</h4>
                        {content.faqs.map((faq, i) => (
                            <FAQItem key={i} question={faq.question} answer={faq.answer} />
                        ))}
                    </section>
                )}
            </div>
        </aside>
    );
});

export interface UrgencyConfigPanelProps {
    config: UrgencyRuleConfig;
    onRuleToggle?: (id: string, enabled: boolean) => void;
    onRuleEdit?: (id: string) => void;
    onDefaultChange?: (level: UrgencyRuleConfig['defaultUrgency']) => void;
    className?: string;
}

export const UrgencyConfigPanel = memo(function UrgencyConfigPanel({
    config,
    onRuleToggle,
    onRuleEdit,
    onDefaultChange,
    className = '',
}: UrgencyConfigPanelProps) {
    return (
        <div className={`help__urgency-config ${className}`} aria-label="Urgency Configuration">
            <div className="help__urgency-header">
                <h3>Urgency Rules</h3>
                <div className="help__urgency-default">
                    <label>Default Urgency:</label>
                    <select
                        value={config.defaultUrgency}
                        onChange={(e) => onDefaultChange?.(e.target.value as UrgencyRuleConfig['defaultUrgency'])}
                    >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                    </select>
                </div>
            </div>

            <div className="help__urgency-timeouts">
                <h4>Escalation Timeouts</h4>
                <div className="help__urgency-timeout-list">
                    <div className="help__urgency-timeout">
                        <span style={{ color: getUrgencyColor('low') }}>Low:</span>
                        <span>{Math.round(config.escalationTimeouts.low / 60000)} min</span>
                    </div>
                    <div className="help__urgency-timeout">
                        <span style={{ color: getUrgencyColor('medium') }}>Medium:</span>
                        <span>{Math.round(config.escalationTimeouts.medium / 60000)} min</span>
                    </div>
                    <div className="help__urgency-timeout">
                        <span style={{ color: getUrgencyColor('high') }}>High:</span>
                        <span>{Math.round(config.escalationTimeouts.high / 60000)} min</span>
                    </div>
                </div>
            </div>

            <div className="help__urgency-rules-list">
                <h4>Active Rules</h4>
                {config.rules.map((rule) => (
                    <UrgencyRuleCard
                        key={rule.id}
                        rule={rule}
                        onToggle={onRuleToggle}
                        onEdit={onRuleEdit}
                    />
                ))}
            </div>
        </div>
    );
});

// ============================================================================
// Styles
// ============================================================================

const styles = `
.help__panel {
    position: fixed;
    top: 0;
    right: 0;
    width: 400px;
    height: 100vh;
    background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
    border-left: 1px solid #334155;
    box-shadow: -8px 0 32px rgba(0, 0, 0, 0.3);
    z-index: 9000;
    display: flex;
    flex-direction: column;
    color: #e2e8f0;
}

.help__panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px;
    border-bottom: 1px solid #334155;
}

.help__panel-header h3 {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 600;
    color: #f8fafc;
}

.help__panel-close {
    background: none;
    border: none;
    font-size: 1.5rem;
    color: #64748b;
    cursor: pointer;
}

.help__panel-content {
    flex: 1;
    overflow-y: auto;
    padding: 20px;
}

.help__section {
    margin-bottom: 24px;
}

.help__section h4 {
    margin: 0 0 12px;
    font-size: 0.875rem;
    font-weight: 600;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.05em;
}

.help__explanation {
    margin-bottom: 12px;
    padding: 12px;
    background: #0f172a;
    border: 1px solid #334155;
    border-radius: 8px;
}

.help__explanation-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    text-align: left;
}

.help__explanation-title {
    margin: 0;
    font-size: 0.9375rem;
    font-weight: 600;
    color: #f8fafc;
}

.help__explanation-toggle {
    font-size: 1.25rem;
    color: #64748b;
}

.help__explanation-summary {
    margin: 8px 0 0;
    font-size: 0.8125rem;
    color: #64748b;
}

.help__explanation-details {
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid #334155;
}

.help__explanation-details p {
    margin: 0 0 12px;
    font-size: 0.875rem;
    color: #94a3b8;
    line-height: 1.5;
}

.help__explanation-examples {
    margin-bottom: 12px;
}

.help__explanation-examples h5 {
    margin: 0 0 8px;
    font-size: 0.8125rem;
    color: #64748b;
}

.help__explanation-example {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 8px;
    background: #1e293b;
    border-radius: 4px;
    margin-bottom: 8px;
}

.help__example-scenario {
    font-size: 0.8125rem;
    font-weight: 500;
    color: #f8fafc;
}

.help__example-explain {
    font-size: 0.75rem;
    color: #64748b;
}

.help__explanation-related {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
}

.help__explanation-related span {
    font-size: 0.75rem;
    color: #64748b;
}

.help__related-topic {
    padding: 4px 8px;
    background: #334155;
    border: none;
    border-radius: 4px;
    font-size: 0.75rem;
    color: #3b82f6;
    cursor: pointer;
    text-transform: capitalize;
}

.help__related-topic:hover {
    background: #3b82f6;
    color: white;
}

.help__faq-item {
    margin-bottom: 8px;
    border: 1px solid #334155;
    border-radius: 6px;
    overflow: hidden;
}

.help__faq-question {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    padding: 12px;
    background: #0f172a;
    border: none;
    cursor: pointer;
    text-align: left;
    font-size: 0.875rem;
    color: #f8fafc;
}

.help__faq-toggle {
    color: #64748b;
}

.help__faq-answer {
    margin: 0;
    padding: 12px;
    font-size: 0.8125rem;
    color: #94a3b8;
    background: #1e293b;
}

/* Urgency Config Styles */
.help__urgency-config {
    padding: 20px;
    background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
    border: 1px solid #334155;
    border-radius: 12px;
    color: #e2e8f0;
}

.help__urgency-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
}

.help__urgency-header h3 {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 600;
    color: #f8fafc;
}

.help__urgency-default {
    display: flex;
    align-items: center;
    gap: 8px;
}

.help__urgency-default label {
    font-size: 0.8125rem;
    color: #64748b;
}

.help__urgency-default select {
    padding: 6px 12px;
    background: #0f172a;
    border: 1px solid #334155;
    border-radius: 4px;
    color: #e2e8f0;
    font-size: 0.875rem;
}

.help__urgency-timeouts {
    margin-bottom: 20px;
}

.help__urgency-timeouts h4 {
    margin: 0 0 12px;
    font-size: 0.875rem;
    font-weight: 600;
    color: #94a3b8;
}

.help__urgency-timeout-list {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
}

.help__urgency-timeout {
    display: flex;
    justify-content: space-between;
    padding: 8px 12px;
    background: #0f172a;
    border-radius: 6px;
    font-size: 0.8125rem;
}

.help__urgency-rules-list h4 {
    margin: 0 0 12px;
    font-size: 0.875rem;
    font-weight: 600;
    color: #94a3b8;
}

.help__urgency-rule {
    padding: 12px;
    background: #0f172a;
    border: 1px solid #334155;
    border-radius: 8px;
    margin-bottom: 8px;
}

.help__urgency-rule-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 8px;
}

.help__urgency-rule-toggle {
    position: relative;
    width: 40px;
    height: 20px;
}

.help__urgency-rule-toggle input {
    opacity: 0;
    width: 0;
    height: 0;
}

.help__toggle-slider {
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: #334155;
    border-radius: 20px;
    transition: 0.3s;
}

.help__toggle-slider:before {
    position: absolute;
    content: "";
    height: 16px;
    width: 16px;
    left: 2px;
    bottom: 2px;
    background: white;
    border-radius: 50%;
    transition: 0.3s;
}

.help__urgency-rule-toggle input:checked + .help__toggle-slider {
    background: #3b82f6;
}

.help__urgency-rule-toggle input:checked + .help__toggle-slider:before {
    transform: translateX(20px);
}

.help__urgency-rule-info {
    flex: 1;
}

.help__urgency-rule-name {
    display: block;
    font-weight: 600;
    color: #f8fafc;
}

.help__urgency-rule-desc {
    font-size: 0.75rem;
    color: #64748b;
}

.help__urgency-level {
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 0.6875rem;
    font-weight: 600;
    color: white;
    text-transform: uppercase;
}

.help__urgency-rule-condition {
    padding: 8px;
    background: #1e293b;
    border-radius: 4px;
    margin-bottom: 8px;
}

.help__urgency-rule-condition code {
    font-size: 0.75rem;
    color: #3b82f6;
}

.help__urgency-edit {
    padding: 4px 12px;
    background: #334155;
    border: none;
    border-radius: 4px;
    color: #94a3b8;
    font-size: 0.75rem;
    cursor: pointer;
}

.help__urgency-edit:hover {
    background: #475569;
    color: #e2e8f0;
}
`;

if (typeof document !== 'undefined') {
    const styleId = 'help-panel-styles';
    if (!document.getElementById(styleId)) {
        const styleElement = document.createElement('style');
        styleElement.id = styleId;
        styleElement.textContent = styles;
        document.head.appendChild(styleElement);
    }
}

export default HelpPanel;
