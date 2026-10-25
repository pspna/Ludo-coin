import type { GameMode, Seat } from './types';

export type RootStackParamList = {
  Splash: undefined;
  Onboarding: undefined;
  Home: undefined;
  GameSetup: { mode: GameMode };
  CreateRoom: undefined;
  JoinRoom: undefined;
  RoomLobby: { roomId: string; code: string; isHost: boolean; initialRoom?: any; playerId?: string };
  Game: { mode: GameMode; seats: Seat[]; roomId?: string; isOnline?: boolean; initialMatch?: any };
  Profile: undefined;
  Achievements: undefined;
  Stats: undefined;
  Customization: undefined;
  Settings: undefined;
  Help: undefined;
};
