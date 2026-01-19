/**
 * WebSocket Client
 *
 * Epic 10: Agent Connection Layer
 * Story 10.2: WebSocket Hub
 *
 * Client-side WebSocket connection with:
 * - Automatic reconnection with exponential backoff
 * - Ping/pong health checks
 * - Message queuing during disconnection
 */

import WebSocket from 'ws';
import { EventEmitter } from 'eventemitter3';
import { randomBytes } from 'crypto';
import type {
    WebSocketMessage,
    InboundMessageType,
    OutboundMessageType,
    StatusUpdatePayload,
    HeartbeatPayload,
    ActionRequestPayload,
    TaskCompletedPayload,
} from './types.js';

// ============================================================================
// Types
// ============================================================================

export interface WebSocketClientConfig {
    url: string;
    apiKey: string;
    reconnect?: boolean;
    reconnectMaxRetries?: number;
    reconnectBaseDelay?: number;
    reconnectMaxDelay?: number;
    heartbeatInterval?: number;
    messageQueueSize?: number;
}

interface ClientEvents {
    'connected': () => void;
    'disconnected': (reason: string) => void;
    'reconnecting': (attempt: number, delay: number) => void;
    'message': (message: WebSocketMessage) => void;
    'task:assigned': (payload: unknown) => void;
    'decision:required': (payload: unknown) => void;
    'config:updated': (payload: unknown) => void;
    'error': (error: Error) => void;
}

type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

// ============================================================================
// WebSocket Client
// ============================================================================

export class WebSocketClient extends EventEmitter<ClientEvents> {
    private ws: WebSocket | null = null;
    private state: ConnectionState = 'disconnected';
    private reconnectAttempt = 0;
    private reconnectTimer: NodeJS.Timeout | null = null;
    private heartbeatTimer: NodeJS.Timeout | null = null;
    private messageQueue: WebSocketMessage[] = [];

    private config: Required<WebSocketClientConfig>;

    constructor(config: WebSocketClientConfig) {
        super();
        this.config = {
            url: config.url,
            apiKey: config.apiKey,
            reconnect: config.reconnect ?? true,
            reconnectMaxRetries: config.reconnectMaxRetries ?? 10,
            reconnectBaseDelay: config.reconnectBaseDelay ?? 1000,
            reconnectMaxDelay: config.reconnectMaxDelay ?? 30000,
            heartbeatInterval: config.heartbeatInterval ?? 30000,
            messageQueueSize: config.messageQueueSize ?? 100,
        };
    }

    // -------------------------------------------------------------------------
    // Connection Management
    // -------------------------------------------------------------------------

    /**
     * Connect to WebSocket server
     */
    connect(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this.state === 'connected' || this.state === 'connecting') {
                resolve();
                return;
            }

            this.state = 'connecting';

            // Build URL with API key
            const url = new URL(this.config.url);
            url.searchParams.set('apiKey', this.config.apiKey);

            this.ws = new WebSocket(url.toString());

            this.ws.on('open', () => {
                this.state = 'connected';
                this.reconnectAttempt = 0;
                this.startHeartbeat();
                this.flushMessageQueue();
                this.emit('connected');
                resolve();
            });

            this.ws.on('message', (data) => {
                this.handleMessage(data.toString());
            });

            this.ws.on('close', (code, reason) => {
                this.handleClose(code, reason.toString());
            });

            this.ws.on('error', (error) => {
                this.emit('error', error);
                if (this.state === 'connecting') {
                    reject(error);
                }
            });

            this.ws.on('pong', () => {
                // Server responded to ping
            });
        });
    }

    /**
     * Disconnect from server
     */
    disconnect(): void {
        this.state = 'disconnected';
        this.stopHeartbeat();
        this.stopReconnect();

        if (this.ws) {
            this.ws.close(1000, 'Client disconnecting');
            this.ws = null;
        }
    }

    /**
     * Check if connected
     */
    isConnected(): boolean {
        return this.state === 'connected' && this.ws?.readyState === WebSocket.OPEN;
    }

    /**
     * Get current connection state
     */
    getState(): ConnectionState {
        return this.state;
    }

    // -------------------------------------------------------------------------
    // Message Handling
    // -------------------------------------------------------------------------

    private handleMessage(data: string): void {
        try {
            const message = JSON.parse(data) as WebSocketMessage;

            // Route to specific event handlers
            switch (message.type as InboundMessageType) {
                case 'connected':
                    // Already handled by 'open' event
                    break;
                case 'task:assigned':
                    this.emit('task:assigned', message.payload);
                    break;
                case 'decision:required':
                    this.emit('decision:required', message.payload);
                    break;
                case 'config:updated':
                    this.emit('config:updated', message.payload);
                    break;
                case 'pong':
                    // Handled by ws pong event
                    break;
                case 'error':
                    console.error('[WSClient] Server error:', message.payload);
                    break;
                case 'disconnecting':
                    console.log('[WSClient] Server disconnecting:', message.payload);
                    break;
                default:
                    this.emit('message', message);
            }
        } catch (error) {
            console.error('[WSClient] Failed to parse message:', error);
        }
    }

    private handleClose(code: number, reason: string): void {
        this.stopHeartbeat();
        this.emit('disconnected', reason || `Code: ${code}`);

        // Attempt reconnection
        if (this.config.reconnect && this.state !== 'disconnected') {
            this.scheduleReconnect();
        } else {
            this.state = 'disconnected';
        }
    }

    // -------------------------------------------------------------------------
    // Sending Messages
    // -------------------------------------------------------------------------

    /**
     * Send a message to the server
     */
    send<T>(type: OutboundMessageType, payload: T): boolean {
        const message: WebSocketMessage<T> = {
            type,
            payload,
            timestamp: Date.now(),
            messageId: this.generateMessageId(),
        };

        if (this.isConnected()) {
            this.ws!.send(JSON.stringify(message));
            return true;
        }

        // Queue message for later
        if (this.messageQueue.length < this.config.messageQueueSize) {
            this.messageQueue.push(message as WebSocketMessage);
            return false;
        }

        console.warn('[WSClient] Message queue full, dropping message');
        return false;
    }

    /**
     * Send status update
     */
    sendStatusUpdate(payload: StatusUpdatePayload): boolean {
        return this.send('status:update', payload);
    }

    /**
     * Send heartbeat
     */
    sendHeartbeat(payload: HeartbeatPayload): boolean {
        return this.send('heartbeat', payload);
    }

    /**
     * Send action request
     */
    sendActionRequest(payload: ActionRequestPayload): boolean {
        return this.send('action:request', payload);
    }

    /**
     * Send task completed
     */
    sendTaskCompleted(payload: TaskCompletedPayload): boolean {
        return this.send('task:completed', payload);
    }

    /**
     * Send ping
     */
    ping(): void {
        if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.ping();
        }
    }

    // -------------------------------------------------------------------------
    // Reconnection Logic
    // -------------------------------------------------------------------------

    private scheduleReconnect(): void {
        if (this.reconnectAttempt >= this.config.reconnectMaxRetries) {
            console.error('[WSClient] Max reconnection attempts reached');
            this.state = 'disconnected';
            return;
        }

        this.state = 'reconnecting';
        this.reconnectAttempt++;

        // Exponential backoff with jitter
        const delay = Math.min(
            this.config.reconnectBaseDelay * Math.pow(2, this.reconnectAttempt - 1) +
            Math.random() * 1000,
            this.config.reconnectMaxDelay
        );

        this.emit('reconnecting', this.reconnectAttempt, delay);

        this.reconnectTimer = setTimeout(async () => {
            try {
                await this.connect();
            } catch (error) {
                // connect() will trigger handleClose on failure
            }
        }, delay);
    }

    private stopReconnect(): void {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        this.reconnectAttempt = 0;
    }

    // -------------------------------------------------------------------------
    // Heartbeat
    // -------------------------------------------------------------------------

    private startHeartbeat(): void {
        this.heartbeatTimer = setInterval(() => {
            this.sendHeartbeat({
                timestamp: Date.now(),
                status: 'healthy',
            });
        }, this.config.heartbeatInterval);
    }

    private stopHeartbeat(): void {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
    }

    // -------------------------------------------------------------------------
    // Message Queue
    // -------------------------------------------------------------------------

    private flushMessageQueue(): void {
        while (this.messageQueue.length > 0 && this.isConnected()) {
            const message = this.messageQueue.shift()!;
            this.ws!.send(JSON.stringify(message));
        }
    }

    // -------------------------------------------------------------------------
    // Utilities
    // -------------------------------------------------------------------------

    private generateMessageId(): string {
        return `msg_${randomBytes(6).toString('hex')}`;
    }
}
