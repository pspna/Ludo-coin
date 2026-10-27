import { Platform } from 'react-native';
import type { MatchState, PlayerColor, RoomData, RoomPlayer, Token, GameEvent, Pt } from './types';

export type ConnectionState = 'connected' | 'connecting' | 'reconnecting' | 'disconnected' | 'error';

export type MpEventListener<T> = (data: T) => void;

export interface LobbyEventPayload {
  room: RoomData;
  event?: string;
}

export interface DiceRolledPayload {
  roomId: string;
  dice: number;
  moves: any[];
  forfeit?: boolean;
  passTurn?: boolean;
  reason?: string;
  room?: RoomData;
}

export interface TokenMovedPayload {
  roomId: string;
  tokenId: string;
  dice: number;
  waypoints?: Pt[];
  events?: GameEvent[];
  extraTurn?: boolean;
  isWinner?: boolean;
  winnerSeatId?: string;
  room?: RoomData;
}

export interface PlayerLeftPayload {
  playerId: string;
  playerName?: string;
  room?: RoomData;
}

export interface RoomClosedPayload {
  roomId?: string;
  reason?: string;
}

export interface UrlValidationResult {
  valid: boolean;
  normalizedUrl: string;
  wsUrl: string;
  error?: string;
  isMixedContent?: boolean;
  isVercel?: boolean;
}

/**
 * Validates, sanitizes, and normalizes a multiplayer server endpoint.
 * Enforces valid HTTP/HTTPS/WS/WSS schemas and prevents common misconfigurations.
 */
export function validateServerUrl(rawUrl?: string | null): UrlValidationResult {
  const clean = (rawUrl || '').trim().replace(/\/+$/, '');
  if (!clean) {
    return {
      valid: false,
      normalizedUrl: '',
      wsUrl: '',
      error:
        'Multiplayer server URL is not configured. Please open Server Settings (⚙️) ' +
        'to set your live backend endpoint (e.g. https://your-server.onrender.com) ' +
        'or set EXPO_PUBLIC_SERVER_URL in your deployment configuration.',
    };
  }

  // Detect accidental entry of Vercel app domain
  if (clean.includes('.vercel.app')) {
    return {
      valid: false,
      normalizedUrl: clean,
      wsUrl: '',
      isVercel: true,
      error:
        'Multiplayer server not found on Vercel. Vercel only hosts the static frontend application ' +
        'and cannot run persistent WebSocket servers. Please deploy server/server.js to Render or Railway ' +
        'and set your live backend endpoint in Server Settings (⚙️).',
    };
  }

  // Reject unsupported protocols
  if (
    clean.startsWith('ftp://') ||
    clean.startsWith('file://') ||
    clean.startsWith('javascript:') ||
    clean.startsWith('data:')
  ) {
    return {
      valid: false,
      normalizedUrl: clean,
      wsUrl: '',
      error: 'Unsupported protocol in server URL. Only HTTP, HTTPS, WS, and WSS are supported.',
    };
  }

  let httpUrl = clean;
  // If protocol was omitted, determine based on environment
  if (!clean.startsWith('http://') && !clean.startsWith('https://') && !clean.startsWith('ws://') && !clean.startsWith('wss://')) {
    if (typeof window !== 'undefined' && window.location?.protocol === 'https:') {
      httpUrl = `https://${clean}`;
    } else {
      httpUrl = `http://${clean}`;
    }
  } else if (clean.startsWith('wss://')) {
    httpUrl = clean.replace('wss://', 'https://');
  } else if (clean.startsWith('ws://')) {
    httpUrl = clean.replace('ws://', 'http://');
  }

  // Validate URL syntax
  try {
    const parsed = new URL(httpUrl);
    if (!parsed.hostname) {
      return {
        valid: false,
        normalizedUrl: httpUrl,
        wsUrl: '',
        error: `Invalid server URL hostname (${httpUrl}). Please provide a valid hostname.`,
      };
    }
  } catch (e: any) {
    return {
      valid: false,
      normalizedUrl: httpUrl,
      wsUrl: '',
      error: `Malformed server URL (${httpUrl}): ${e?.message || 'Invalid format'}`,
    };
  }

  // Check mixed content in browser: HTTPS page cannot fetch insecure HTTP
  if (typeof window !== 'undefined' && window.location?.protocol === 'https:' && httpUrl.startsWith('http://')) {
    const isLocalhost = httpUrl.includes('localhost') || httpUrl.includes('127.0.0.1');
    if (!isLocalhost) {
      return {
        valid: false,
        normalizedUrl: httpUrl,
        wsUrl: '',
        isMixedContent: true,
        error:
          `Mixed content blocked: Cannot connect to an unencrypted HTTP backend (${httpUrl}) from an HTTPS page. ` +
          'Please host the multiplayer server with HTTPS/WSS (e.g. on Render or Railway) and update Server Settings (⚙️).',
      };
    }
  }

  let wsUrl = '';
  if (httpUrl.startsWith('https://')) {
    wsUrl = httpUrl.replace('https://', 'wss://');
  } else if (httpUrl.startsWith('http://')) {
    wsUrl = httpUrl.replace('http://', 'ws://');
  }

  return {
    valid: true,
    normalizedUrl: httpUrl,
    wsUrl,
  };
}

export function normalizeServerUrl(rawUrl: string): string {
  const res = validateServerUrl(rawUrl);
  return res.normalizedUrl;
}

export function getDefaultServerUrl(): string {
  if (process.env.EXPO_PUBLIC_SERVER_URL) {
    const res = validateServerUrl(process.env.EXPO_PUBLIC_SERVER_URL);
    if (res.valid) {
      return res.normalizedUrl;
    }
  }
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location) {
    const host = window.location.hostname || 'localhost';
    if (host === 'localhost' || host === '127.0.0.1') {
      return `http://${host}:3001`;
    }
    // Check if host is a LAN IP (e.g. 192.168.x.x, 10.x.x.x, 172.x.x.x)
    if (/^192\.168\./.test(host) || /^10\./.test(host) || /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host)) {
      return `http://${host}:3001`;
    }
    // Static web hosting on Vercel or other cloud platforms: require explicit URL configuration
    return '';
  }
  // Android emulator uses 10.0.2.2 to access host machine; physical devices use LAN IP or custom setting
  return Platform.OS === 'android' ? 'http://10.0.2.2:3001' : 'http://localhost:3001';
}

export async function testServerConnection(url: string): Promise<{ ok: boolean; message: string; details?: any }> {
  try {
    const validation = validateServerUrl(url);
    if (!validation.valid) {
      return { ok: false, message: validation.error || 'Invalid server URL' };
    }
    const clean = validation.normalizedUrl;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const start = Date.now();
    const res = await fetch(`${clean}/health`, { signal: controller.signal });
    const latency = Date.now() - start;
    clearTimeout(timeout);

    if (!res.ok) {
      if (res.status === 404) {
        return {
          ok: false,
          message: `Server returned 404 Not Found at ${clean}/health. The endpoint is reachable, but does not appear to be running the Ludo Royale server.js.`,
        };
      }
      return { ok: false, message: `Server returned HTTP ${res.status}` };
    }

    const data = await res.json();
    return {
      ok: true,
      message: `Online! Latency: ${latency}ms | Active rooms: ${data.activeRooms ?? 0}`,
      details: data,
    };
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      return {
        ok: false,
        message: 'Connection timed out after 8s. If using Render free tier, the server may be waking up from sleep (can take ~30-50s). Please try again.',
      };
    }
    return { ok: false, message: err?.message || 'Server connection failed' };
  }
}

export function toWsUrl(httpUrl: string): string {
  const res = validateServerUrl(httpUrl || getDefaultServerUrl());
  return res.wsUrl;
}

class MultiplayerClient {
  private ws: WebSocket | null = null;
  private serverUrl: string = getDefaultServerUrl();
  private connectionState: ConnectionState = 'disconnected';
  private currentRoomId: string | null = null;
  private currentPlayerId: string | null = null;
  private reconnectTimer: any = null;
  private pingTimer: any = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private explicitlyDisconnected = false;
  private isRoomOperationInProgress = false;

  private listeners: {
    connectionChange: Set<MpEventListener<ConnectionState>>;
    lobbyUpdated: Set<MpEventListener<LobbyEventPayload>>;
    gameStarted: Set<MpEventListener<RoomData>>;
    diceRolled: Set<MpEventListener<DiceRolledPayload>>;
    tokenMoved: Set<MpEventListener<TokenMovedPayload>>;
    playerLeft: Set<MpEventListener<PlayerLeftPayload>>;
    playerStatusChanged: Set<MpEventListener<any>>;
    roomClosed: Set<MpEventListener<RoomClosedPayload>>;
    syncState: Set<MpEventListener<RoomData>>;
    error: Set<MpEventListener<string>>;
  } = {
    connectionChange: new Set(),
    lobbyUpdated: new Set(),
    gameStarted: new Set(),
    diceRolled: new Set(),
    tokenMoved: new Set(),
    playerLeft: new Set(),
    playerStatusChanged: new Set(),
    roomClosed: new Set(),
    syncState: new Set(),
    error: new Set(),
  };

  public setServerUrl(url: string) {
    const clean = normalizeServerUrl(url);
    if (clean !== this.serverUrl) {
      this.serverUrl = clean;
      if (this.ws) {
        this.disconnect();
        if (clean) {
          this.connect(this.currentPlayerId || undefined, this.currentRoomId || undefined);
        }
      }
    }
  }

  public getServerUrl(): string {
    return this.serverUrl;
  }

  public getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  private setConnectionState(state: ConnectionState) {
    if (this.connectionState !== state) {
      this.connectionState = state;
      this.listeners.connectionChange.forEach((fn) => fn(state));
    }
  }

  public connect(playerId?: string, roomId?: string): Promise<boolean> {
    this.explicitlyDisconnected = false;
    if (playerId) this.currentPlayerId = playerId;
    if (roomId) this.currentRoomId = roomId;

    const validation = validateServerUrl(this.serverUrl);
    if (!validation.valid || !validation.wsUrl) {
      this.setConnectionState('disconnected');
      return Promise.resolve(false);
    }

    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return Promise.resolve(true);
    }

    this.setConnectionState(this.reconnectAttempts > 0 ? 'reconnecting' : 'connecting');

    return new Promise((resolve) => {
      try {
        const wsUrl = validation.wsUrl;
        const socket = new WebSocket(wsUrl);
        this.ws = socket;

        const timeout = setTimeout(() => {
          if (socket.readyState !== WebSocket.OPEN) {
            this.setConnectionState('disconnected');
            resolve(false);
          }
        }, 8000);

        socket.onopen = () => {
          clearTimeout(timeout);
          this.reconnectAttempts = 0;
          this.setConnectionState('connected');

          // Register player identity
          if (this.currentPlayerId) {
            this.send({
              type: 'register',
              playerId: this.currentPlayerId,
              roomId: this.currentRoomId || undefined,
            });
          }

          // Start ping heartbeat
          if (this.pingTimer) clearInterval(this.pingTimer);
          this.pingTimer = setInterval(() => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
              this.send({ type: 'ping' });
            }
          }, 12000);

          resolve(true);
        };

        socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this.handleMessage(data);
          } catch (e) {
            // ignore malformed
          }
        };

        socket.onerror = () => {
          clearTimeout(timeout);
          this.setConnectionState('disconnected');
          resolve(false);
        };

        socket.onclose = () => {
          clearTimeout(timeout);
          if (this.pingTimer) clearInterval(this.pingTimer);
          this.setConnectionState('disconnected');

          if (!this.explicitlyDisconnected && this.reconnectAttempts < this.maxReconnectAttempts) {
            const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), 10000);
            this.reconnectAttempts++;
            this.setConnectionState('reconnecting');
            if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
            this.reconnectTimer = setTimeout(() => {
              if (!this.explicitlyDisconnected) {
                this.connect(this.currentPlayerId || undefined, this.currentRoomId || undefined);
              }
            }, delay);
          } else if (!this.explicitlyDisconnected && this.reconnectAttempts >= this.maxReconnectAttempts) {
            this.setConnectionState('error');
            this.listeners.error.forEach((fn) =>
              fn('Connection to multiplayer server was lost. Please verify your connection or click Reconnect.')
            );
          }
        };
      } catch (err) {
        this.setConnectionState('disconnected');
        resolve(false);
      }
    });
  }

  public reconnect(): Promise<boolean> {
    this.reconnectAttempts = 0;
    this.disconnect();
    this.explicitlyDisconnected = false;
    return this.connect(this.currentPlayerId || undefined, this.currentRoomId || undefined);
  }

  public disconnect() {
    this.explicitlyDisconnected = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.pingTimer) clearInterval(this.pingTimer);
    if (this.ws) {
      try {
        this.ws.close();
      } catch {}
      this.ws = null;
    }
    this.setConnectionState('disconnected');
  }

  private send(payload: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }

  private handleMessage(msg: any) {
    const { type } = msg;
    switch (type) {
      case 'lobby_updated':
      case 'room_joined':
      case 'room_created':
        this.listeners.lobbyUpdated.forEach((fn) => fn({ room: msg.room, event: msg.event }));
        break;

      case 'game_started':
        this.listeners.gameStarted.forEach((fn) => fn(msg.room));
        break;

      case 'dice_rolled':
        this.listeners.diceRolled.forEach((fn) =>
          fn({
            roomId: msg.roomId,
            dice: msg.dice,
            moves: msg.moves,
            forfeit: msg.forfeit,
            passTurn: msg.passTurn,
            reason: msg.reason,
            room: msg.room,
          }),
        );
        break;

      case 'token_moved':
        this.listeners.tokenMoved.forEach((fn) =>
          fn({
            roomId: msg.roomId,
            tokenId: msg.tokenId,
            dice: msg.dice,
            waypoints: msg.waypoints,
            events: msg.events,
            extraTurn: msg.extraTurn,
            isWinner: msg.isWinner,
            winnerSeatId: msg.winnerSeatId,
            room: msg.room,
          }),
        );
        break;

      case 'player_left':
        this.listeners.playerLeft.forEach((fn) =>
          fn({
            playerId: msg.playerId,
            playerName: msg.playerName,
            room: msg.room,
          }),
        );
        break;

      case 'player_status_changed':
        this.listeners.playerStatusChanged.forEach((fn) => fn(msg));
        break;

      case 'room_closed':
        this.listeners.roomClosed.forEach((fn) => fn({ roomId: msg.roomId, reason: msg.reason }));
        break;

      case 'sync_state':
        this.listeners.syncState.forEach((fn) => fn(msg.room));
        break;

      case 'error':
        this.listeners.error.forEach((fn) => fn(msg.message || 'An error occurred'));
        break;

      default:
        break;
    }
  }

  // ---------------- REST + WS Room Operations ----------------

  private formatConnectionError(overrideUrl?: string): string {
    const targetUrl = overrideUrl !== undefined ? overrideUrl : this.serverUrl;
    const validation = validateServerUrl(targetUrl);
    if (!validation.valid && validation.error) {
      return validation.error;
    }
    return `Could not connect to multiplayer server at ${validation.normalizedUrl || targetUrl}. Please check your connection or server settings (⚙️).`;
  }

  public async createRoom(params: {
    hostId: string;
    hostName: string;
    hostAvatar: PlayerColor;
    hostColor?: PlayerColor;
    maxPlayers: number;
  }): Promise<{ success: boolean; room?: RoomData; error?: string }> {
    if (this.isRoomOperationInProgress) {
      return { success: false, error: 'A room creation request is already in progress. Please wait a moment.' };
    }

    const validation = validateServerUrl(this.serverUrl);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    this.isRoomOperationInProgress = true;
    try {
      this.currentPlayerId = params.hostId;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const res = await fetch(`${validation.normalizedUrl}/api/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Failed to create room' };
      }
      this.currentRoomId = data.room.id;
      // Connect WebSocket to live room
      await this.connect(params.hostId, data.room.id);
      return { success: true, room: data.room };
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        return {
          success: false,
          error: 'Room creation timed out after 10s. If the backend is hosted on a free tier (e.g. Render), it may take 30-50s to wake up. Please retry.',
        };
      }
      return {
        success: false,
        error: this.formatConnectionError(),
      };
    } finally {
      this.isRoomOperationInProgress = false;
    }
  }

  public async getRoomByCode(code: string): Promise<{ success: boolean; room?: RoomData; error?: string }> {
    const validation = validateServerUrl(this.serverUrl);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }
    try {
      const clean = (code || '').trim().toUpperCase();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      const res = await fetch(`${validation.normalizedUrl}/api/rooms/${clean}`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Room not found' };
      }
      return { success: true, room: data.room };
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        return {
          success: false,
          error: 'Looking up room timed out after 8s. Please verify your connection or server status.',
        };
      }
      return {
        success: false,
        error: this.formatConnectionError(),
      };
    }
  }

  public async joinRoom(params: {
    code: string;
    playerId: string;
    playerName: string;
    playerAvatar: PlayerColor;
    playerColor?: PlayerColor;
  }): Promise<{ success: boolean; room?: RoomData; player?: RoomPlayer; isRejoin?: boolean; error?: string }> {
    if (this.isRoomOperationInProgress) {
      return { success: false, error: 'A room join request is already in progress. Please wait a moment.' };
    }

    const validation = validateServerUrl(this.serverUrl);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    this.isRoomOperationInProgress = true;
    try {
      const clean = (params.code || '').trim().toUpperCase();
      this.currentPlayerId = params.playerId;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const res = await fetch(`${validation.normalizedUrl}/api/rooms/${clean}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: params.playerId,
          playerName: params.playerName,
          playerAvatar: params.playerAvatar,
          playerColor: params.playerColor,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Failed to join room' };
      }

      this.currentRoomId = data.room.id;
      // Connect WebSocket to live room and notify room participants
      await this.connect(params.playerId, data.room.id);
      this.send({
        type: 'join_room',
        code: clean,
        playerId: params.playerId,
        data: {
          playerName: params.playerName,
          playerAvatar: params.playerAvatar,
          playerColor: params.playerColor,
        },
      });

      return {
        success: true,
        room: data.room,
        player: data.player,
        isRejoin: data.isRejoin,
      };
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        return {
          success: false,
          error: 'Joining room timed out after 10s. If the backend is waking up, please try again.',
        };
      }
      return {
        success: false,
        error: this.formatConnectionError(),
      };
    } finally {
      this.isRoomOperationInProgress = false;
    }
  }

  public setReady(roomId: string, playerId: string, isReady: boolean) {
    this.send({
      type: 'set_ready',
      roomId,
      playerId,
      data: { isReady },
    });
  }

  public async startGame(roomId: string, playerId: string) {
    this.send({
      type: 'start_game',
      roomId,
      playerId,
    });
    if (this.serverUrl) {
      try {
        await fetch(`${this.serverUrl}/api/rooms/${roomId}/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ playerId }),
        });
      } catch {}
    }
  }

  public rollDice(roomId: string, playerId: string) {
    this.send({
      type: 'roll_dice',
      roomId,
      playerId,
    });
  }

  public moveToken(roomId: string, playerId: string, tokenId: string) {
    this.send({
      type: 'move_token',
      roomId,
      playerId,
      data: { tokenId },
    });
  }

  public syncState(roomId: string, playerId: string) {
    this.send({
      type: 'sync_request',
      roomId,
      playerId,
    });
  }

  public async leaveRoom(roomId: string, playerId: string) {
    this.send({
      type: 'leave_room',
      roomId,
      playerId,
    });
    if (this.serverUrl) {
      try {
        await fetch(`${this.serverUrl}/api/rooms/${roomId}/leave`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ playerId }),
        });
      } catch {}
    }
    this.currentRoomId = null;
  }

  // ---------------- Event Subscriptions ----------------

  public onConnectionChange(fn: MpEventListener<ConnectionState>): () => void {
    this.listeners.connectionChange.add(fn);
    fn(this.connectionState);
    return () => this.listeners.connectionChange.delete(fn);
  }

  public onLobbyUpdated(fn: MpEventListener<LobbyEventPayload>): () => void {
    this.listeners.lobbyUpdated.add(fn);
    return () => this.listeners.lobbyUpdated.delete(fn);
  }

  public onGameStarted(fn: MpEventListener<RoomData>): () => void {
    this.listeners.gameStarted.add(fn);
    return () => this.listeners.gameStarted.delete(fn);
  }

  public onDiceRolled(fn: MpEventListener<DiceRolledPayload>): () => void {
    this.listeners.diceRolled.add(fn);
    return () => this.listeners.diceRolled.delete(fn);
  }

  public onTokenMoved(fn: MpEventListener<TokenMovedPayload>): () => void {
    this.listeners.tokenMoved.add(fn);
    return () => this.listeners.tokenMoved.delete(fn);
  }

  public onPlayerLeft(fn: MpEventListener<PlayerLeftPayload>): () => void {
    this.listeners.playerLeft.add(fn);
    return () => this.listeners.playerLeft.delete(fn);
  }

  public onPlayerStatusChanged(fn: MpEventListener<any>): () => void {
    this.listeners.playerStatusChanged.add(fn);
    return () => this.listeners.playerStatusChanged.delete(fn);
  }

  public onRoomClosed(fn: MpEventListener<RoomClosedPayload>): () => void {
    this.listeners.roomClosed.add(fn);
    return () => this.listeners.roomClosed.delete(fn);
  }

  public onSyncState(fn: MpEventListener<RoomData>): () => void {
    this.listeners.syncState.add(fn);
    return () => this.listeners.syncState.delete(fn);
  }

  public onError(fn: MpEventListener<string>): () => void {
    this.listeners.error.add(fn);
    return () => this.listeners.error.delete(fn);
  }
}

export const multiplayer = new MultiplayerClient();
