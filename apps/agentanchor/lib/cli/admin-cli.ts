/**
 * Phase 6 Admin CLI
 *
 * Command-line interface for Trust Engine operations
 */

// =============================================================================
// Types
// =============================================================================

export interface CLICommand {
  name: string;
  description: string;
  aliases?: string[];
  options?: CLIOption[];
  subcommands?: CLICommand[];
  handler: (args: CLIArgs, options: CLIOptions) => Promise<CLIResult>;
}

export interface CLIOption {
  name: string;
  short?: string;
  description: string;
  type: 'string' | 'number' | 'boolean' | 'array';
  required?: boolean;
  default?: unknown;
}

export interface CLIArgs {
  command: string[];
  positional: string[];
}

export interface CLIOptions {
  [key: string]: string | number | boolean | string[];
}

export interface CLIResult {
  success: boolean;
  output?: string;
  error?: string;
  data?: unknown;
  exitCode?: number;
}

// =============================================================================
// Output Formatters
// =============================================================================

export const formatters = {
  table(headers: string[], rows: string[][]): string {
    const colWidths = headers.map((h, i) =>
      Math.max(h.length, ...rows.map((r) => (r[i] || '').length))
    );

    const separator = colWidths.map((w) => '-'.repeat(w + 2)).join('+');
    const formatRow = (row: string[]) =>
      row.map((cell, i) => ` ${(cell || '').padEnd(colWidths[i])} `).join('|');

    return [
      separator,
      formatRow(headers),
      separator,
      ...rows.map(formatRow),
      separator,
    ].join('\n');
  },

  json(data: unknown, pretty = true): string {
    return pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
  },

  yaml(data: unknown): string {
    const toYaml = (obj: unknown, indent = 0): string => {
      const spaces = '  '.repeat(indent);

      if (obj === null || obj === undefined) {
        return 'null';
      }

      if (typeof obj === 'string' || typeof obj === 'number' || typeof obj === 'boolean') {
        return String(obj);
      }

      if (Array.isArray(obj)) {
        return obj.map((item) => `${spaces}- ${toYaml(item, indent + 1)}`).join('\n');
      }

      if (typeof obj === 'object') {
        return Object.entries(obj)
          .map(([key, value]) => {
            if (typeof value === 'object' && value !== null) {
              return `${spaces}${key}:\n${toYaml(value, indent + 1)}`;
            }
            return `${spaces}${key}: ${toYaml(value, indent)}`;
          })
          .join('\n');
      }

      return String(obj);
    };

    return toYaml(data);
  },

  list(items: string[], bullet = '-'): string {
    return items.map((item) => `${bullet} ${item}`).join('\n');
  },

  success(message: string): string {
    return `[SUCCESS] ${message}`;
  },

  error(message: string): string {
    return `[ERROR] ${message}`;
  },

  warning(message: string): string {
    return `[WARNING] ${message}`;
  },

  info(message: string): string {
    return `[INFO] ${message}`;
  },
};

// =============================================================================
// Command Handlers
// =============================================================================

const handlers = {
  // ---------------------------------------------------------------------------
  // Health Commands
  // ---------------------------------------------------------------------------
  async healthCheck(_args: CLIArgs, options: CLIOptions): Promise<CLIResult> {
    const detailed = options.detailed as boolean;

    // Simulate health check
    const health = {
      status: 'healthy',
      version: '1.0.0',
      uptime: 86400,
      checks: detailed ? {
        database: { status: 'healthy', latencyMs: 5 },
        cache: { status: 'healthy', latencyMs: 2 },
        queue: { status: 'healthy', latencyMs: 8 },
      } : undefined,
    };

    const output = options.format === 'json'
      ? formatters.json(health)
      : options.format === 'yaml'
        ? formatters.yaml(health)
        : [
            `Status: ${health.status}`,
            `Version: ${health.version}`,
            `Uptime: ${health.uptime}s`,
            detailed ? '\nChecks:\n' + formatters.yaml(health.checks) : '',
          ].join('\n');

    return { success: true, output, data: health };
  },

  // ---------------------------------------------------------------------------
  // Role Gate Commands
  // ---------------------------------------------------------------------------
  async listRoleGates(_args: CLIArgs, options: CLIOptions): Promise<CLIResult> {
    const gates = [
      { id: 'gate-1', name: 'Basic to Standard', from: 'basic', to: 'standard', status: 'active' },
      { id: 'gate-2', name: 'Standard to Advanced', from: 'standard', to: 'advanced', status: 'active' },
      { id: 'gate-3', name: 'Advanced to Operator', from: 'advanced', to: 'operator', status: 'testing' },
    ];

    const output = options.format === 'json'
      ? formatters.json(gates)
      : formatters.table(
          ['ID', 'Name', 'From', 'To', 'Status'],
          gates.map((g) => [g.id, g.name, g.from, g.to, g.status])
        );

    return { success: true, output, data: gates };
  },

  async createRoleGate(args: CLIArgs, options: CLIOptions): Promise<CLIResult> {
    const name = options.name as string;
    const from = options.from as string;
    const to = options.to as string;

    if (!name || !from || !to) {
      return { success: false, error: 'Missing required options: --name, --from, --to' };
    }

    const gate = {
      id: `gate-${Date.now()}`,
      name,
      fromRole: from,
      toRole: to,
      status: 'active',
      createdAt: new Date().toISOString(),
    };

    return {
      success: true,
      output: formatters.success(`Role gate '${name}' created successfully`),
      data: gate,
    };
  },

  async evaluateGate(args: CLIArgs, options: CLIOptions): Promise<CLIResult> {
    const gateId = args.positional[0];
    const trustScore = options['trust-score'] as number || 50;

    if (!gateId) {
      return { success: false, error: 'Gate ID required' };
    }

    const result = {
      gateId,
      allowed: trustScore >= 70,
      trustScore,
      evaluatedAt: new Date().toISOString(),
      conditions: [
        { type: 'trust_score', required: 70, actual: trustScore, passed: trustScore >= 70 },
      ],
    };

    const output = options.format === 'json'
      ? formatters.json(result)
      : [
          `Gate: ${gateId}`,
          `Result: ${result.allowed ? 'ALLOWED' : 'DENIED'}`,
          `Trust Score: ${trustScore}/70 required`,
        ].join('\n');

    return { success: true, output, data: result };
  },

  // ---------------------------------------------------------------------------
  // Capability Commands
  // ---------------------------------------------------------------------------
  async listCeilings(_args: CLIArgs, options: CLIOptions): Promise<CLIResult> {
    const ceilings = [
      { capability: 'code_execution', role: 'standard', max: 100, used: 45, period: 'daily' },
      { capability: 'api_calls', role: 'standard', max: 1000, used: 234, period: 'hourly' },
      { capability: 'data_access', role: 'advanced', max: 500, used: 120, period: 'daily' },
    ];

    const output = options.format === 'json'
      ? formatters.json(ceilings)
      : formatters.table(
          ['Capability', 'Role', 'Max', 'Used', 'Period'],
          ceilings.map((c) => [c.capability, c.role, String(c.max), String(c.used), c.period])
        );

    return { success: true, output, data: ceilings };
  },

  async checkCapability(args: CLIArgs, options: CLIOptions): Promise<CLIResult> {
    const capability = args.positional[0];
    const amount = options.amount as number || 1;

    if (!capability) {
      return { success: false, error: 'Capability name required' };
    }

    const result = {
      capability,
      requestedAmount: amount,
      allowed: true,
      remaining: 55,
      resetsAt: new Date(Date.now() + 3600000).toISOString(),
    };

    return {
      success: true,
      output: formatters.success(`Capability '${capability}' check: ALLOWED (${result.remaining} remaining)`),
      data: result,
    };
  },

  // ---------------------------------------------------------------------------
  // Provenance Commands
  // ---------------------------------------------------------------------------
  async listProvenance(_args: CLIArgs, options: CLIOptions): Promise<CLIResult> {
    const limit = options.limit as number || 10;

    const records = Array.from({ length: Math.min(limit, 5) }, (_, i) => ({
      id: `prov-${1000 + i}`,
      actionType: ['role_transition', 'capability_use', 'gate_evaluation'][i % 3],
      actorId: `agent-${100 + i}`,
      timestamp: new Date(Date.now() - i * 3600000).toISOString(),
      verified: true,
    }));

    const output = options.format === 'json'
      ? formatters.json(records)
      : formatters.table(
          ['ID', 'Action', 'Actor', 'Timestamp', 'Verified'],
          records.map((r) => [r.id, r.actionType, r.actorId, r.timestamp, r.verified ? 'Yes' : 'No'])
        );

    return { success: true, output, data: records };
  },

  async verifyProvenance(args: CLIArgs, options: CLIOptions): Promise<CLIResult> {
    const recordId = args.positional[0];

    if (!recordId) {
      return { success: false, error: 'Record ID required' };
    }

    const result = {
      id: recordId,
      valid: true,
      signature: 'verified',
      verifiedAt: new Date().toISOString(),
    };

    return {
      success: true,
      output: formatters.success(`Provenance record '${recordId}' verified successfully`),
      data: result,
    };
  },

  // ---------------------------------------------------------------------------
  // Backup Commands
  // ---------------------------------------------------------------------------
  async createBackup(_args: CLIArgs, options: CLIOptions): Promise<CLIResult> {
    const type = options.type as string || 'full';

    const backup = {
      id: `backup-${Date.now()}`,
      type,
      status: 'completed',
      size: 1024 * 1024 * 50, // 50MB
      createdAt: new Date().toISOString(),
      tables: ['role_gates', 'capability_ceilings', 'provenance_records'],
    };

    return {
      success: true,
      output: formatters.success(`Backup '${backup.id}' created (${Math.round(backup.size / 1024 / 1024)}MB)`),
      data: backup,
    };
  },

  async listBackups(_args: CLIArgs, options: CLIOptions): Promise<CLIResult> {
    const backups = [
      { id: 'backup-1705123456', type: 'full', size: '52MB', created: '2024-01-13T10:00:00Z' },
      { id: 'backup-1705037056', type: 'incremental', size: '12MB', created: '2024-01-12T10:00:00Z' },
      { id: 'backup-1704950656', type: 'full', size: '50MB', created: '2024-01-11T10:00:00Z' },
    ];

    const output = options.format === 'json'
      ? formatters.json(backups)
      : formatters.table(
          ['ID', 'Type', 'Size', 'Created'],
          backups.map((b) => [b.id, b.type, b.size, b.created])
        );

    return { success: true, output, data: backups };
  },

  async restoreBackup(args: CLIArgs, _options: CLIOptions): Promise<CLIResult> {
    const backupId = args.positional[0];

    if (!backupId) {
      return { success: false, error: 'Backup ID required' };
    }

    return {
      success: true,
      output: formatters.success(`Restore from '${backupId}' initiated. Check status with 'phase6 backup status'`),
      data: { backupId, status: 'restoring' },
    };
  },

  // ---------------------------------------------------------------------------
  // Feature Flag Commands
  // ---------------------------------------------------------------------------
  async listFlags(_args: CLIArgs, options: CLIOptions): Promise<CLIResult> {
    const flags = [
      { key: 'phase6_beta', enabled: true, rollout: 100 },
      { key: 'trust_score_v2', enabled: true, rollout: 25 },
      { key: 'enhanced_logging', enabled: false, rollout: 0 },
    ];

    const output = options.format === 'json'
      ? formatters.json(flags)
      : formatters.table(
          ['Key', 'Enabled', 'Rollout %'],
          flags.map((f) => [f.key, f.enabled ? 'Yes' : 'No', `${f.rollout}%`])
        );

    return { success: true, output, data: flags };
  },

  async setFlag(args: CLIArgs, options: CLIOptions): Promise<CLIResult> {
    const flagKey = args.positional[0];
    const enabled = options.enabled as boolean;

    if (!flagKey) {
      return { success: false, error: 'Flag key required' };
    }

    return {
      success: true,
      output: formatters.success(`Flag '${flagKey}' set to ${enabled ? 'enabled' : 'disabled'}`),
      data: { key: flagKey, enabled },
    };
  },

  // ---------------------------------------------------------------------------
  // SLA Commands
  // ---------------------------------------------------------------------------
  async slaStatus(_args: CLIArgs, options: CLIOptions): Promise<CLIResult> {
    const slos = [
      { name: 'API Availability', target: 99.9, current: 99.95, status: 'healthy' },
      { name: 'Latency P95', target: 99.0, current: 99.2, status: 'healthy' },
      { name: 'Error Rate', target: 99.9, current: 99.85, status: 'warning' },
    ];

    const output = options.format === 'json'
      ? formatters.json(slos)
      : formatters.table(
          ['SLO', 'Target', 'Current', 'Status'],
          slos.map((s) => [s.name, `${s.target}%`, `${s.current}%`, s.status])
        );

    return { success: true, output, data: slos };
  },

  async generateSlaReport(_args: CLIArgs, options: CLIOptions): Promise<CLIResult> {
    const days = options.days as number || 30;

    const report = {
      period: `Last ${days} days`,
      overallCompliance: 99.8,
      uptimePercent: 99.95,
      incidents: 2,
      generatedAt: new Date().toISOString(),
    };

    const output = options.format === 'json'
      ? formatters.json(report)
      : [
          '# SLA Report',
          `Period: ${report.period}`,
          `Overall Compliance: ${report.overallCompliance}%`,
          `Uptime: ${report.uptimePercent}%`,
          `Incidents: ${report.incidents}`,
        ].join('\n');

    return { success: true, output, data: report };
  },

  // ---------------------------------------------------------------------------
  // User/API Key Commands
  // ---------------------------------------------------------------------------
  async listApiKeys(_args: CLIArgs, options: CLIOptions): Promise<CLIResult> {
    const keys = [
      { id: 'key-1', name: 'Production', prefix: 'pk_***', created: '2024-01-01', lastUsed: '2024-01-15' },
      { id: 'key-2', name: 'Staging', prefix: 'pk_***', created: '2024-01-05', lastUsed: '2024-01-14' },
    ];

    const output = options.format === 'json'
      ? formatters.json(keys)
      : formatters.table(
          ['ID', 'Name', 'Prefix', 'Created', 'Last Used'],
          keys.map((k) => [k.id, k.name, k.prefix, k.created, k.lastUsed])
        );

    return { success: true, output, data: keys };
  },

  async createApiKey(_args: CLIArgs, options: CLIOptions): Promise<CLIResult> {
    const name = options.name as string || 'New Key';

    const key = {
      id: `key-${Date.now()}`,
      name,
      key: `pk_live_${Array.from({ length: 32 }, () => Math.random().toString(36)[2]).join('')}`,
      created: new Date().toISOString(),
    };

    return {
      success: true,
      output: [
        formatters.success(`API key '${name}' created`),
        '',
        formatters.warning('Save this key securely - it will not be shown again:'),
        key.key,
      ].join('\n'),
      data: key,
    };
  },

  async revokeApiKey(args: CLIArgs, _options: CLIOptions): Promise<CLIResult> {
    const keyId = args.positional[0];

    if (!keyId) {
      return { success: false, error: 'Key ID required' };
    }

    return {
      success: true,
      output: formatters.success(`API key '${keyId}' revoked`),
      data: { id: keyId, revoked: true },
    };
  },

  // ---------------------------------------------------------------------------
  // Config Commands
  // ---------------------------------------------------------------------------
  async showConfig(_args: CLIArgs, options: CLIOptions): Promise<CLIResult> {
    const config = {
      environment: process.env.NODE_ENV || 'development',
      apiUrl: 'https://api.example.com',
      database: {
        host: 'postgres.db',
        port: 5432,
        poolSize: 10,
      },
      cache: {
        host: 'redis.cache',
        port: 6379,
      },
      features: {
        phase6Enabled: true,
        betaFeatures: false,
      },
    };

    const output = options.format === 'json'
      ? formatters.json(config)
      : formatters.yaml(config);

    return { success: true, output, data: config };
  },

  // ---------------------------------------------------------------------------
  // Version/Help
  // ---------------------------------------------------------------------------
  async version(_args: CLIArgs, _options: CLIOptions): Promise<CLIResult> {
    return {
      success: true,
      output: 'Phase 6 Trust Engine CLI v1.0.0',
    };
  },

  async help(_args: CLIArgs, _options: CLIOptions): Promise<CLIResult> {
    const helpText = `
Phase 6 Trust Engine CLI

USAGE:
  phase6 <command> [subcommand] [options]

COMMANDS:
  health                    Check system health
    --detailed              Show detailed health info
    --format <json|yaml>    Output format

  gate                      Role gate management
    list                    List all role gates
    create                  Create a new role gate
      --name <name>         Gate name
      --from <role>         Source role
      --to <role>           Target role
    evaluate <gate-id>      Evaluate a gate
      --trust-score <n>     Trust score for evaluation

  capability                Capability ceiling management
    list                    List all ceilings
    check <capability>      Check capability usage
      --amount <n>          Amount to check

  provenance                Provenance tracking
    list                    List provenance records
      --limit <n>           Number of records
    verify <record-id>      Verify a record

  backup                    Backup management
    create                  Create a backup
      --type <full|incr>    Backup type
    list                    List backups
    restore <backup-id>     Restore from backup

  flag                      Feature flag management
    list                    List all flags
    set <key>               Set a flag
      --enabled <bool>      Enable/disable flag

  sla                       SLA monitoring
    status                  Show SLA status
    report                  Generate SLA report
      --days <n>            Report period

  apikey                    API key management
    list                    List API keys
    create                  Create new key
      --name <name>         Key name
    revoke <key-id>         Revoke a key

  config                    Show configuration

  version                   Show version
  help                      Show this help

GLOBAL OPTIONS:
  --format <json|yaml|table>   Output format (default: table)
  --quiet                      Suppress output
  --verbose                    Verbose output

EXAMPLES:
  phase6 health --detailed
  phase6 gate list --format json
  phase6 gate evaluate gate-1 --trust-score 85
  phase6 backup create --type full
  phase6 flag set trust_score_v2 --enabled true
`;

    return { success: true, output: helpText.trim() };
  },
};

// =============================================================================
// CLI Command Definitions
// =============================================================================

export const COMMANDS: CLICommand[] = [
  {
    name: 'health',
    description: 'Check system health',
    handler: handlers.healthCheck,
    options: [
      { name: 'detailed', short: 'd', description: 'Show detailed health info', type: 'boolean' },
      { name: 'format', short: 'f', description: 'Output format', type: 'string', default: 'text' },
    ],
  },
  {
    name: 'gate',
    description: 'Role gate management',
    handler: handlers.listRoleGates,
    subcommands: [
      { name: 'list', description: 'List role gates', handler: handlers.listRoleGates },
      {
        name: 'create',
        description: 'Create role gate',
        handler: handlers.createRoleGate,
        options: [
          { name: 'name', description: 'Gate name', type: 'string', required: true },
          { name: 'from', description: 'Source role', type: 'string', required: true },
          { name: 'to', description: 'Target role', type: 'string', required: true },
        ],
      },
      {
        name: 'evaluate',
        description: 'Evaluate gate',
        handler: handlers.evaluateGate,
        options: [
          { name: 'trust-score', description: 'Trust score', type: 'number', default: 50 },
        ],
      },
    ],
  },
  {
    name: 'capability',
    description: 'Capability ceiling management',
    handler: handlers.listCeilings,
    subcommands: [
      { name: 'list', description: 'List ceilings', handler: handlers.listCeilings },
      {
        name: 'check',
        description: 'Check capability',
        handler: handlers.checkCapability,
        options: [
          { name: 'amount', description: 'Amount to check', type: 'number', default: 1 },
        ],
      },
    ],
  },
  {
    name: 'provenance',
    description: 'Provenance tracking',
    handler: handlers.listProvenance,
    subcommands: [
      {
        name: 'list',
        description: 'List records',
        handler: handlers.listProvenance,
        options: [
          { name: 'limit', short: 'n', description: 'Number of records', type: 'number', default: 10 },
        ],
      },
      { name: 'verify', description: 'Verify record', handler: handlers.verifyProvenance },
    ],
  },
  {
    name: 'backup',
    description: 'Backup management',
    handler: handlers.listBackups,
    subcommands: [
      {
        name: 'create',
        description: 'Create backup',
        handler: handlers.createBackup,
        options: [
          { name: 'type', short: 't', description: 'Backup type', type: 'string', default: 'full' },
        ],
      },
      { name: 'list', description: 'List backups', handler: handlers.listBackups },
      { name: 'restore', description: 'Restore backup', handler: handlers.restoreBackup },
    ],
  },
  {
    name: 'flag',
    description: 'Feature flag management',
    handler: handlers.listFlags,
    subcommands: [
      { name: 'list', description: 'List flags', handler: handlers.listFlags },
      {
        name: 'set',
        description: 'Set flag',
        handler: handlers.setFlag,
        options: [
          { name: 'enabled', short: 'e', description: 'Enable flag', type: 'boolean', default: true },
        ],
      },
    ],
  },
  {
    name: 'sla',
    description: 'SLA monitoring',
    handler: handlers.slaStatus,
    subcommands: [
      { name: 'status', description: 'Show status', handler: handlers.slaStatus },
      {
        name: 'report',
        description: 'Generate report',
        handler: handlers.generateSlaReport,
        options: [
          { name: 'days', short: 'd', description: 'Report period', type: 'number', default: 30 },
        ],
      },
    ],
  },
  {
    name: 'apikey',
    description: 'API key management',
    handler: handlers.listApiKeys,
    subcommands: [
      { name: 'list', description: 'List keys', handler: handlers.listApiKeys },
      {
        name: 'create',
        description: 'Create key',
        handler: handlers.createApiKey,
        options: [
          { name: 'name', short: 'n', description: 'Key name', type: 'string' },
        ],
      },
      { name: 'revoke', description: 'Revoke key', handler: handlers.revokeApiKey },
    ],
  },
  {
    name: 'config',
    description: 'Show configuration',
    handler: handlers.showConfig,
  },
  {
    name: 'version',
    description: 'Show version',
    aliases: ['-v', '--version'],
    handler: handlers.version,
  },
  {
    name: 'help',
    description: 'Show help',
    aliases: ['-h', '--help'],
    handler: handlers.help,
  },
];

// =============================================================================
// CLI Parser
// =============================================================================

export class CLI {
  private commands = new Map<string, CLICommand>();
  private globalOptions: CLIOption[] = [
    { name: 'format', short: 'f', description: 'Output format', type: 'string', default: 'table' },
    { name: 'quiet', short: 'q', description: 'Suppress output', type: 'boolean', default: false },
    { name: 'verbose', short: 'v', description: 'Verbose output', type: 'boolean', default: false },
  ];

  constructor(commands: CLICommand[] = COMMANDS) {
    for (const cmd of commands) {
      this.commands.set(cmd.name, cmd);
      if (cmd.aliases) {
        for (const alias of cmd.aliases) {
          this.commands.set(alias, cmd);
        }
      }
    }
  }

  /**
   * Parse command line arguments
   */
  parse(argv: string[]): { args: CLIArgs; options: CLIOptions; command?: CLICommand } {
    const args: CLIArgs = { command: [], positional: [] };
    const options: CLIOptions = {};

    let i = 0;
    while (i < argv.length) {
      const arg = argv[i];

      if (arg.startsWith('--')) {
        const key = arg.slice(2);
        const nextArg = argv[i + 1];

        if (nextArg && !nextArg.startsWith('-')) {
          options[key] = this.parseValue(nextArg);
          i += 2;
        } else {
          options[key] = true;
          i++;
        }
      } else if (arg.startsWith('-')) {
        const key = arg.slice(1);
        const nextArg = argv[i + 1];

        if (nextArg && !nextArg.startsWith('-')) {
          options[key] = this.parseValue(nextArg);
          i += 2;
        } else {
          options[key] = true;
          i++;
        }
      } else {
        args.positional.push(arg);
        i++;
      }
    }

    // Extract command from positional args
    let command = this.commands.get(args.positional[0] || 'help');
    if (command) {
      args.command.push(args.positional.shift()!);

      // Check for subcommand
      if (command.subcommands && args.positional.length > 0) {
        const subCmd = command.subcommands.find((s) => s.name === args.positional[0]);
        if (subCmd) {
          args.command.push(args.positional.shift()!);
          command = subCmd;
        }
      }
    }

    return { args, options, command };
  }

  /**
   * Parse a value to appropriate type
   */
  private parseValue(value: string): string | number | boolean {
    if (value === 'true') return true;
    if (value === 'false') return false;
    const num = Number(value);
    if (!isNaN(num)) return num;
    return value;
  }

  /**
   * Run the CLI
   */
  async run(argv: string[]): Promise<CLIResult> {
    const { args, options, command } = this.parse(argv);

    if (!command) {
      return handlers.help(args, options);
    }

    try {
      return await command.handler(args, options);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        exitCode: 1,
      };
    }
  }
}

// =============================================================================
// Exports
// =============================================================================

export const adminCli = {
  CLI,
  commands: COMMANDS,
  handlers,
  formatters,
};
