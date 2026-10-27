import React, { useEffect, useState, useCallback } from 'react';
import {
  Alert,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { StatusBar } from 'expo-status-bar';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../lib/nav';
import { useStore } from '../lib/store';
import { RING_ORDER, alpha } from '../lib/theme';
import type { PlayerColor, RoomData, RoomPlayer, Seat } from '../lib/types';
import { Btn, Card, Header, Press } from '../components/ui';
import { multiplayer, type ConnectionState } from '../lib/multiplayer';
import { haptic, play } from '../lib/sound';

type Props = NativeStackScreenProps<RootStackParamList, 'RoomLobby'>;

export default function RoomLobbyScreen({ navigation, route }: Props) {
  const params = route?.params || ({} as any);
  const roomId = params.roomId || '';
  const code = params.code || '';
  const initialIsHost = !!params.isHost;
  const initialRoom = params.initialRoom || null;
  const { isDark, theme, save } = useStore();
  const ui = isDark ? theme.dark_ : theme.light;

  const [room, setRoom] = useState<RoomData | null>(initialRoom || null);
  const [connState, setConnState] = useState<ConnectionState>(multiplayer.getConnectionState());
  const [starting, setStarting] = useState(false);
  const [copied, setCopied] = useState(false);

  const myPlayerId = params.playerId || save.profile?.id || '';
  const isHost = room?.hostPlayerId ? room.hostPlayerId === myPlayerId : initialIsHost;
  const myPlayer = (room?.players || []).find((p) => p?.id === myPlayerId);

  // Diagnostic log
  useEffect(() => {
    console.log('[RoomLobby] Screen rendered with state:', {
      roomId,
      code,
      isHost,
      myPlayerId,
      playersCount: room?.players?.length ?? 0,
      connState,
    });
  }, [roomId, code, isHost, myPlayerId, room?.players?.length, connState]);

  // Subscribe to real-time events
  useEffect(() => {
    if (!roomId) {
      console.warn('[RoomLobby] Missing roomId in route.params, cannot subscribe to multiplayer');
      return;
    }

    console.log('[RoomLobby] Initializing multiplayer subscription for room:', roomId, 'player:', myPlayerId);

    // Ensure connection is established
    multiplayer.connect(myPlayerId, roomId);

    const unsubConn = multiplayer.onConnectionChange((st) => {
      console.log('[RoomLobby] Connection status changed to:', st);
      setConnState(st);
    });

    const unsubLobby = multiplayer.onLobbyUpdated(({ room: nextRoom }) => {
      console.log('[RoomLobby] Lobby updated received. Players now:', nextRoom?.players?.length);
      if (nextRoom) {
        setRoom(nextRoom);
      }
      play('click');
      haptic('light');
    });

    const unsubSync = multiplayer.onSyncState((nextRoom) => {
      console.log('[RoomLobby] Sync state received:', nextRoom?.id);
      if (nextRoom && nextRoom.id === roomId) {
        setRoom(nextRoom);
      }
    });

    const unsubGameStart = multiplayer.onGameStarted((nextRoom) => {
      console.log('[RoomLobby] Game started event received! Navigating to GameScreen:', nextRoom?.id);
      if (!nextRoom) return;
      setStarting(true);
      play('win');
      haptic('success');
      const seats: Seat[] = (nextRoom.players || []).map((p: RoomPlayer, idx: number) => ({
        id: p.seatId || `seat_${idx}`,
        color: (p?.color && p.color in theme.players) ? (p.color as PlayerColor) : RING_ORDER[idx % 4],
        name: p?.name || `Player ${idx + 1}`,
        type: 'human' as const,
        difficulty: 'medium' as const,
        playerId: p?.id,
      }));

      navigation.replace('Game', {
        mode: 'room',
        seats,
        roomId: nextRoom.id,
        isOnline: true,
        initialMatch: nextRoom.match,
      });
    });

    const unsubClosed = multiplayer.onRoomClosed(({ reason }) => {
      console.log('[RoomLobby] Room closed by host:', reason);
      Alert.alert('Room Closed', reason || 'The host has closed this room.', [
        { text: 'OK', onPress: () => navigation.navigate('Home') },
      ]);
    });

    // Request full state on mount
    multiplayer.syncState(roomId, myPlayerId);

    return () => {
      console.log('[RoomLobby] Cleaning up multiplayer subscriptions for room:', roomId);
      unsubConn();
      unsubLobby();
      unsubSync();
      unsubGameStart();
      unsubClosed();
    };
  }, [roomId, myPlayerId, navigation]);

  const copyCode = async () => {
    try {
      haptic('success');
      play('click');
      if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(code);
      } else {
        await Share.share({ message: code });
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2400);
    } catch {
      try {
        await Share.share({ message: code });
      } catch {}
    }
  };

  const shareCode = async () => {
    try {
      haptic('light');
      play('click');
      await Share.share({
        message: `Join my LudoVudo game!\nRoom code: ${code}\nOpen LudoVudo, tap "Join Room", and enter ${code} to play together!`,
      });
    } catch {
      // ignore
    }
  };

  const handleStartGame = () => {
    if (!room || room.players.length < 2) {
      Alert.alert('Waiting for Players', 'Need at least 2 players in the lobby to start the game.');
      return;
    }
    setStarting(true);
    haptic('medium');
    play('click');
    multiplayer.startGame(roomId, myPlayerId);
  };

  const handleLeave = () => {
    Alert.alert(
      isHost ? 'Close Room?' : 'Leave Room?',
      isHost
        ? 'Closing the room will cancel the match for all connected players.'
        : 'Are you sure you want to leave this room?',
      [
        { text: 'Stay', style: 'cancel' },
        {
          text: isHost ? 'Close Room' : 'Leave',
          style: 'destructive',
          onPress: () => {
            multiplayer.leaveRoom(roomId, myPlayerId);
            navigation.navigate('Home');
          },
        },
      ],
    );
  };

  const toggleReady = () => {
    if (!myPlayer) return;
    const nextReady = !myPlayer.isReady;
    haptic('select');
    play('click');
    multiplayer.setReady(roomId, myPlayerId, nextReady);
  };

  const maxSeats = room?.maxPlayers || 4;
  const currentPlayers: RoomPlayer[] = room?.players || [
    {
      id: myPlayerId,
      name: save.profile.name || 'Player 1',
      avatar: save.profile.avatar || 'red',
      color: save.profile.avatar || 'red',
      seatIndex: 0,
      isHost: initialIsHost,
      isReady: true,
      seatId: `${save.profile.avatar || 'red'}-seat`,
      connected: true,
    },
  ];
  const canStart = isHost && currentPlayers.length >= 2 && !starting;

  const hostButtonLabel = starting
    ? 'STARTING MATCH...'
    : currentPlayers.length < 2
    ? `WAITING FOR OPPONENT (${currentPlayers.length}/${maxSeats})...`
    : `START GAME (${currentPlayers.length} PLAYERS)`;

  if (!roomId || !code) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: ui.bg, justifyContent: 'center', alignItems: 'center', padding: 24 }]}>
        <Ionicons name="alert-circle-outline" size={54} color={ui.danger} />
        <Text style={{ color: ui.text, fontSize: 18, fontWeight: '800', marginTop: 14 }}>
          No Active Room Found
        </Text>
        <Text style={{ color: ui.textDim, fontSize: 13, textAlign: 'center', marginTop: 6, marginBottom: 20 }}>
          Please create or join a room from the main menu.
        </Text>
        <Btn ui={ui} label="Back to Home" icon="home" onPress={() => navigation.navigate('Home')} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: ui.bg }]} edges={['top', 'bottom']}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* Top Header */}
      <Header
        ui={ui}
        title="Room Lobby"
        subtitle={`Code: ${code}`}
        onBack={handleLeave}
        right={
          <Press
            onPress={() => {
              if (connState !== 'connected') {
                haptic('light');
                multiplayer.reconnect();
              }
            }}
            disabled={connState === 'connected'}
          >
            <View style={[styles.connBadge, { backgroundColor: ui.surface, borderColor: ui.border }]}>
              <View
                style={[
                  styles.connDot,
                  {
                    backgroundColor:
                      connState === 'connected'
                        ? '#22C55E'
                        : connState === 'connecting' || connState === 'reconnecting'
                        ? '#F59E0B'
                        : '#EF4444',
                  },
                ]}
              />
              <Text style={[styles.connText, { color: ui.textDim }]}>
                {connState === 'connected'
                  ? 'LIVE'
                  : connState === 'connecting' || connState === 'reconnecting'
                  ? 'SYNCING'
                  : 'RECONNECT ↻'}
              </Text>
            </View>
          </Press>
        }
      />

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 30 }} showsVerticalScrollIndicator={false}>
        {/* Room Code Card */}
        <Animated.View entering={FadeInDown.duration(340)} style={[styles.codeCard, { backgroundColor: ui.surface, borderColor: ui.border }]}>
          <Text style={[styles.codeLabel, { color: ui.textDim }]}>ROOM CODE</Text>
          <Text style={[styles.codeText, { color: ui.text }]}>{code}</Text>

          <View style={styles.codeActionsRow}>
            <Btn
              ui={ui}
              variant={copied ? 'primary' : 'surface'}
              size="sm"
              icon={copied ? 'checkmark-circle' : 'copy'}
              label={copied ? 'Copied! ✓' : 'Copy Code'}
              onPress={copyCode}
              style={{ flex: 1 }}
            />
            <Btn
              ui={ui}
              variant="surface"
              size="sm"
              icon="share-social"
              label="Share"
              onPress={shareCode}
              style={{ flex: 1 }}
            />
          </View>
        </Animated.View>

        {/* Players List Section */}
        <View style={styles.sectionHead}>
          <Text style={[styles.sectionTitle, { color: ui.textDim }]}>
            PLAYERS ({currentPlayers.length}/{maxSeats})
          </Text>
          {isHost ? (
            <Text style={{ color: ui.primary, fontWeight: '800', fontSize: 12 }}>👑 You are Host</Text>
          ) : (
            <Text style={{ color: ui.textDim, fontWeight: '700', fontSize: 12 }}>Waiting for Host to start</Text>
          )}
        </View>

        {/* Seat Slots */}
        {Array.from({ length: maxSeats }).map((_, seatIdx) => {
          const player: RoomPlayer | undefined = currentPlayers[seatIdx];
          if (player) {
            const spec = (player.color && theme.players[player.color]) || theme.players.red;
            const isMe = player.id === myPlayerId;
            const playerKey = player.id ? `player-${player.id}` : `slot-${seatIdx}`;
            return (
              <Animated.View
                key={playerKey}
                entering={FadeInDown.delay(50 * seatIdx).duration(300)}
                style={[
                  styles.playerCard,
                  {
                    backgroundColor: ui.surface,
                    borderColor: isMe ? spec.main : ui.border,
                    borderWidth: isMe ? 2 : 1.5,
                  },
                ]}
              >
                <View style={[styles.avatarDot, { backgroundColor: spec.main, borderColor: spec.dark }]}>
                  <Ionicons name="person" size={18} color={spec.text} />
                </View>

                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={[styles.playerName, { color: ui.text }]} numberOfLines={1}>
                      {player.name}
                      {isMe ? ' (You)' : ''}
                    </Text>
                    {player.isHost ? (
                      <View style={[styles.hostBadge, { backgroundColor: '#FEF08A' }]}>
                        <Ionicons name="trophy" size={11} color="#854D0E" />
                        <Text style={styles.hostBadgeText}>HOST</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={[styles.playerSub, { color: ui.textDim }]}>
                    Seat {seatIdx + 1} · Playing as {player.color || 'red'}
                  </Text>
                </View>

                <View style={styles.statusCol}>
                  <View
                    style={[
                      styles.readyBadge,
                      {
                        backgroundColor: player.isReady ? 'rgba(34, 197, 94, 0.16)' : 'rgba(245, 158, 11, 0.16)',
                      },
                    ]}
                  >
                    <Ionicons
                      name={player.isReady ? 'checkmark-circle' : 'hourglass'}
                      size={14}
                      color={player.isReady ? '#22C55E' : '#F59E0B'}
                    />
                    <Text
                      style={{
                        color: player.isReady ? '#22C55E' : '#F59E0B',
                        fontWeight: '800',
                        fontSize: 11,
                      }}
                    >
                      {player.isReady ? 'READY' : 'WAITING'}
                    </Text>
                  </View>
                </View>
              </Animated.View>
            );
          }

          // Empty Slot
          return (
            <View
              key={`empty-${seatIdx}`}
              style={[
                styles.emptySlot,
                {
                  borderColor: ui.border,
                  backgroundColor: alpha(ui.surface, 0.4),
                },
              ]}
            >
              <Ionicons name="hourglass-outline" size={18} color={ui.textFaint} />
              <Text style={[styles.emptySlotText, { color: ui.textFaint }]}>
                {seatIdx === 1 ? 'Waiting for opponent to join...' : `Waiting for Player ${seatIdx + 1}...`}
              </Text>
            </View>
          );
        })}

        {/* Info Card */}
        <Card ui={ui} style={{ marginTop: 14 }}>
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            <Ionicons name="information-circle" size={20} color={ui.primary} />
            <Text style={{ color: ui.textDim, fontSize: 12, lineHeight: 17, flex: 1, fontWeight: '600' }}>
              {isHost
                ? currentPlayers.length < 2
                  ? 'Share the room code above with a friend. Once they enter the code and join, tap "Start Game" to launch the match for both of you!'
                  : 'Opponent has joined! Tap "Start Game" whenever you are ready.'
                : 'You are connected in the lobby! When the host taps "Start Game", your match will begin automatically.'}
            </Text>
          </View>
        </Card>
      </ScrollView>

      {/* Footer Controls */}
      <View style={[styles.footer, { backgroundColor: ui.bg, borderTopColor: ui.border }]}>
        {isHost ? (
          <Btn
            ui={ui}
            size="lg"
            full
            label={hostButtonLabel}
            icon={starting ? undefined : canStart ? 'play' : 'hourglass'}
            onPress={handleStartGame}
            disabled={!canStart}
          />
        ) : (
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Btn
              ui={ui}
              variant="surface"
              label="Leave Room"
              icon="exit"
              onPress={handleLeave}
              style={{ flex: 1 }}
            />
            <Btn
              ui={ui}
              variant={myPlayer?.isReady ? 'surface' : 'primary'}
              label={myPlayer?.isReady ? 'Ready ✓' : 'Set Ready'}
              icon={myPlayer?.isReady ? 'checkmark-circle' : 'thumbs-up'}
              onPress={toggleReady}
              style={{ flex: 1.5 }}
            />
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  connBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  connDot: { width: 8, height: 8, borderRadius: 4 },
  connText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  codeCard: {
    alignItems: 'center',
    borderRadius: 24,
    borderWidth: 1.5,
    padding: 20,
    marginTop: 6,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  codeLabel: { fontWeight: '900', fontSize: 11.5, letterSpacing: 1.6 },
  codeText: { fontWeight: '900', fontSize: 36, letterSpacing: 7, marginVertical: 8 },
  codeActionsRow: { flexDirection: 'row', gap: 10, marginTop: 10, alignSelf: 'stretch' },
  sectionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 22,
    marginBottom: 10,
  },
  sectionTitle: { fontWeight: '900', fontSize: 11.5, letterSpacing: 1.5 },
  playerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    padding: 13,
    marginBottom: 10,
    gap: 12,
  },
  avatarDot: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playerName: { fontSize: 15.5, fontWeight: '900', maxWidth: 170 },
  playerSub: { fontSize: 11.5, fontWeight: '600', marginTop: 2 },
  hostBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  hostBadgeText: { color: '#854D0E', fontWeight: '900', fontSize: 9.5 },
  statusCol: { alignItems: 'flex-end' },
  readyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
  },
  emptySlot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    paddingVertical: 18,
    marginBottom: 10,
  },
  emptySlotText: { fontWeight: '700', fontSize: 13.5 },
  footer: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12, borderTopWidth: 1 },
});
