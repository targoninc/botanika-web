import {toast} from "../ui.ts";
import {ToastType} from "../../enums/ToastType.ts";
import {ApiEndpoint} from "../../../models/ApiEndpoints.ts";
import {BotanikaClientEvent} from "../../../models/websocket/clientEvents/botanikaClientEvent.ts";
import {handleMessage} from "./handleMessage.ts";
import {BotanikaServerEvent} from "../../../models/websocket/serverEvents/botanikaServerEvent.ts";
import {connected} from "../state/store.ts";

export class Realtime {
    private static instance: Realtime;
    private socket: WebSocket | null = null;
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 10;
    private baseReconnectDelay = 1000; // 1 second
    private reconnectTimer: number | null = null;
    private isConnecting = false;
    private isClosing = false;

    private constructor() {
        this.connect();
    }

    /**
     * Get the singleton instance of the Realtime class
     */
    public static getInstance(): Realtime {
        if (!Realtime.instance) {
            Realtime.instance = new Realtime();
        }
        return Realtime.instance;
    }

    /**
     * Connect to the WebSocket server
     */
    private async connect(): Promise<void> {
        if (this.socket || this.isConnecting) return;
        this.isConnecting = true;

        try {
            // First get the authentication token
            const tokenResponse = await fetch(ApiEndpoint.WS_TOKEN);
            if (!tokenResponse.ok) {
                throw new Error('Failed to get WebSocket token');
            }

            const { token } = await tokenResponse.json();

            // Use the token in the WebSocket URL
            const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws?token=${token}`;

            console.log(`Connecting to WebSocket server at ${wsUrl}`);

            this.socket = new WebSocket(wsUrl);

            this.socket.onopen = this.handleOpen.bind(this);
            this.socket.onmessage = this.handleMessage.bind(this);
            this.socket.onerror = this.handleError.bind(this);
            this.socket.onclose = this.handleClose.bind(this);
        } catch (error) {
            console.error('Error creating WebSocket connection:', error);
            this.isConnecting = false;
            this.scheduleReconnect();
        }
    }

    /**
     * Handle WebSocket open event
     */
    private handleOpen(): void {
        console.log('Connected to WebSocket server');
        this.reconnectAttempts = 0;
        this.isConnecting = false;
        connected.value = true;
    }

    /**
     * Handle WebSocket message event
     */
    private async handleMessage(event: MessageEvent): Promise<void> {
        try {
            const data = JSON.parse(event.data) as BotanikaServerEvent<any>;
            await handleMessage(data);
        } catch (error) {
            console.error('Error parsing WebSocket message:', error, event.data);
        }
    }

    /**
     * Handle WebSocket error event
     */
    private handleError(event: Event): void {
        console.error('WebSocket error:', event);
        this.isConnecting = false;
    }

    /**
     * Handle WebSocket close event
     */
    private handleClose(event: CloseEvent): void {
        console.log(`WebSocket connection closed: ${event.code} ${event.reason}`);
        this.socket = null;
        this.isConnecting = false;
        connected.value = false;

        if (!this.isClosing) {
            this.scheduleReconnect();
        } else {
            this.isClosing = false;
        }
    }

    /**
     * Close the WebSocket connection immediately
     */
    public close(): void {
        if (this.socket) {
            console.log('Closing WebSocket connection');
            this.isClosing = true;

            if (this.reconnectTimer !== null) {
                clearTimeout(this.reconnectTimer);
                this.reconnectTimer = null;
            }

            this.socket.close(1000, 'Page unloaded');
            this.socket = null;
            connected.value = false;
        }
    }

    /**
     * Schedule a reconnection attempt with exponential backoff
     */
    private scheduleReconnect(): void {
        if (this.reconnectTimer !== null) {
            clearTimeout(this.reconnectTimer);
        }

        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('Maximum reconnection attempts reached');
            toast('Failed to connect to realtime server after multiple attempts', null, ToastType.negative);
            return;
        }

        const delay = this.calculateReconnectDelay();
        console.log(`Scheduling reconnect in ${delay}ms (attempt ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`);

        this.reconnectTimer = window.setTimeout(() => {
            this.reconnectAttempts++;
            this.connect();
        }, delay);
    }

    /**
     * Calculate reconnect delay using exponential backoff
     */
    private calculateReconnectDelay(): number {
        // Exponential backoff: baseDelay * 2^attempts (with some randomness)
        const exponentialDelay = this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts);
        // Add jitter (±20% randomness)
        const jitter = exponentialDelay * 0.2 * (Math.random() * 2 - 1);
        return Math.min(exponentialDelay + jitter, 30000); // Cap at 30 seconds
    }

    /**
     * Send a message to the WebSocket server
     */
    public send(data: BotanikaClientEvent<any>): boolean {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
            console.error('Cannot send message: WebSocket is not connected');
            return false;
        }

        try {
            this.socket.send(JSON.stringify(data));
            return true;
        } catch (error) {
            console.error('Error sending WebSocket message:', error);
            return false;
        }
    }
}
