import type { NextApiRequest, NextApiResponse } from 'next'

interface ClassifiedIntent {
    intent: string;
    confidence: number;
    agent: string;
    command: string;
    isHighRisk: boolean;
    reasoning: string;
}

// Simplified intent classification (mirrors herald/classifier.ts logic)
// In production, this would call the actual Herald interpreter
const INTENT_PATTERNS: Array<{
    intent: string;
    patterns: RegExp[];
    keywords: string[];
    agent: string;
    command: string;
    riskIndicators?: string[];
}> = [
    {
        intent: 'social.plan',
        patterns: [/\b(content|social|marketing)\s*(plan|roadmap|calendar)/i, /\b(plan|create)\s*(content|post)\s*(plan|calendar)?/i],
        keywords: ['roadmap', 'content plan', 'content calendar', 'social strategy'],
        agent: 'envoy',
        command: 'npx envoy plan',
    },
    {
        intent: 'social.draft',
        patterns: [/\b(draft|write|create)\s*(a\s+)?(post|tweet|update)/i, /\bsocial\s+media/i],
        keywords: ['draft', 'tweet', 'post', 'social media', 'linkedin', 'twitter'],
        agent: 'envoy',
        command: 'npx envoy draft',
    },
    {
        intent: 'code.fix',
        patterns: [/\b(fix|repair|resolve)\s*(the\s+)?(code|errors?|types?|bugs?)/i, /\btypescript\s+(errors?|fix)/i],
        keywords: ['fix', 'repair', 'typescript error', 'compilation', 'type error', 'bug'],
        agent: 'ts-fixer',
        command: 'npx ts-fix run --no-fix',
        riskIndicators: ['delete', 'remove', 'dangerous', 'risky', 'force', 'all files'],
    },
    {
        intent: 'code.audit',
        patterns: [/\baudit\s*(the\s+)?(code|codebase)?/i, /\b(policy|compliance|security)\s+(check|audit)/i],
        keywords: ['audit', 'compliance', 'policy', 'security check', 'governance'],
        agent: 'sentinel',
        command: 'npx sentinel audit',
    },
    {
        intent: 'docs.map',
        patterns: [/\b(map|diagram|visualize)\s*(the\s+)?(architecture|system)/i, /\b(generate|create)\s*(the\s+)?(docs?|documentation)/i],
        keywords: ['map', 'diagram', 'architecture', 'documentation', 'structure'],
        agent: 'scribe',
        command: 'npx scribe map',
    },
    {
        intent: 'docs.index',
        patterns: [/\b(index|catalog|archive)\s*(the\s+)?(docs?|files?)?/i, /\bre-?index/i],
        keywords: ['index', 'catalog', 'archive', 're-index', 'knowledge base'],
        agent: 'librarian',
        command: 'npx librarian index',
    },
    {
        intent: 'hygiene.scan',
        patterns: [/\b(clean|organize|tidy)\s*(up\s+)?(the\s+)?(workspace|repo)?/i, /\bgit\s+(clean|hygiene)/i],
        keywords: ['clean', 'organize', 'hygiene', 'tidy', 'git clean', 'workspace'],
        agent: 'curator',
        command: 'npx curator scan .',
    },
    {
        intent: 'status.check',
        patterns: [/\b(check|show|get)\s*(the\s+)?(status|health|vitals?)/i, /\b(system|backend)\s+(status|health)/i],
        keywords: ['status', 'health', 'monitor', 'vitals', 'check', 'backend', 'systems'],
        agent: 'watchman',
        command: 'npx watchman monitor',
    },
];

function classifyIntent(input: string): ClassifiedIntent {
    const inputLower = input.toLowerCase();
    let bestMatch: ClassifiedIntent = {
        intent: 'unknown',
        confidence: 0,
        agent: 'herald',
        command: '',
        isHighRisk: false,
        reasoning: 'No matching intent patterns found',
    };

    for (const pattern of INTENT_PATTERNS) {
        let score = 0;

        // Check regex patterns
        for (const regex of pattern.patterns) {
            if (regex.test(inputLower)) {
                score += 0.4;
                break;
            }
        }

        // Check keywords
        let keywordMatches = 0;
        for (const keyword of pattern.keywords) {
            if (inputLower.includes(keyword.toLowerCase())) {
                keywordMatches++;
            }
        }
        if (keywordMatches > 0) {
            score += Math.min(0.4, keywordMatches * 0.15);
        }

        // Check for risk indicators
        let isHighRisk = false;
        if (pattern.riskIndicators) {
            isHighRisk = pattern.riskIndicators.some(r => inputLower.includes(r));
        }

        if (score > bestMatch.confidence) {
            const matchedKeywords = pattern.keywords
                .filter(k => inputLower.includes(k.toLowerCase()))
                .slice(0, 3);

            bestMatch = {
                intent: pattern.intent,
                confidence: Math.min(0.95, score),
                agent: pattern.agent,
                command: pattern.command,
                isHighRisk,
                reasoning: matchedKeywords.length > 0
                    ? `Matched: ${matchedKeywords.join(', ')}`
                    : `Pattern match for ${pattern.intent}`,
            };
        }
    }

    return bestMatch;
}

function getTopMatches(input: string, n = 3): ClassifiedIntent[] {
    const inputLower = input.toLowerCase();
    const scores: Array<{ pattern: typeof INTENT_PATTERNS[0]; score: number }> = [];

    for (const pattern of INTENT_PATTERNS) {
        let score = 0;

        for (const regex of pattern.patterns) {
            if (regex.test(inputLower)) {
                score += 0.4;
                break;
            }
        }

        let keywordMatches = 0;
        for (const keyword of pattern.keywords) {
            if (inputLower.includes(keyword.toLowerCase())) {
                keywordMatches++;
            }
        }
        if (keywordMatches > 0) {
            score += Math.min(0.4, keywordMatches * 0.15);
        }

        if (score > 0.1) {
            scores.push({ pattern, score });
        }
    }

    scores.sort((a, b) => b.score - a.score);

    return scores.slice(0, n).map(({ pattern, score }) => ({
        intent: pattern.intent,
        confidence: Math.min(0.95, score),
        agent: pattern.agent,
        command: pattern.command,
        isHighRisk: pattern.riskIndicators?.some(r => inputLower.includes(r)) || false,
        reasoning: `Score: ${(score * 100).toFixed(0)}%`,
    }));
}

export default function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (req.method === 'POST') {
        const { prompt } = req.body;

        if (!prompt || typeof prompt !== 'string') {
            return res.status(400).json({ error: 'Prompt is required' });
        }

        if (prompt.length < 3) {
            return res.status(200).json({
                primary: null,
                alternatives: [],
            });
        }

        const primary = classifyIntent(prompt);
        const alternatives = getTopMatches(prompt, 3);

        res.status(200).json({
            primary,
            alternatives,
        });

    } else {
        res.setHeader('Allow', ['POST']);
        res.status(405).end(`Method ${req.method} Not Allowed`);
    }
}
