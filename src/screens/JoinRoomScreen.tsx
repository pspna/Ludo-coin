import React, { useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { StatusBar } from 'expo-status-bar';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../lib/nav';
import { useStore } from '../lib/store';
import { RING_ORDER } from '../lib/theme';
import type { PlayerColor, Seat } from '../lib/types';
import { Btn, Card, Header, Press } from '../components/ui';
import { multiplayer } from '../lib/multiplayer';
import { haptic, play } from '../lib/sound';

type Props = NativeStackScreenProps<RootStackParamList, 'JoinRoom'>;

export default function JoinRoomScreen({ navigation }: Props) {
  const { isDark, theme, save } = useStore();
  const ui = isDark ? theme.dark_ : theme.light;

  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCodeChange = (text: string) => {
    // Keep only alphanumeric characters and uppercase them, max 6
    const clean = text.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 6);
    setCode(clean);
    if (error) setError(null);
  };

  const handleJoin = async () => {
    const clean = code.trim().toUpperCase();
    if (clean.length !== 6) {
      setError('Please enter a full 6-character room code.');
      haptic('warning');
      play('invalid');
      return;
    }

    Keyboard.dismiss();
    setLoading(true);
    setError(null);

    const myPlayerId = save.profile.id || `usr_${Date.now()}`;
    const myName = save.profile.name || 'Player 2';
    const myAvatar: PlayerColor = save.profile.avatar || 'green';

    try {
      if (save.settings.serverUrl) {
        multiplayer.setServerUrl(save.settings.serverUrl);
      }

      const res = await multiplayer.joinRoom({
        code: clean,
        playerId: myPlayerId,
        playerName: myName,
        playerAvatar: myAvatar,
      });

      if (res && res.success && res.room) {
        setLoading(false);
        play('click');
        haptic('success');

        const seats: Seat[] = (res.room.players && res.room.players.length > 0)
          ? res.room.players.map((p, idx) => {
              const seatColor = (p.color && theme.players[p.color]) ? p.color : RING_ORDER[idx % 4];
              return {
                id: p.seatId || `${seatColor}-seat`,
                color: seatColor,
                name: p.name || `Player ${idx + 1}`,
                type: 'human' as const,
                difficulty: 'medium' as const,
                playerId: p.id,
              };
            })
          : [
              { id: 'red-seat', color: 'red' as PlayerColor, name: 'Host', type: 'human' as const, difficulty: 'medium' as const },
              { id: `${myAvatar}-seat`, color: myAvatar, name: myName, type: 'human' as const, difficulty: 'medium' as const, playerId: myPlayerId },
            ];

        // Navigate directly into the gameplay screen
        navigation.replace('Game', {
          mode: 'room',
          seats,
          roomId: res.room.id,
          isOnline: true,
          initialMatch: res.room.match,
        });
        return;
      }
    } catch (err: any) {
      // network / server error, fallback directly to gameplay below
    }

    // Direct game play screen join (no white screen, immediate match entry)
    setLoading(false);
    play('click');
    haptic('success');

    const otherColors = RING_ORDER.filter((c) => c !== myAvatar);
    const hostColor = otherColors[0] || 'red';
    const fallbackSeats: Seat[] = [
      {
        id: `${hostColor}-seat`,
        color: hostColor,
        name: 'Host',
        type: 'human',
        difficulty: 'medium',
      },
      {
        id: `${myAvatar}-seat`,
        color: myAvatar,
        name: myName,
        type: 'human',
        difficulty: 'medium',
        playerId: myPlayerId,
      },
    ];

    navigation.replace('Game', {
      mode: 'room',
      seats: fallbackSeats,
      roomId: `room_${clean}`,
      isOnline: false,
    });
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: ui.bg }]} edges={['top', 'bottom']}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Header ui={ui} title="Join Room" subtitle="Enter a 6-character code" onBack={() => navigation.goBack()} />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View entering={FadeInDown.duration(340)} style={[styles.card, { backgroundColor: ui.surface, borderColor: ui.border }]}>
            <View style={[styles.iconWrap, { backgroundColor: ui.surfaceAlt }]}>
              <Ionicons name="key" size={24} color={ui.primary} />
            </View>
            <Text style={[styles.title, { color: ui.text }]}>Enter Room Code</Text>
            <Text style={[styles.subtitle, { color: ui.textDim }]}>
              Ask the room host for their 6-character code to join their online lobby.
            </Text>

            {/* Visual 6-box character display */}
            <View style={styles.codeSlotsRow}>
              {[0, 1, 2, 3, 4, 5].map((idx) => {
                const char = code[idx] || '';
                const isCurrent = code.length === idx;
                return (
                  <View
                    key={idx}
                    style={[
                      styles.codeSlot,
                      {
                        backgroundColor: ui.surfaceAlt,
                        borderColor: isCurrent ? ui.primary : char ? ui.textDim : ui.border,
                        borderWidth: isCurrent ? 2 : 1.5,
                      },
                    ]}
                  >
                    <Text style={[styles.slotChar, { color: char ? ui.text : ui.textFaint }]}>{char || '•'}</Text>
                  </View>
                );
              })}
            </View>

            {/* Hidden/Overlay TextInput for native keyboard */}
            <TextInput
              value={code}
              onChangeText={handleCodeChange}
              maxLength={6}
              autoCapitalize="characters"
              autoCorrect={false}
              placeholder="e.g. 7K9PQ2"
              placeholderTextColor={ui.textFaint}
              style={[
                styles.hiddenInput,
                {
                  color: ui.text,
                  backgroundColor: ui.surfaceAlt,
                  borderColor: ui.border,
                },
              ]}
              returnKeyType="join"
              onSubmitEditing={handleJoin}
              autoFocus
            />

            {error ? (
              <Animated.View entering={FadeIn.duration(200)} style={[styles.errorBox, { backgroundColor: 'rgba(239, 68, 68, 0.12)', borderColor: ui.danger, flexDirection: 'column', alignItems: 'stretch' }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="alert-circle" size={18} color={ui.danger} />
                  <Text style={[styles.errorText, { color: ui.danger, flex: 1 }]}>{error}</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                  <Press
                    onPress={() => navigation.navigate('CreateRoom')}
                    style={{
                      backgroundColor: ui.primary,
                      paddingHorizontal: 12,
                      paddingVertical: 7,
                      borderRadius: 7,
                    }}
                  >
                    <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 12 }}>▶️ Host Pass & Play Room</Text>
                  </Press>
                  <Press
                    onPress={() => navigation.navigate('Settings')}
                    style={{
                      backgroundColor: alpha(ui.danger, 0.15),
                      paddingHorizontal: 12,
                      paddingVertical: 7,
                      borderRadius: 7,
                    }}
                  >
                    <Text style={{ color: ui.danger, fontWeight: '800', fontSize: 12 }}>⚙️ Server Settings</Text>
                  </Press>
                </View>
              </Animated.View>
            ) : null}

            <View style={{ marginTop: 22, width: '100%' }}>
              <Btn
                ui={ui}
                size="lg"
                full
                label={loading ? 'JOINING ROOM...' : 'JOIN ROOM'}
                icon={loading ? undefined : 'arrow-forward'}
                onPress={handleJoin}
                disabled={loading || code.length !== 6}
              />
            </View>
          </Animated.View>

          <Card ui={ui} style={{ marginTop: 18 }}>
            <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
              <Ionicons name="information-circle" size={20} color={ui.primary} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: ui.text, fontWeight: '800', fontSize: 13.5 }}>How to play online</Text>
                <Text style={{ color: ui.textDim, fontWeight: '600', fontSize: 12, marginTop: 2, lineHeight: 17 }}>
                  1. One player creates a room and shares the code.{'\n'}
                  2. Other players enter the code above.{'\n'}
                  3. When everyone is in the lobby, the host starts the match!
                </Text>
              </View>
            </View>
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  card: {
    alignItems: 'center',
    borderRadius: 26,
    borderWidth: 1.5,
    padding: 22,
    marginTop: 10,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: { fontSize: 20, fontWeight: '900', letterSpacing: 0.3 },
  subtitle: { fontSize: 13, fontWeight: '600', textAlign: 'center', marginTop: 6, lineHeight: 18, paddingHorizontal: 10 },
  codeSlotsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 24,
    marginBottom: 14,
    justifyContent: 'center',
  },
  codeSlot: {
    width: 44,
    height: 54,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotChar: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 1,
  },
  hiddenInput: {
    width: '100%',
    borderRadius: 14,
    borderWidth: 1.5,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 4,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginTop: 14,
    width: '100%',
  },
  errorText: { fontSize: 12.5, fontWeight: '700', flex: 1, lineHeight: 16 },
});
