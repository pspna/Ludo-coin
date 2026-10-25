import React, { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { StatusBar } from 'expo-status-bar';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../lib/nav';
import { useStore } from '../lib/store';
import { RING_ORDER, alpha, contrastText } from '../lib/theme';
import type { Difficulty, GameMode, PlayerColor, Seat } from '../lib/types';
import { Btn, Header, Press } from '../components/ui';
import { DIFFICULTIES } from '../lib/ai';

type Props = NativeStackScreenProps<RootStackParamList, 'GameSetup'>;

const CPU_NAMES = ['Ava', 'Rex', 'Mira', 'Zane', 'Nova', 'Kai', 'Luna', 'Otto'];

function makeSeat(color: PlayerColor, type: 'human' | 'cpu', name: string, difficulty: Difficulty = 'medium'): Seat {
  return { id: `${color}-seat`, color, name, type, difficulty };
}

function seatsFor(mode: GameMode, count: number, playerName: string): Seat[] {
  if (mode === 'practice') return [makeSeat('red', 'human', playerName)];
  const list: Seat[] = [makeSeat('red', 'human', playerName)];
  const total = mode === 'quick' ? 2 : count;
  let cpuIndex = 0;
  for (let i = 1; i < total; i++) {
    const color = RING_ORDER[i];
    list.push(makeSeat(color, 'cpu', CPU_NAMES[cpuIndex % CPU_NAMES.length], mode === 'quick' ? 'medium' : 'medium'));
    cpuIndex++;
  }
  return list;
}

const MODE_INFO: Record<GameMode, { title: string; desc: string; icon: string }> = {
  classic: { title: 'Classic', desc: 'The full experience. First to bring all four tokens home takes the crown.', icon: 'grid' },
  quick: { title: 'Quick Match', desc: 'A fast 1v1 against a Medium computer. Perfect for a coffee break.', icon: 'flash' },
  practice: { title: 'Practice', desc: 'No opponents, no pressure. Learn the paths, safe squares and home lanes.', icon: 'school' },
  room: { title: 'Create Room', desc: 'Two players, one device — pass it across when the turn changes.', icon: 'people' },
};

export default function GameSetupScreen({ navigation, route }: Props) {
  const mode = route.params?.mode ?? 'classic';
  const { isDark, theme, save } = useStore();
  const ui = isDark ? theme.dark_ : theme.light;

  const [count, setCount] = useState(2);
  const [seats, setSeats] = useState<Seat[]>(() => seatsFor(mode, 2, save.profile.name));
  const [pickerFor, setPickerFor] = useState<number | null>(null);

  const humanSeats = seats.filter((s) => s.type === 'human').length;
  const info = MODE_INFO[mode];

  const patch = (i: number, p: Partial<Seat>) =>
    setSeats((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...p } : s)));

  const swapColor = (i: number, color: PlayerColor) => {
    setSeats((prev) => {
      const other = prev.findIndex((s, idx) => idx !== i && s.color === color);
      const next = [...prev];
      if (other >= 0) {
        const tmp = next[i].color;
        next[i] = { ...next[i], color };
        next[other] = { ...next[other], color: tmp };
      } else {
        next[i] = { ...next[i], color };
      }
      return next;
    });
    setPickerFor(null);
  };

  const changeCount = (n: number) => {
    setCount(n);
    setSeats(seatsFor(mode, n, save.profile.name));
  };

  const start = () => {
    navigation.navigate('Game', { mode, seats });
  };

  const canStart = seats.length >= 1 && seats.every((s) => s.name.trim().length > 0);

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: ui.bg }]} edges={['top', 'bottom']}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Header ui={ui} title="New Match" subtitle={info.title} onBack={() => navigation.goBack()} />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Animated.View entering={FadeInDown.duration(340)} style={[styles.hero, { backgroundColor: ui.surface, borderColor: ui.border }]}>
            <View style={[styles.heroIcon, { backgroundColor: ui.surfaceAlt }]}>
              <Ionicons name={info.icon as any} size={22} color={ui.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.heroTitle, { color: ui.text }]}>{info.title}</Text>
              <Text style={[styles.heroDesc, { color: ui.textDim }]}>{info.desc}</Text>
            </View>
          </Animated.View>

          {mode === 'classic' ? (
            <>
              <Text style={[styles.label, { color: ui.textDim }]}>PLAYERS</Text>
              <View style={styles.countRow}>
                {[2, 3, 4].map((n) => {
                  const on = count === n;
                  return (
                    <Press key={n} onPress={() => changeCount(n)} style={{ flex: 1 }}>
                      <View style={[styles.countPill, { backgroundColor: on ? ui.primary : ui.surface, borderColor: on ? ui.primary : ui.border }]}>
                        <Ionicons name="people" size={15} color={on ? ui.onPrimary : ui.textDim} />
                        <Text style={[styles.countText, { color: on ? ui.onPrimary : ui.text }]}>{n} Players</Text>
                      </View>
                    </Press>
                  );
                })}
              </View>
            </>
          ) : null}

          <Text style={[styles.label, { color: ui.textDim }]}>THE TABLE</Text>
          {humanSeats > 1 ? (
            <View style={[styles.rulesCard, { backgroundColor: ui.surfaceAlt, borderColor: ui.border, marginTop: 0, marginBottom: 4 }]}>
              <Ionicons name="phone-portrait" size={17} color={ui.primary} />
              <Text style={[styles.rules, { color: ui.textDim }]}>
                {humanSeats} friends are sharing this device. Pass it across whenever the turn changes.
              </Text>
            </View>
          ) : null}

          {seats.map((seat, i) => {
            const spec = theme.players[seat.color];
            const isHost = i === 0;
            const isHuman = seat.type === 'human';
            return (
              <Animated.View key={seat.id} entering={FadeInDown.delay(60 * i).duration(340)} style={[styles.seatCard, { backgroundColor: ui.surface, borderColor: ui.border }]}>
                <Press onPress={() => setPickerFor(i)} style={styles.colorBtn}>
                  <View style={[styles.colorDot, { backgroundColor: spec.main, borderColor: spec.dark, shadowColor: spec.main }]}>
                    <Ionicons name={isHuman ? 'person' : 'hardware-chip'} size={17} color={spec.text} />
                  </View>
                </Press>

                <View style={{ flex: 1 }}>
                  <View style={styles.nameRow}>
                    <TextInput
                      value={seat.name}
                      onChangeText={(t) => patch(i, { name: t.slice(0, 14) })}
                      placeholder="Name"
                      placeholderTextColor={ui.textFaint}
                      maxLength={14}
                      style={[styles.nameInput, { color: ui.text, borderBottomColor: ui.border }]}
                      returnKeyType="done"
                    />
                    <View style={[styles.badge, { backgroundColor: isHuman ? alpha(spec.main, 0.16) : ui.surfaceAlt }]}>
                      <Text style={{ color: isHuman ? spec.main : ui.textDim, fontWeight: '900', fontSize: 11 }}>{isHost ? 'YOU' : isHuman ? 'FRIEND' : 'CPU'}</Text>
                    </View>
                  </View>

                  {isHost ? (
                    <Text style={[styles.hint, { color: ui.textFaint }]}>Playing as {seat.color}</Text>
                  ) : isHuman ? (
                    <View style={styles.friendRow}>
                      <Text style={[styles.hint, { color: ui.textFaint, marginTop: 0, flex: 1 }]}>Pass-and-play friend · plays as {seat.color}</Text>
                      <Press onPress={() => patch(i, { type: 'cpu', difficulty: 'medium' })}>
                        <View style={[styles.smallPill, { backgroundColor: ui.surfaceAlt, borderColor: ui.border }]}>
                          <Text style={{ color: ui.textDim, fontWeight: '800', fontSize: 11 }}>Make CPU</Text>
                        </View>
                      </Press>
                    </View>
                  ) : (
                    <>
                      <View style={styles.diffRow}>
                        {DIFFICULTIES.map((d) => {
                          const on = seat.difficulty === d.id;
                          return (
                            <Press key={d.id} onPress={() => patch(i, { difficulty: d.id })} style={{ flex: 1 }}>
                              <View style={[styles.diffPill, { backgroundColor: on ? spec.main : ui.surfaceAlt, borderColor: on ? spec.dark : ui.border }]}>
                                <Text style={{ color: on ? spec.text : ui.textDim, fontWeight: '800', fontSize: 11.5 }}>{d.name}</Text>
                              </View>
                            </Press>
                          );
                        })}
                      </View>
                      <Press onPress={() => patch(i, { type: 'human', name: `Friend ${i + 1}` })}>
                        <Text style={{ color: ui.primary, fontWeight: '800', fontSize: 11, marginTop: 7 }}>Swap for a friend playing on this device →</Text>
                      </Press>
                    </>
                  )}
                </View>

                {seats.length > 1 && mode === 'classic' && !isHost ? (
                  <Press onPress={() => setSeats((prev) => prev.filter((_, idx) => idx !== i))} style={styles.removeBtn} hitSlop={8}>
                    <Ionicons name="close-circle" size={20} color={ui.textFaint} />
                  </Press>
                ) : null}
              </Animated.View>
            );
          })}

          {mode === 'classic' && seats.length < 4 ? (
            <Press
              onPress={() => {
                const color = RING_ORDER.find((c) => !seats.some((s) => s.color === c));
                if (!color) return;
                setSeats((prev) => [...prev, makeSeat(color, 'cpu', CPU_NAMES[prev.length % CPU_NAMES.length])]);
              }}
            >
              <View style={[styles.addCard, { borderColor: ui.border, borderStyle: 'dashed' }]}>
                <Ionicons name="add-circle" size={19} color={ui.primary} />
                <Text style={{ color: ui.primary, fontWeight: '800', fontSize: 14, marginLeft: 8 }}>Add computer player</Text>
              </View>
            </Press>
          ) : null}

          <View style={[styles.rulesCard, { backgroundColor: ui.surfaceAlt, borderColor: ui.border }]}>
            <Ionicons name="information-circle" size={17} color={ui.primary} />
            <Text style={[styles.rules, { color: ui.textDim }]}>
              Roll a 6 to leave your base. Land on an opponent to send it home — but the starred squares are safe. Roll a 6, capture a token or bring one home to play again.
            </Text>
          </View>
        </ScrollView>

        <View style={[styles.footer, { backgroundColor: ui.bg, borderTopColor: ui.border }]}>
          <Btn ui={ui} size="lg" full label="START MATCH" icon="play" onPress={start} disabled={!canStart} />
        </View>
      </KeyboardAvoidingView>

      {pickerFor !== null ? (
        <Animated.View entering={FadeIn.duration(180)} style={[StyleSheet.absoluteFill, { backgroundColor: ui.overlay, justifyContent: 'flex-end' }]}>
          <Press onPress={() => setPickerFor(null)} style={StyleSheet.absoluteFill} sound={false}>
            <View style={StyleSheet.absoluteFill} />
          </Press>
          <View style={[styles.sheet, { backgroundColor: ui.surface, borderTopColor: ui.border }]}>
            <Text style={[styles.sheetTitle, { color: ui.text }]}>Choose colour</Text>
            <Text style={[styles.sheetSub, { color: ui.textDim }]}>Seats swap colours automatically.</Text>
            <View style={styles.colorGrid}>
              {RING_ORDER.map((c) => {
                const spec = theme.players[c];
                const taken = seats.some((s, idx) => idx !== pickerFor && s.color === c);
                return (
                  <Press key={c} onPress={() => swapColor(pickerFor, c)} style={{ flex: 1 }}>
                    <View style={[styles.colorOption, { backgroundColor: spec.main, borderColor: spec.dark, opacity: taken ? 0.55 : 1 }]}>
                      <Ionicons name={taken ? 'swap-horizontal' : 'checkmark'} size={20} color={spec.text} />
                      <Text style={{ color: spec.text, fontWeight: '900', fontSize: 12, marginTop: 4, textTransform: 'capitalize' }}>{c}</Text>
                    </View>
                  </Press>
                );
              })}
            </View>
            <Btn ui={ui} label="Close" variant="surface" full onPress={() => setPickerFor(null)} style={{ marginTop: 14 }} />
          </View>
        </Animated.View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  hero: { flexDirection: 'row', alignItems: 'center', borderRadius: 22, borderWidth: 1.5, padding: 15, gap: 13, marginTop: 6 },
  heroIcon: { width: 46, height: 46, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  heroTitle: { fontSize: 17, fontWeight: '900' },
  heroDesc: { fontSize: 12.5, fontWeight: '600', marginTop: 3, lineHeight: 17 },
  label: { fontWeight: '900', fontSize: 11.5, letterSpacing: 1.5, marginTop: 22, marginBottom: 10 },
  countRow: { flexDirection: 'row', gap: 9 },
  countPill: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingVertical: 12, borderRadius: 15, borderWidth: 1.5 },
  countText: { fontWeight: '900', fontSize: 13.5 },
  seatCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 22, borderWidth: 1.5, padding: 13, marginBottom: 11, gap: 12 },
  colorBtn: { padding: 2 },
  colorDot: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', borderWidth: 2, shadowOpacity: 0.5, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 4 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  nameInput: { flex: 1, fontSize: 16, fontWeight: '800', paddingVertical: 4, borderBottomWidth: 1.5 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  hint: { fontSize: 11.5, fontWeight: '700', marginTop: 7 },
  diffRow: { flexDirection: 'row', gap: 6, marginTop: 8 },
  diffPill: { alignItems: 'center', paddingVertical: 6, borderRadius: 10, borderWidth: 1 },
  friendRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  smallPill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, borderWidth: 1 },
  removeBtn: { padding: 4 },
  addCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderRadius: 18, paddingVertical: 14, marginBottom: 6 },
  rulesCard: { flexDirection: 'row', gap: 10, borderRadius: 18, borderWidth: 1, padding: 14, marginTop: 18 },
  rules: { flex: 1, fontSize: 12, lineHeight: 17.5, fontWeight: '600' },
  footer: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12, borderTopWidth: 1 },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 22, paddingBottom: 30, borderTopWidth: 2 },
  sheetTitle: { fontSize: 19, fontWeight: '900' },
  sheetSub: { fontSize: 12.5, fontWeight: '600', marginTop: 4 },
  colorGrid: { flexDirection: 'row', gap: 10, marginTop: 18 },
  colorOption: { alignItems: 'center', justifyContent: 'center', paddingVertical: 18, borderRadius: 20, borderWidth: 2 },
});
