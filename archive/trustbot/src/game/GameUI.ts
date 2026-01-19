/**
 * Game UI - Terminal-based interactive interface
 * 
 * Provides board room meetings and office 1-on-1s
 * in a game-like dialogue format.
 */

import * as readline from 'readline';

// ============================================================================
// Types
// ============================================================================

interface Agent {
    id: string;
    name: string;
    icon: string;
    role: string;
}

interface DialogueLine {
    speaker: Agent;
    text: string;
    options?: string[];
}

type RoomType = 'HUB' | 'BOARDROOM' | 'OFFICE';

// ============================================================================
// Constants
// ============================================================================

const T5_AGENTS: Agent[] = [
    { id: 'executor', name: 'T5-EXECUTOR', icon: '🎖️', role: 'Supreme Commander' },
    { id: 'planner', name: 'T5-PLANNER', icon: '🧠', role: 'Strategic Architect' },
    { id: 'validator', name: 'T5-VALIDATOR', icon: '🛡️', role: 'Trust Guardian' },
    { id: 'evolver', name: 'T5-EVOLVER', icon: '🧬', role: 'Adaptive Intelligence' },
    { id: 'spawner', name: 'T5-SPAWNER', icon: '🏭', role: 'Agent Factory' },
];

const CEO: Agent = { id: 'ceo', name: 'YOU', icon: '👤', role: 'CEO (HITL)' };

// ============================================================================
// Box Drawing
// ============================================================================

function drawBox(title: string, content: string[], footer?: string[], width = 50): string {
    const lines: string[] = [];
    const innerWidth = width - 4;

    // Top border with title
    const titlePad = Math.floor((innerWidth - title.length - 2) / 2);
    lines.push(`╭${'─'.repeat(titlePad)} ${title} ${'─'.repeat(innerWidth - titlePad - title.length - 2)}╮`);

    // Content
    for (const line of content) {
        const padded = line.padEnd(innerWidth);
        lines.push(`│ ${padded.slice(0, innerWidth)} │`);
    }

    // Footer if present
    if (footer && footer.length > 0) {
        lines.push(`├${'─'.repeat(innerWidth + 2)}┤`);
        for (const line of footer) {
            const padded = line.padEnd(innerWidth);
            lines.push(`│ ${padded.slice(0, innerWidth)} │`);
        }
    }

    // Bottom border
    lines.push(`╰${'─'.repeat(innerWidth + 2)}╯`);

    return lines.join('\n');
}

function clearScreen(): void {
    console.clear();
}

function printSlow(text: string, delay = 30): Promise<void> {
    return new Promise(resolve => {
        let i = 0;
        const interval = setInterval(() => {
            process.stdout.write(text[i] ?? '');
            i++;
            if (i >= text.length) {
                clearInterval(interval);
                console.log();
                resolve();
            }
        }, delay);
    });
}

// ============================================================================
// Game State
// ============================================================================

class GameState {
    day: number = 1;
    time: string = '9:00 AM';
    currentRoom: RoomType = 'HUB';
    hitlLevel: number = 100;
    agentCount: number = 10;
    trustAvg: number = 900;
    events: string[] = [];
}

// ============================================================================
// Game UI Class
// ============================================================================

export class GameUI {
    private rl: readline.Interface;
    private state: GameState;
    private running: boolean = false;

    constructor() {
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });
        this.state = new GameState();
    }

    // -------------------------------------------------------------------------
    // Main Loop
    // -------------------------------------------------------------------------

    async start(): Promise<void> {
        this.running = true;
        clearScreen();

        await this.showIntro();

        while (this.running) {
            await this.showHub();
        }

        this.rl.close();
    }

    private async showIntro(): Promise<void> {
        console.log('\n');
        console.log(drawBox('🏢 TRUSTBOT HEADQUARTERS', [
            '',
            '   Welcome, CEO.',
            '',
            '   You are the Human-in-the-Loop (HITL) governing',
            '   the Tier 5 Aurais System.',
            '',
            '   Your 5 Supreme Orchestrators await your guidance.',
            '',
        ]));

        await this.prompt('\n  Press ENTER to begin your first day...');
        this.state.day = 1;
    }

    // -------------------------------------------------------------------------
    // Hub (Main Menu)
    // -------------------------------------------------------------------------

    private async showHub(): Promise<void> {
        clearScreen();

        console.log('\n');
        console.log(drawBox(`👤 CEO OFFICE | Day ${this.state.day}`, [
            '',
            `  📊 System Status:`,
            `     Agents: ${this.state.agentCount}  |  HITL: ${this.state.hitlLevel}%  |  Trust: ${this.state.trustAvg}`,
            '',
            '  Where would you like to go?',
            '',
        ], [
            '  [1] 🏛️ Board Room - Meet with all T5s',
            '  [2] 💬 Office Visit - 1-on-1 with an agent',
            '  [3] ⏭️ Next Day - Advance time',
            '  [4] 🚪 Exit',
        ]));

        const choice = await this.prompt('\n  > ');

        switch (choice) {
            case '1':
                await this.showBoardRoom();
                break;
            case '2':
                await this.showOfficeSelect();
                break;
            case '3':
                await this.advanceDay();
                break;
            case '4':
                this.running = false;
                console.log('\n  Goodbye, CEO. The system continues autonomously...\n');
                break;
        }
    }

    // -------------------------------------------------------------------------
    // Board Room
    // -------------------------------------------------------------------------

    private async showBoardRoom(): Promise<void> {
        clearScreen();
        this.state.currentRoom = 'BOARDROOM';

        // Show all agents
        const agentIcons = T5_AGENTS.map(a => a.icon).join(' ');

        console.log('\n');
        console.log(drawBox('🏛️ BOARD ROOM | T5 Council', [
            '',
            `  Present: ${agentIcons}`,
            '',
        ]));

        // Morning standup dialogue
        const dialogue: DialogueLine[] = [
            { speaker: T5_AGENTS[0]!, text: `Good morning, CEO. Day ${this.state.day} council is in session.` },
            { speaker: T5_AGENTS[1]!, text: `I've prepared today's strategic priorities.` },
            { speaker: T5_AGENTS[2]!, text: `All trust levels nominal. No violations detected.` },
            { speaker: T5_AGENTS[3]!, text: `I'm analyzing performance patterns from yesterday.` },
            { speaker: T5_AGENTS[4]!, text: `Ready to spawn any agents you require.` },
        ];

        for (const line of dialogue) {
            await this.showDialogue(line);
            await this.prompt('  [ENTER to continue]');
        }

        // Decision point
        clearScreen();
        console.log('\n');
        console.log(drawBox('🏛️ BOARD ROOM | Your Turn', [
            '',
            `  ${T5_AGENTS[0]!.icon} EXECUTOR: "What are your orders for today?"`,
            '',
        ], [
            '  [1] "Focus on growth" - Spawn more agents',
            '  [2] "Optimize" - Improve existing operations',
            '  [3] "Observe" - Let the system work autonomously',
            '  [4] Return to office',
        ]));

        const choice = await this.prompt('\n  > ');

        switch (choice) {
            case '1':
                await this.handleGrowthOrder();
                break;
            case '2':
                await this.handleOptimizeOrder();
                break;
            case '3':
                await this.handleObserveOrder();
                break;
            default:
                break;
        }

        this.state.currentRoom = 'HUB';
    }

    private async handleGrowthOrder(): Promise<void> {
        clearScreen();
        console.log('\n');

        const dialogue: DialogueLine[] = [
            { speaker: T5_AGENTS[4]!, text: `Understood! I'll spawn 2 new Specialists.` },
            { speaker: T5_AGENTS[2]!, text: `Validating spawn requests... Approved.` },
            { speaker: T5_AGENTS[0]!, text: `Excellent. Our workforce grows stronger.` },
        ];

        for (const line of dialogue) {
            await this.showDialogue(line);
            await this.prompt('  [ENTER]');
        }

        this.state.agentCount += 2;
        console.log(`\n  ✅ Agent count: ${this.state.agentCount - 2} → ${this.state.agentCount}`);
        await this.prompt('\n  [ENTER to continue]');
    }

    private async handleOptimizeOrder(): Promise<void> {
        clearScreen();
        console.log('\n');

        const dialogue: DialogueLine[] = [
            { speaker: T5_AGENTS[3]!, text: `Initiating capability evolution cycle...` },
            { speaker: T5_AGENTS[1]!, text: `I'll reallocate resources to high-priority tasks.` },
            { speaker: T5_AGENTS[0]!, text: `Trust levels should improve by end of day.` },
        ];

        for (const line of dialogue) {
            await this.showDialogue(line);
            await this.prompt('  [ENTER]');
        }

        this.state.trustAvg += 10;
        console.log(`\n  ✅ Average trust: ${this.state.trustAvg - 10} → ${this.state.trustAvg}`);
        await this.prompt('\n  [ENTER to continue]');
    }

    private async handleObserveOrder(): Promise<void> {
        clearScreen();
        console.log('\n');

        const dialogue: DialogueLine[] = [
            { speaker: T5_AGENTS[0]!, text: `Understood. We'll proceed autonomously.` },
            { speaker: T5_AGENTS[2]!, text: `Your trust in us is noted. HITL level adjusted.` },
        ];

        for (const line of dialogue) {
            await this.showDialogue(line);
            await this.prompt('  [ENTER]');
        }

        this.state.hitlLevel = Math.max(0, this.state.hitlLevel - 5);
        console.log(`\n  📉 HITL Level: ${this.state.hitlLevel + 5}% → ${this.state.hitlLevel}%`);
        console.log('     (Trust is being earned...)');
        await this.prompt('\n  [ENTER to continue]');
    }

    // -------------------------------------------------------------------------
    // Office Visits (1-on-1)
    // -------------------------------------------------------------------------

    private async showOfficeSelect(): Promise<void> {
        clearScreen();
        console.log('\n');

        const content = T5_AGENTS.map((a, i) => `  [${i + 1}] ${a.icon} ${a.name} - ${a.role}`);
        content.push('', '  [0] Return to your office');

        console.log(drawBox('💬 VISIT AN OFFICE', ['', '  Select an agent to meet:', '', ...content]));

        const choice = await this.prompt('\n  > ');
        const index = parseInt(choice) - 1;

        if (index >= 0 && index < T5_AGENTS.length) {
            await this.showOffice1on1(T5_AGENTS[index]!);
        }
    }

    private async showOffice1on1(agent: Agent): Promise<void> {
        clearScreen();
        this.state.currentRoom = 'OFFICE';

        console.log('\n');
        console.log(drawBox(`💬 ${agent.icon} ${agent.name}'s Office`, [
            '',
            `  You enter. ${agent.name} looks up from their work.`,
            '',
        ]));

        await this.prompt('  [ENTER]');

        // Agent-specific dialogue
        const greetings: Record<string, string> = {
            executor: `"CEO, good to see you. How can I serve the mission?"`,
            planner: `"Ah, perfect timing. I was just reviewing our strategy."`,
            validator: `"Trust metrics are looking healthy. Any concerns?"`,
            evolver: `"I've discovered some interesting patterns. Want to see?"`,
            spawner: `"The factory is running smoothly. Need more agents?"`,
        };

        clearScreen();
        console.log('\n');
        console.log(drawBox(`💬 1-on-1: ${agent.icon} ${agent.name}`, [
            '',
            `  ${agent.icon}: ${greetings[agent.id] ?? '"Hello, CEO."'}`,
            '',
        ], [
            '  [1] Ask about their work',
            '  [2] Give feedback',
            '  [3] Just checking in',
            '  [4] Leave',
        ]));

        const choice = await this.prompt('\n  > ');

        if (choice === '1' || choice === '2' || choice === '3') {
            await this.handleOfficeChat(agent, choice);
        }

        this.state.currentRoom = 'HUB';
    }

    private async handleOfficeChat(agent: Agent, choice: string): Promise<void> {
        clearScreen();
        console.log('\n');

        const responses: Record<string, string[]> = {
            executor: [
                `"We're executing on all priorities. The team is aligned."`,
                `"I appreciate the guidance. We won't let you down."`,
            ],
            planner: [
                `"Currently decomposing our Q1 objectives into tasks."`,
                `"I'm considering a Matrix org structure for flexibility."`,
            ],
            validator: [
                `"Zero violations this week. Trust inheritance working well."`,
                `"I've added 2 agents to the watch list, but nothing serious."`,
            ],
            evolver: [
                `"The genetic algorithm evolved 3 new capabilities yesterday."`,
                `"I see potential in cross-domain collaboration patterns."`,
            ],
            spawner: [
                `"We've spawned 5 agents this week. All productive."`,
                `"I can create specialists for any domain you need."`,
            ],
        };

        const agentResponses = responses[agent.id] ?? [`"Thank you for stopping by."`];
        const response = agentResponses[Math.floor(Math.random() * agentResponses.length)];

        console.log(drawBox(`💬 ${agent.icon} ${agent.name}`, [
            '',
            `  ${agent.icon}: ${response}`,
            '',
            `  The conversation was productive.`,
            '',
        ]));

        await this.prompt('  [ENTER to leave]');
    }

    // -------------------------------------------------------------------------
    // Day Advancement
    // -------------------------------------------------------------------------

    private async advanceDay(): Promise<void> {
        clearScreen();
        console.log('\n');

        // Simulate day passing
        const events = [
            '📊 T5-PLANNER completed strategic review',
            '🏭 T5-SPAWNER created 1 new Listener',
            '🧬 T5-EVOLVER discovered efficiency pattern',
            '✅ All scheduled tasks completed',
        ];

        const dayEvents = events.slice(0, Math.floor(Math.random() * 3) + 1);

        console.log(drawBox(`🌙 END OF DAY ${this.state.day}`, [
            '',
            '  Today\'s Events:',
            ...dayEvents.map(e => `    ${e}`),
            '',
            `  Trust Average: ${this.state.trustAvg}`,
            `  Agent Count: ${this.state.agentCount}`,
            '',
        ]));

        await this.prompt('  [ENTER to begin next day]');

        this.state.day++;
        this.state.trustAvg += Math.floor(Math.random() * 5);
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    private async showDialogue(line: DialogueLine): Promise<void> {
        clearScreen();
        console.log('\n');
        console.log(drawBox(`${line.speaker.icon} ${line.speaker.name}`, [
            '',
            `  "${line.text}"`,
            '',
        ]));
    }

    private prompt(question: string): Promise<string> {
        return new Promise(resolve => {
            this.rl.question(question, answer => {
                resolve(answer.trim());
            });
        });
    }
}
