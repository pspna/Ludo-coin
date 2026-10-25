export type PlayerColor = 'red' | 'green' | 'yellow' | 'blue';
export type SeatType = 'human' | 'cpu';
export type Difficulty = 'easy' | 'medium' | 'hard' | 'expert';
export type GameMode = 'classic' | 'quick' | 'practice' | 'room';

export interface Seat {
  id: string;
  color: PlayerColor;
  name: string;
  type: SeatType;
  difficulty: Difficulty;
  playerId?: string;
}

export type RoomStatus = 'WAITING' | 'STARTING' | 'IN_GAME' | 'FINISHED' | 'CLOSED';

export interface RoomPlayer {
  id: string;
  name: string;
  avatar: PlayerColor;
  color: PlayerColor;
  seatIndex: number;
  seatId: string;
  isHost: boolean;
  isReady: boolean;
  connected: boolean;
}

export interface RoomData {
  id: string;
  code: string;
  hostPlayerId: string;
  maxPlayers: number;
  status: RoomStatus;
  createdAt: number;
  updatedAt: number;
  players: RoomPlayer[];
  match?: Partial<MatchState> | null;
}

export interface Token {
  id: string;
  seatId: string;
  color: PlayerColor;
  index: number;
  /** -1 = on base, 0..55 travelling, 56 = home (finished) */
  steps: number;
}

export type EventType = 'enter' | 'capture' | 'safe' | 'home' | 'finish';

export interface GameEvent {
  type: EventType;
  tokenId: string;
  capturedId?: string;
}

export interface Pt {
  x: number;
  y: number;
}

export interface Settings {
  sound: boolean;
  haptics: boolean;
  animations: boolean;
  hints: boolean;
  autoRoll: boolean;
  diceSpeed: 'fast' | 'normal' | 'slow';
  appearance: 'auto' | 'light' | 'dark';
  serverUrl?: string;
}

export interface Profile {
  id?: string;
  name: string;
  coins: number;
  created: number;
  avatar: PlayerColor;
}

export interface Stats {
  games: number;
  wins: number;
  seconds: number;
  thirds: number;
  fourths: number;
  rolls: number;
  sixes: number;
  captures: number;
  tokensHome: number;
  streak: number;
  bestStreak: number;
  fastestWinMs: number;
  totalTimeMs: number;
  winsExpert: number;
  winsFourPlayer: number;
  winsNoCapture: number;
  blitzWins: number;
  winsByColor: Record<PlayerColor, number>;
  modes: Record<GameMode, number>;
}

export interface Customization {
  theme: string;
  dice: string;
  token: string;
  ownedThemes: string[];
  ownedDice: string[];
  ownedTokens: string[];
}

export interface SaveData {
  version: number;
  profile: Profile;
  stats: Stats;
  settings: Settings;
  custom: Customization;
  achievements: Record<string, number>;
  onboarded: boolean;
}

export interface MatchConfig {
  mode: GameMode;
  seats: Seat[];
}

export type Phase = 'roll' | 'rolling' | 'choose' | 'moving' | 'over';

export interface MoveJob {
  tokenId: string;
  waypoints: Pt[];
  stepMs: number;
}

export interface Banner {
  id: number;
  text: string;
  tone: 'info' | 'good' | 'bad' | 'gold';
}

export interface MatchStats {
  rolls: number;
  sixes: number;
  captures: number;
  tokensHome: number;
}

export interface MatchState {
  seats: Seat[];
  tokens: Token[];
  turn: number;
  dice: number | null;
  rolling: boolean;
  phase: Phase;
  sixStreak: number;
  selectable: string[];
  moving: MoveJob | null;
  banner: Banner | null;
  winnerSeat: string | null;
  rankings: string[];
  startedAt: number;
  paused: boolean;
  stats: MatchStats;
  finishOrder: string[];
}
