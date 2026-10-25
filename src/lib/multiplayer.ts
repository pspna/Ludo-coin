import { Platform } from 'react-native';
import type { MatchState, PlayerColor, RoomData, RoomPlayer, Token, GameEvent, Pt } from './types';

export type ConnectionState = 'connected' | 'connecting' | 'disconnected';

export interface DiceRolledPayload {
  roomId: string;
  dice: number;
  moves?: string[];
  forfeit?: boolean;
  passTurn?: boolean;
  reason?: string;
  room: RoomData;
}

export interface TokenMovedPayload {
  roomId: string;
  tokenId: string;
  dice: number;
  waypoints: Pt[];
  events: GameEvent[];
  extraTurn: boolean;
  isWinner: boolean;
  winnerSeatId: string | null;
  room: RoomData;
}

export interface PlayerLeftPayload {
  playerId: string;
  playerName: string;
  room: RoomData;
}

export interface LobbyEventPayload {
  room: RoomData;
  event?: {
    type: string;
    player?: RoomPlayer;
    playerId?: string;
    playerName?: string;
  };
}

export interface RoomClosedPayload {
  roomId: string;
  reason: string;
}

type EventListener<T> = (data: T) => void;

export function getDefaultServerUrl(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location) {
    const host = window.location.hostname || 'localhost';
    return `http://${host}:3001`;
  }
  // Android emulator uses 10.0.2.2 to access host machine; physical devices use LAN IP or custom setting
  return Platform.OS === 'android' ? 'http://10.0.2.2:3001' : 'http://localhost:3001';
}

export function toWsUrl(httpUrl: string): string {
  const clean = (httpUrl || getDefaultServerUrl()).replace(/\/+$/, '');
  if (clean.startsWith('https://')) return clean.replace('https://', 'wss://');
  if (clean.startsWith('http://')) return clean.replace('http://', 'ws://');
  if (clean.startsWith('ws://') || clean.startsWith('wss://')) return clean;
  return `ws://${clean}`;
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
  private maxReconnectAttempts = 6;
  private explicitlyDisconnected = false;

  private listeners: {
    connectionChange: Set<EventListener<ConnectionState>>;
    lobbyUpdated: Set<EventListener<LobbyEventPayload>>;
    gameStarted: Set<EventListener<RoomData>>;
    diceRolled: Set<EventListener<DiceRolledPayload>>;
    tokenMoved: Set<EventListener<TokenMovedPayload>>;
    playerLeft: Set<EventListener<PlayerLeftPayload>>;
    playerStatusChanged: Set<EventListener<any>>;
    roomClosed: Set<EventListener<RoomClosedPayload>>;
    syncState: Set<EventListener<RoomData>>;
    error: Set<EventListener<string>>;
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
    if (url && url !== this.serverUrl) {
      this.serverUrl = url;
      if (this.ws) {
        this.disconnect();
        this.connect(this.currentPlayerId || undefined, this.currentRoomId || undefined);
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

    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return Promise.resolve(true);
    }

    this.setConnectionState('connecting');

    return new Promise((resolve) => {
      try {
        const wsUrl = toWsUrl(this.serverUrl);
        const socket = new WebSocket(wsUrl);
        this.ws = socket;

        const timeout = setTimeout(() => {
          if (socket.readyState !== WebSocket.OPEN) {
            this.setConnectionState('disconnected');
            resolve(false);
          }
        }, 5000);

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
            const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), 8000);
            this.reconnectAttempts++;
            if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
            this.reconnectTimer = setTimeout(() => {
              if (!this.explicitlyDisconnected) {
                this.connect(this.currentPlayerId || undefined, this.currentRoomId || undefined);
              }
            }, delay);
          }
        };
      } catch (err) {
        this.setConnectionState('disconnected');
        resolve(false);
      }
    });
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

  public async createRoom(params: {
    hostId: string;
    hostName: string;
    hostAvatar: PlayerColor;
    hostColor: PlayerColor;
    maxPlayers: number;
  }): Promise<{ success: boolean; room?: RoomData; error?: string }> {
    try {
      this.currentPlayerId = params.hostId;
      const res = await fetch(`${this.serverUrl}/api/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Failed to create room' };
      }
      this.currentRoomId = data.room.id;
      // Connect WebSocket to live room
      await this.connect(params.hostId, data.room.id);
      return { success: true, room: data.room };
    } catch (err: any) {
      return {
        success: false,
        error: `Could not connect to multiplayer server at ${this.serverUrl}. Please check your connection or server settings.`,
      };
    }
  }

  public async getRoomByCode(code: string): Promise<{ success: boolean; room?: RoomData; error?: string }> {
    try {
      const clean = (code || '').trim().toUpperCase();
      const res = await fetch(`${this.serverUrl}/api/rooms/${clean}`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Room not found' };
      }
      return { success: true, room: data.room };
    } catch (err: any) {
      return {
        success: false,
        error: `Could not reach multiplayer server at ${this.serverUrl}.`,
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
    try {
      const clean = (params.code || '').trim().toUpperCase();
      this.currentPlayerId = params.playerId;

      const res = await fetch(`${this.serverUrl}/api/rooms/${clean}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: params.playerId,
          playerName: params.playerName,
          playerAvatar: params.playerAvatar,
          playerColor: params.playerColor,
        }),
      });

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
      return {
        success: false,
        error: `Could not connect to multiplayer server at ${this.serverUrl}.`,
      };
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

  public startGame(roomId: string, playerId: string) {
    this.send({
      type: 'start_game',
      roomId,
      playerId,
    });
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

  public leaveRoom(roomId: string, playerId: string) {
    this.send({
      type: 'leave_room',
      roomId,
      playerId,
    });
    this.currentRoomId = null;
  }

  // ---------------- Event Subscriptions ----------------

  public onConnectionChange(fn: EventListener<ConnectionState>): () => void {
    this.listeners.connectionChange.add(fn);
    fn(this.connectionState);
    return () => this.listeners.connectionChange.delete(fn);
  }

  public onLobbyUpdated(fn: EventListener<LobbyEventPayload>): () => void {
    this.listeners.lobbyUpdated.add(fn);
    return () => this.listeners.lobbyUpdated.delete(fn);
  }

  public onGameStarted(fn: EventListener<RoomData>): () => void {
    this.listeners.gameStarted.add(fn);
    return () => this.listeners.gameStarted.delete(fn);
  }

  public onDiceRolled(fn: EventListener<DiceRolledPayload>): () => void {
    this.listeners.diceRolled.add(fn);
    return () => this.listeners.diceRolled.delete(fn);
  }

  public onTokenMoved(fn: EventListener<TokenMovedPayload>): () => void {
    this.listeners.tokenMoved.add(fn);
    return () => this.listeners.tokenMoved.delete(fn);
  }

  public onPlayerLeft(fn: EventListener<PlayerLeftPayload>): () => void {
    this.listeners.playerLeft.add(fn);
    return () => this.listeners.playerLeft.delete(fn);
  }

  public onPlayerStatusChanged(fn: EventListener<any>): () => void {
    this.listeners.playerStatusChanged.add(fn);
    return () => this.listeners.playerStatusChanged.delete(fn);
  }

  public onRoomClosed(fn: EventListener<RoomClosedPayload>): () => void {
    this.listeners.roomClosed.add(fn);
    return () => this.listeners.roomClosed.delete(fn);
  }

  public onSyncState(fn: EventListener<RoomData>): () => void {
    this.listeners.syncState.add(fn);
    return () => this.listeners.syncState.delete(fn);
  }

  public onError(fn: EventListener<string>): () => void {
    this.listeners.error.add(fn);
    return () => this.listeners.error.delete(fn);
  }
}

export const multiplayer = new MultiplayerClient();
