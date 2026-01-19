/**
 * WebSocket Hub
 *
 * Epic 10: Agent Connection Layer
 * Story 10.2: WebSocket Hub
 *
 * Central WebSocket server for agent communication:
 * - Authentication via API key
 * - Ping/pong health checks
 * - Message routing
 * - Connection management
 */

import { WebSocketServer, WebSocket, RawData } from 'ws';
import { IncomingMessage, Server as HTTPServer } from 'http';
import { randomBytes } from 'crypto';
import { EventEmitter } from 'eventemitter3';
import { getAgentRegistry } from '../../services/AgentRegistry.js';
import type {
    WebSocketMessage,
    InboundMessageType,
    OutboundMessageType,
    AgentConnection,
    ConnectionStats,
    AuthResult,
    StatusUpdatePayload,
    HeartbeatPayload,
    TaskPayload,
    DecisionPayload,
    ConfigPayload,
    ErrorPayload,
} from './types.js';

// ============================================================================
// Constants
// ============================================================================

const PING_INTERVAL = 30000; // 30 seconds
const PONG_TIMEOUT = 10000; // 10 seconds
const AUTH_TIMEOUT = 5000; // 5 seconds

// ============================================================================
// Types
// ============================================================================

interface ExtendedWebSocket extends WebSocket {
    connectionId: string;
    agentId?: string;
    isAlive: boolean;
    authenticated: boolean;
    connectedAt: Date;
    lastHeartbeat: Date;
}

interface HubEvents {
    'connection': (connectionId: string, agentId: string) => void;
    'disconnection': (connectionId: string, agentId: string, reason: string) => void;
    'message': (connectionId: string, agentId: string, message: WebSocketMessage) => void;
    'status:update': (agentId: string, payload: StatusUpdatePayload) => void;
    'heartbeat': (agentId: string, payload: HeartbeatPayload) => void;
    'action:request': (agentId: string, payload: unknown) => void;
    'task:completed': (agentId: string, payload: unknown) => void;
    'error': (error: Error) => void;
}

export interface WebSocketHubConfig {
    path?: string;
    pingInterval?: number;
    pongTimeout?: number;
    authTimeout?: number;
    maxConnections?: number;
    maxConnectionsPerAgent?: number;
}

// ============================================================================
// WebSocket Hub
// ============================================================================

export class WebSocketHub extends EventEmitter<HubEvents> {
    private wss: WebSocketServer | null = null;
    private connections: Map<string, ExtendedWebSocket> = new Map();
    private agentConnections: Map<string, Set<string>> = new Map();
    private pingInterval: NodeJS.Timeout | null = null;
    private stats: ConnectionStats = {
        totalConnections: 0,
        authenticatedConnections: 0,
        messagesSent: 0,
        messagesReceived: 0,
        uptime: Date.now(),
    };

    private config: Required<WebSocketHubConfig>;

    constructor(config: WebSocketHubConfig = {}) {
        super();
        this.config = {
            path: config.path ?? '/ws',
            pingInterval: config.pingInterval ?? PING_INTERVAL,
            pongTimeout: config.pongTimeout ?? PONG_TIMEOUT,
            authTimeout: config.authTimeout ?? AUTH_TIMEOUT,
            maxConnections: config.maxConnections ?? 1000,
            maxConnectionsPerAgent: config.maxConnectionsPerAgent ?? 5,
        };
    }

    // -------------------------------------------------------------------------
    // Server Lifecycle
    // -------------------------------------------------------------------------

    /**
     * Attach WebSocket server to HTTP server
     */
    attach(server: HTTPServer): void {
        this.wss = new WebSocketServer({
            server,
            path: this.config.path,
        });

        this.wss.on('connection', (ws, req) => this.handleConnection(ws as ExtendedWebSocket, req));
        this.wss.on('error', (error) => this.emit('error', error));

        // Start ping interval
        this.startPingInterval();

        console.log(`WebSocket Hub attached at ${this.config.path}`);
    }

    /**
     * Create standalone WebSocket server
     */
    listen(port: number): void {
        this.wss = new WebSocketServer({ port, path: this.config.path });

        this.wss.on('connection', (ws, req) => this.handleConnection(ws as ExtendedWebSocket, req));
        this.wss.on('error', (error) => this.emit('error', error));

        this.startPingInterval();

        console.log(`WebSocket Hub listening on port ${port}${this.config.path}`);
    }

    /**
     * Shutdown the WebSocket server
     */
    async shutdown(): Promise<void> {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }

        // Notify all connected agents
        for (const [connectionId, ws] of this.connections) {
            this.sendMessage(ws, 'disconnecting', { reason: 'server_shutdown' });
            ws.close(1001, 'Server shutting down');
        }

        return new Promise((resolve) => {
            if (this.wss) {
                this.wss.close(() => {
                    this.connections.clear();
                    this.agentConnections.clear();
                    resolve();
                });
            } else {
                resolve();
            }
        });
    }

    // -------------------------------------------------------------------------
    // Connection Handling
    // -------------------------------------------------------------------------

    private handleConnection(ws: ExtendedWebSocket, req: IncomingMessage): void {
        // Check max connections
        if (this.connections.size >= this.config.maxConnections) {
            ws.close(1013, 'Max connections exceeded');
            return;
        }

        // Initialize connection state
        const connectionId = this.generateConnectionId();
        ws.connectionId = connectionId;
        ws.isAlive = true;
        ws.authenticated = false;
        ws.connectedAt = new Date();
        ws.lastHeartbeat = new Date();

        this.connections.set(connectionId, ws);
        this.stats.totalConnections++;

        // Set up authentication timeout
        const authTimer = setTimeout(() => {
            if (!ws.authenticated) {
                this.sendError(ws, 'AUTH_TIMEOUT', 'Authentication timeout');
                ws.close(4001, 'Authentication timeout');
            }
        }, this.config.authTimeout);

        // Attempt immediate auth from headers
        const apiKey = this.extractApiKey(req);
        if (apiKey) {
            this.authenticateConnection(ws, apiKey).then((result) => {
                clearTimeout(authTimer);
                if (!result.authenticated) {
                    this.sendError(ws, 'AUTH_FAILED', result.error || 'Authentication failed');
                    ws.close(4003, 'Authentication failed');
                }
            });
        }

        // Set up event handlers
        ws.on('message', (data) => this.handleMessage(ws, data));
        ws.on('pong', () => this.handlePong(ws));
        ws.on('close', (code, reason) => this.handleClose(ws, code, reason.toString()));
        ws.on('error', (error) => this.handleError(ws, error));
    }

    private async authenticateConnection(ws: ExtendedWebSocket, apiKey: string): Promise<AuthResult> {
        try {
            const registry = getAgentRegistry();
            const result = await registry.verifyAPIKey(apiKey);

            if (result.valid && result.agentId) {
                // Check max connections per agent
                const existingConnections = this.agentConnections.get(result.agentId);
                if (existingConnections && existingConnections.size >= this.config.maxConnectionsPerAgent) {
                    return { authenticated: false, error: 'Max connections per agent exceeded' };
                }

                // Mark as authenticated
                ws.authenticated = true;
                ws.agentId = result.agentId;

                // Track agent connection
                if (!this.agentConnections.has(result.agentId)) {
                    this.agentConnections.set(result.agentId, new Set());
                }
                this.agentConnections.get(result.agentId)!.add(ws.connectionId);

                this.stats.authenticatedConnections++;

                // Send connected message
                this.sendMessage(ws, 'connected', {
                    connectionId: ws.connectionId,
                    agentId: result.agentId,
                    permissions: result.permissions,
                });

                this.emit('connection', ws.connectionId, result.agentId);

                return { authenticated: true, agentId: result.agentId, permissions: result.permissions };
            }

            return { authenticated: false, error: 'Invalid API key' };
        } catch (error) {
            return { authenticated: false, error: 'Authentication error' };
        }
    }

    private handleMessage(ws: ExtendedWebSocket, data: RawData): void {
        try {
            const message = JSON.parse(data.toString()) as WebSocketMessage;
            this.stats.messagesReceived++;

            // Validate message structure
            if (!message.type || !message.timestamp) {
                this.sendError(ws, 'INVALID_MESSAGE', 'Missing required fields');
                return;
            }

            // Handle authentication message if not authenticated
            if (!ws.authenticated && message.type === 'ping') {
                const payload = message.payload as { apiKey?: string };
                if (payload.apiKey) {
                    this.authenticateConnection(ws, payload.apiKey);
                    return;
                }
            }

            // Require authentication for other messages
            if (!ws.authenticated) {
                this.sendError(ws, 'NOT_AUTHENTICATED', 'Authentication required');
                return;
            }

            // Route message to appropriate handler
            this.routeMessage(ws, message);

        } catch (error) {
            this.sendError(ws, 'PARSE_ERROR', 'Invalid JSON message');
        }
    }

    private routeMessage(ws: ExtendedWebSocket, message: WebSocketMessage): void {
        const { type, payload } = message;

        switch (type as OutboundMessageType) {
            case 'ping':
                this.sendMessage(ws, 'pong', { timestamp: Date.now() });
                break;

            case 'heartbeat':
                ws.lastHeartbeat = new Date();
                ws.isAlive = true;
                this.emit('heartbeat', ws.agentId!, payload as HeartbeatPayload);
                break;

            case 'status:update':
                this.emit('status:update', ws.agentId!, payload as StatusUpdatePayload);
                break;

            case 'action:request':
                this.emit('action:request', ws.agentId!, payload);
                break;

            case 'task:completed':
                this.emit('task:completed', ws.agentId!, payload);
                break;

            default:
                this.emit('message', ws.connectionId, ws.agentId!, message);
        }
    }

    private handlePong(ws: ExtendedWebSocket): void {
        ws.isAlive = true;
        ws.lastHeartbeat = new Date();
    }

    private handleClose(ws: ExtendedWebSocket, code: number, reason: string): void {
        this.cleanupConnection(ws, reason || `Code: ${code}`);
    }

    private handleError(ws: ExtendedWebSocket, error: Error): void {
        console.error(`WebSocket error for ${ws.connectionId}:`, error.message);
        this.cleanupConnection(ws, error.message);
    }

    private cleanupConnection(ws: ExtendedWebSocket, reason: string): void {
        const { connectionId, agentId, authenticated } = ws;

        // Remove from connections
        this.connections.delete(connectionId);

        // Remove from agent connections
        if (agentId) {
            const agentConns = this.agentConnections.get(agentId);
            if (agentConns) {
                agentConns.delete(connectionId);
                if (agentConns.size === 0) {
                    this.agentConnections.delete(agentId);
                }
            }
        }

        // Update stats
        if (authenticated) {
            this.stats.authenticatedConnections--;
        }

        // Emit event
        if (agentId) {
            this.emit('disconnection', connectionId, agentId, reason);
        }
    }

    // -------------------------------------------------------------------------
    // Ping/Pong Health Checks
    // -------------------------------------------------------------------------

    private startPingInterval(): void {
        this.pingInterval = setInterval(() => {
            for (const [connectionId, ws] of this.connections) {
                if (!ws.isAlive) {
                    // Connection didn't respond to last ping
                    ws.terminate();
                    this.cleanupConnection(ws, 'Ping timeout');
                    continue;
                }

                ws.isAlive = false;
                ws.ping();
            }
        }, this.config.pingInterval);
    }

    // -------------------------------------------------------------------------
    // Messaging
    // -------------------------------------------------------------------------

    /**
     * Send message to a specific connection
     */
    private sendMessage<T>(ws: ExtendedWebSocket, type: InboundMessageType, payload: T): void {
        if (ws.readyState !== WebSocket.OPEN) return;

        const message: WebSocketMessage<T> = {
            type,
            payload,
            timestamp: Date.now(),
            messageId: this.generateMessageId(),
        };

        ws.send(JSON.stringify(message));
        this.stats.messagesSent++;
    }

    /**
     * Send error message
     */
    private sendError(ws: ExtendedWebSocket, code: string, message: string): void {
        this.sendMessage(ws, 'error', { code, message } as ErrorPayload);
    }

    /**
     * Send message to a specific agent (all connections)
     */
    sendToAgent<T>(agentId: string, type: InboundMessageType, payload: T): number {
        const agentConns = this.agentConnections.get(agentId);
        if (!agentConns) return 0;

        let sent = 0;
        for (const connectionId of agentConns) {
            const ws = this.connections.get(connectionId);
            if (ws && ws.readyState === WebSocket.OPEN) {
                this.sendMessage(ws, type, payload);
                sent++;
            }
        }
        return sent;
    }

    /**
     * Broadcast to all authenticated connections
     */
    broadcast<T>(type: InboundMessageType, payload: T): number {
        let sent = 0;
        for (const [_, ws] of this.connections) {
            if (ws.authenticated && ws.readyState === WebSocket.OPEN) {
                this.sendMessage(ws, type, payload);
                sent++;
            }
        }
        return sent;
    }

    /**
     * Send task assignment to agent
     */
    assignTask(agentId: string, task: TaskPayload): boolean {
        const sent = this.sendToAgent(agentId, 'task:assigned', task);
        return sent > 0;
    }

    /**
     * Send decision request to agent
     */
    requestDecision(agentId: string, decision: DecisionPayload): boolean {
        const sent = this.sendToAgent(agentId, 'decision:required', decision);
        return sent > 0;
    }

    /**
     * Send config update to agent
     */
    updateConfig(agentId: string, config: ConfigPayload): boolean {
        const sent = this.sendToAgent(agentId, 'config:updated', config);
        return sent > 0;
    }

    // -------------------------------------------------------------------------
    // Connection Management
    // -------------------------------------------------------------------------

    /**
     * Get connection info for an agent
     */
    getAgentConnections(agentId: string): AgentConnection[] {
        const connections: AgentConnection[] = [];
        const agentConns = this.agentConnections.get(agentId);

        if (agentConns) {
            for (const connectionId of agentConns) {
                const ws = this.connections.get(connectionId);
                if (ws) {
                    connections.push({
                        id: connectionId,
                        agentId: ws.agentId!,
                        connectedAt: ws.connectedAt,
                        lastHeartbeat: ws.lastHeartbeat,
                        status: ws.authenticated ? 'authenticated' : 'connected',
                    });
                }
            }
        }

        return connections;
    }

    /**
     * Get all connected agent IDs
     */
    getConnectedAgents(): string[] {
        return Array.from(this.agentConnections.keys());
    }

    /**
     * Check if agent is connected
     */
    isAgentConnected(agentId: string): boolean {
        return this.agentConnections.has(agentId);
    }

    /**
     * Disconnect a specific agent
     */
    disconnectAgent(agentId: string, reason: string = 'Disconnected by server'): void {
        const agentConns = this.agentConnections.get(agentId);
        if (!agentConns) return;

        for (const connectionId of agentConns) {
            const ws = this.connections.get(connectionId);
            if (ws) {
                this.sendMessage(ws, 'disconnecting', { reason });
                ws.close(1000, reason);
            }
        }
    }

    /**
     * Get connection statistics
     */
    getStats(): ConnectionStats {
        return {
            ...this.stats,
            totalConnections: this.connections.size,
            authenticatedConnections: Array.from(this.connections.values())
                .filter(ws => ws.authenticated).length,
            uptime: Date.now() - this.stats.uptime,
        };
    }

    // -------------------------------------------------------------------------
    // Utilities
    // -------------------------------------------------------------------------

    private generateConnectionId(): string {
        return `conn_${randomBytes(8).toString('hex')}`;
    }

    private generateMessageId(): string {
        return `msg_${randomBytes(6).toString('hex')}`;
    }

    private extractApiKey(req: IncomingMessage): string | null {
        // Check Authorization header
        const authHeader = req.headers.authorization;
        if (authHeader?.startsWith('Bearer ')) {
            return authHeader.substring(7);
        }

        // Check query parameter
        const url = new URL(req.url || '', `http://${req.headers.host}`);
        const apiKey = url.searchParams.get('apiKey') || url.searchParams.get('api_key');
        if (apiKey) {
            return apiKey;
        }

        // Check custom header
        const customHeader = req.headers['x-api-key'];
        if (typeof customHeader === 'string') {
            return customHeader;
        }

        return null;
    }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let hubInstance: WebSocketHub | null = null;

export function getWebSocketHub(config?: WebSocketHubConfig): WebSocketHub {
    if (!hubInstance) {
        hubInstance = new WebSocketHub(config);
    }
    return hubInstance;
}

export function resetWebSocketHub(): void {
    if (hubInstance) {
        hubInstance.shutdown();
        hubInstance = null;
    }
}
