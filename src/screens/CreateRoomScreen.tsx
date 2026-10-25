import React, { useState } from 'react';
import {
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
import { RING_ORDER, alpha } from '../lib/theme';
import type { PlayerColor, Seat } from '../lib/types';
import { Btn, Card, Header, Press } from '../components/ui';
import { multiplayer } from '../lib/multiplayer';
import { haptic, play } from '../lib/sound';

type Props = NativeStackScreenProps<RootStackParamList, 'CreateRoom'>;

export default function CreateRoomScreen({ navigation }: Props) {
  const { isDark, theme, save, setName } = useStore();
  const ui = isDark ? theme.dark_ : theme.light;

  const [roomMode, setRoomMode] = useState<'pass_play' | 'online'>('pass_play');
  const [name, setHostName] = useState(save.profile.name || 'Player');
  const [maxPlayers, setMaxPlayers] = useState<2 | 3 | 4>(4);
  const [selectedColor, setSelectedColor] = useState<PlayerColor>(save.profile.avatar || 'red');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startPassAndPlayRoom = () => {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const otherColors = RING_ORDER.filter((c) => c !== selectedColor);
    const seats: Seat[] = [
      {
        id: `${selectedColor}-seat`,
        color: selectedColor,
        name: name.trim() || save.profile.name || 'Player 1',
        type: 'human',
        difficulty: 'medium',
        playerId: save.profile.id || `usr_${Date.now()}`,
      },
    ];

    for (let i = 1; i < maxPlayers; i++) {
      const c = otherColors[i - 1];
      seats.push({
        id: `${c}-seat`,
        color: c,
        name: `Player ${i + 1}`,
        type: 'human',
        difficulty: 'medium',
      });
    }

    play('click');
    haptic('success');
    navigation.replace('Game', {
      mode: 'room',
      seats,
      roomId: `room_${code}`,
      isOnline: false,
    });
  };

  const handleCreateRoom = async () => {
    if (!name.trim()) {
      setError('Please enter your name.');
      return;
    }

    if (name.trim() !== save.profile.name) {
      setName(name.trim());
    }

    if (roomMode === 'pass_play') {
      startPassAndPlayRoom();
      return;
    }

    setLoading(true);
    setError(null);
    haptic('medium');
    play('click');

    try {
      if (save.settings.serverUrl) {
        multiplayer.setServerUrl(save.settings.serverUrl);
      }

      const res = await multiplayer.createRoom({
        hostId: save.profile.id || `usr_${Date.now()}`,
        hostName: name.trim(),
        hostAvatar: selectedColor,
        hostColor: selectedColor,
        maxPlayers,
      });

      setLoading(false);

      if (!res.success || !res.room) {
        setError(res.error || 'Failed to create online room. Please try again.');
        haptic('warning');
        play('invalid');
        return;
      }

      play('click');
      haptic('success');

      const seats: Seat[] = (res.room.players && res.room.players.length > 0)
        ? res.room.players.map((p, idx) => ({
            id: p.seatId || `${p.color || RING_ORDER[idx % 4]}-seat`,
            color: (p.color && theme.players[p.color]) ? p.color : RING_ORDER[idx % 4],
            name: p.name || `Player ${idx + 1}`,
            type: 'human' as const,
            difficulty: 'medium' as const,
            playerId: p.id,
          }))
        : [
            {
              id: `${selectedColor}-seat`,
              color: selectedColor,
              name: name.trim() || save.profile.name || 'Player 1',
              type: 'human' as const,
              difficulty: 'medium' as const,
              playerId: save.profile.id,
            },
          ];

      navigation.replace('Game', {
        mode: 'room',
        seats,
        roomId: res.room.id,
        isOnline: true,
        initialMatch: res.room.match,
      });
    } catch (err: any) {
      setLoading(false);
      setError(err?.message || 'Failed to connect to server.');
      haptic('warning');
      play('invalid');
    }
  };

  const spec = theme.players[selectedColor];

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: ui.bg }]} edges={['top', 'bottom']}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Header
        ui={ui}
        title={roomMode === 'pass_play' ? "Pass & Play Room" : "Host Online Room"}
        subtitle={roomMode === 'pass_play' ? "Play on this device · No server required" : "Play with friends across devices"}
        onBack={() => navigation.goBack()}
      />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {/* Room Mode Selector */}
          <View style={{ flexDirection: 'row', backgroundColor: ui.surface, borderRadius: 12, padding: 4, borderWidth: 1, borderColor: ui.border, marginBottom: 14 }}>
            <Press
              onPress={() => {
                setRoomMode('pass_play');
                setError(null);
                haptic('light');
              }}
              style={{ flex: 1 }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  paddingVertical: 10,
                  borderRadius: 9,
                  backgroundColor: roomMode === 'pass_play' ? ui.primary : 'transparent',
                }}
              >
                <Ionicons name="phone-portrait-outline" size={16} color={roomMode === 'pass_play' ? '#FFF' : ui.textDim} />
                <Text style={{ fontWeight: '800', fontSize: 13, color: roomMode === 'pass_play' ? '#FFF' : ui.textDim }}>
                  Pass & Play
                </Text>
              </View>
            </Press>

            <Press
              onPress={() => {
                setRoomMode('online');
                setError(null);
                haptic('light');
              }}
              style={{ flex: 1 }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  paddingVertical: 10,
                  borderRadius: 9,
                  backgroundColor: roomMode === 'online' ? ui.primary : 'transparent',
                }}
              >
                <Ionicons name="globe-outline" size={16} color={roomMode === 'online' ? '#FFF' : ui.textDim} />
                <Text style={{ fontWeight: '800', fontSize: 13, color: roomMode === 'online' ? '#FFF' : ui.textDim }}>
                  Online Room
                </Text>
              </View>
            </Press>
          </View>

          <Animated.View entering={FadeInDown.duration(340)} style={[styles.hero, { backgroundColor: ui.surface, borderColor: ui.border }]}>
            <View style={[styles.heroIcon, { backgroundColor: ui.surfaceAlt }]}>
              <Ionicons name={roomMode === 'pass_play' ? "phone-portrait" : "globe-outline"} size={24} color={ui.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.heroTitle, { color: ui.text }]}>
                {roomMode === 'pass_play' ? "Same-Device Pass & Play" : "Host Online Match"}
              </Text>
              <Text style={[styles.heroDesc, { color: ui.textDim }]}>
                {roomMode === 'pass_play'
                  ? "Take turns with friends right on this device. Works anywhere without network setup."
                  : "A real 6-character room code will be generated for friends on other devices to join."}
              </Text>
            </View>
          </Animated.View>

          {/* Host Name Input */}
          <Text style={[styles.label, { color: ui.textDim }]}>YOUR NAME</Text>
          <Animated.View entering={FadeInDown.delay(50).duration(340)} style={[styles.inputCard, { backgroundColor: ui.surface, borderColor: ui.border }]}>
            <View style={[styles.colorDot, { backgroundColor: spec.main, borderColor: spec.dark }]}>
              <Ionicons name="person" size={17} color={spec.text} />
            </View>
            <TextInput
              value={name}
              onChangeText={(t) => {
                setHostName(t.slice(0, 14));
                if (error) setError(null);
              }}
              placeholder="Your Name"
              placeholderTextColor={ui.textFaint}
              maxLength={14}
              style={[styles.nameInput, { color: ui.text }]}
              returnKeyType="done"
            />
          </Animated.View>

          {/* Max Players Selection */}
          <Text style={[styles.label, { color: ui.textDim }]}>TABLE CAPACITY</Text>
          <View style={styles.capacityRow}>
            {([2, 3, 4] as const).map((count) => {
              const on = maxPlayers === count;
              return (
                <Press key={count} onPress={() => setMaxPlayers(count)} style={{ flex: 1 }}>
                  <View
                    style={[
                      styles.capacityPill,
                      {
                        backgroundColor: on ? ui.primary : ui.surface,
                        borderColor: on ? ui.primary : ui.border,
                      },
                    ]}
                  >
                    <Ionicons name="people" size={16} color={on ? ui.onPrimary : ui.textDim} />
                    <Text style={[styles.capacityText, { color: on ? ui.onPrimary : ui.text }]}>{count} Players</Text>
                  </View>
                </Press>
              );
            })}
          </View>

          {/* Color Selection */}
          <Text style={[styles.label, { color: ui.textDim }]}>CHOOSE YOUR PIECE COLOUR</Text>
          <View style={styles.colorRow}>
            {RING_ORDER.map((color) => {
              const itemSpec = theme.players[color];
              const isSelected = selectedColor === color;
              return (
                <Press key={color} onPress={() => setSelectedColor(color)} style={{ flex: 1 }}>
                  <View
                    style={[
                      styles.colorOption,
                      {
                        backgroundColor: itemSpec.main,
                        borderColor: isSelected ? '#FFFFFF' : itemSpec.dark,
                        borderWidth: isSelected ? 3 : 1.5,
                        shadowColor: itemSpec.main,
                        elevation: isSelected ? 6 : 2,
                      },
                    ]}
                  >
                    <Ionicons name={isSelected ? 'checkmark-circle' : 'ellipse'} size={20} color={itemSpec.text} />
                    <Text style={{ color: itemSpec.text, fontWeight: '900', fontSize: 12, marginTop: 4, textTransform: 'capitalize' }}>
                      {color}
                    </Text>
                  </View>
                </Press>
              );
            })}
          </View>

          {error ? (
            <Animated.View entering={FadeIn.duration(200)} style={[styles.errorBox, { backgroundColor: 'rgba(239, 68, 68, 0.12)', borderColor: ui.danger, flexDirection: 'column', alignItems: 'stretch' }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="alert-circle" size={18} color={ui.danger} />
                <Text style={[styles.errorText, { color: ui.danger, flex: 1 }]}>{error}</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                <Press
                  onPress={startPassAndPlayRoom}
                  style={{
                    backgroundColor: ui.primary,
                    paddingHorizontal: 12,
                    paddingVertical: 7,
                    borderRadius: 7,
                  }}
                >
                  <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 12 }}>▶️ Play as Pass & Play Instead</Text>
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

          <Card ui={ui} style={{ marginTop: 20 }}>
            <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
              <Ionicons name="flash" size={20} color={ui.primary} />
              <Text style={{ color: ui.textDim, fontSize: 12, lineHeight: 17, flex: 1, fontWeight: '600' }}>
                {roomMode === 'pass_play'
                  ? "Pass & Play lets everyone play on this device taking turns. No server or network required!"
                  : "Creating an online room generates a code for friends on other devices. Requires your backend server running on Render or Railway."}
              </Text>
            </View>
          </Card>
        </ScrollView>

        <View style={[styles.footer, { backgroundColor: ui.bg, borderTopColor: ui.border }]}>
          <Btn
            ui={ui}
            size="lg"
            full
            label={
              loading
                ? 'CONNECTING TO SERVER...'
                : roomMode === 'pass_play'
                ? 'START PASS & PLAY MATCH'
                : 'CREATE ONLINE ROOM'
            }
            icon={loading ? undefined : roomMode === 'pass_play' ? 'play' : 'globe'}
            onPress={handleCreateRoom}
            disabled={loading || !name.trim()}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 22,
    borderWidth: 1.5,
    padding: 15,
    gap: 13,
    marginTop: 6,
  },
  heroIcon: { width: 46, height: 46, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  heroTitle: { fontSize: 17, fontWeight: '900' },
  heroDesc: { fontSize: 12.5, fontWeight: '600', marginTop: 3, lineHeight: 17 },
  label: { fontWeight: '900', fontSize: 11.5, letterSpacing: 1.5, marginTop: 20, marginBottom: 10 },
  inputCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 12,
  },
  colorDot: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  nameInput: { flex: 1, fontSize: 16, fontWeight: '800', paddingVertical: 4 },
  capacityRow: { flexDirection: 'row', gap: 9 },
  capacityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  capacityText: { fontWeight: '900', fontSize: 13.5 },
  colorRow: { flexDirection: 'row', gap: 9 },
  colorOption: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 18,
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
  },
  errorText: { fontSize: 12.5, fontWeight: '700', flex: 1, lineHeight: 16 },
  footer: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12, borderTopWidth: 1 },
});
