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
import { alpha } from '../lib/theme';
import type { PlayerColor, RoomData, RoomPlayer, Seat } from '../lib/types';
import { Btn, Card, Header, Press } from '../components/ui';
import { multiplayer, type ConnectionState } from '../lib/multiplayer';
import { haptic, play } from '../lib/sound';

type Props = NativeStackScreenProps<RootStackParamList, 'RoomLobby'>;

export default function RoomLobbyScreen({ navigation, route }: Props) {
  const { roomId, code, isHost: initialIsHost, initialRoom } = route.params;
  const { isDark, theme, save } = useStore();
  const ui = isDark ? theme.dark_ : theme.light;

  const [room, setRoom] = useState<RoomData | null>(initialRoom || null);
  const [connState, setConnState] = useState<ConnectionState>(multiplayer.getConnectionState());
  const [starting, setStarting] = useState(false);
  const [copied, setCopied] = useState(false);

  const myPlayerId = save.profile.id || '';
  const isHost = room ? room.hostPlayerId === myPlayerId : initialIsHost;
  const myPlayer = room?.players.find((p) => p.id === myPlayerId);

  // Subscribe to real-time events
  useEffect(() => {
    // Ensure connection is established
    multiplayer.connect(myPlayerId, roomId);

    const unsubConn = multiplayer.onConnectionChange((st) => setConnState(st));

    const unsubLobby = multiplayer.onLobbyUpdated(({ room: nextRoom }) => {
      setRoom(nextRoom);
      play('click');
    });

    const unsubGameStart = multiplayer.onGameStarted((nextRoom) => {
      setStarting(true);
      play('win');
      haptic('success');
      const seats: Seat[] = nextRoom.players.map((p) => ({
        id: p.seatId,
        color: p.color,
        name: p.name,
        type: 'human',
        difficulty: 'medium',
        playerId: p.id,
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
      Alert.alert('Room Closed', reason || 'The host has closed this room.', [
        { text: 'OK', onPress: () => navigation.navigate('Home') },
      ]);
    });

    // Request full state on mount
    multiplayer.syncState(roomId, myPlayerId);

    return () => {
      unsubConn();
      unsubLobby();
      unsubGameStart();
      unsubClosed();
    };
  }, [roomId, myPlayerId, navigation]);

  const shareCode = async () => {
    try {
      haptic('light');
      play('click');
      await Share.share({
        message: `Join my LudoVudo game! Room code: ${code}\nOpen LudoVudo, tap "Join Room", and enter ${code} to play!`,
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
  const currentPlayers = room?.players || [];
  const canStart = isHost && currentPlayers.length >= 2 && !starting;

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
          <View style={[styles.connBadge, { backgroundColor: ui.surface, borderColor: ui.border }]}>
            <View
              style={[
                styles.connDot,
                {
                  backgroundColor:
                    connState === 'connected' ? '#22C55E' : connState === 'connecting' ? '#F59E0B' : '#EF4444',
                },
              ]}
            />
            <Text style={[styles.connText, { color: ui.textDim }]}>
              {connState === 'connected' ? 'LIVE' : connState === 'connecting' ? 'SYNCING' : 'OFFLINE'}
            </Text>
          </View>
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
              variant="surface"
              size="sm"
              icon="share-social"
              label="Share Code"
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
            <Text style={{ color: ui.primary, fontWeight: '800', fontSize: 12 }}>You are Host</Text>
          ) : null}
        </View>

        {/* Seat Slots */}
        {Array.from({ length: maxSeats }).map((_, seatIdx) => {
          const player: RoomPlayer | undefined = currentPlayers[seatIdx];
          if (player) {
            const spec = theme.players[player.color];
            const isMe = player.id === myPlayerId;
            return (
              <Animated.View
                key={player.id}
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
                    Seat {seatIdx + 1} · Playing as {player.color}
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
              <Ionicons name="person-add" size={18} color={ui.textFaint} />
              <Text style={[styles.emptySlotText, { color: ui.textFaint }]}>
                Waiting for Player {seatIdx + 1}...
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
                ? 'Share the room code with friends. Once at least 2 players have joined, tap "Start Game" to launch the match for everyone!'
                : 'Waiting for the host to start the match. Make sure your device stays connected.'}
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
            label={starting ? 'STARTING MATCH...' : 'START GAME'}
            icon="play"
            onPress={handleStartGame}
            disabled={!canStart}
          />
        ) : (
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Btn
              ui={ui}
              variant="surface"
              label="Leave"
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
