import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { StatusBar } from 'expo-status-bar';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../lib/nav';
import { useStore } from '../lib/store';
import { RING_ORDER, alpha } from '../lib/theme';
import { Btn, Card, Header } from '../components/ui';
import { formatTime } from './GameScreen';

type Props = NativeStackScreenProps<RootStackParamList, 'Stats'>;

export default function StatsScreen({ navigation }: Props) {
  const { isDark, theme, save } = useStore();
  const ui = isDark ? theme.dark_ : theme.light;
  const s = save.stats;
  const winRate = s.games > 0 ? Math.round((s.wins / s.games) * 100) : 0;
  const sixRate = s.rolls > 0 ? Math.round((s.sixes / s.rolls) * 100) : 0;
  const podium = s.wins + s.seconds + s.thirds;
  const avgGame = s.games > 0 ? formatTime(s.totalTimeMs / s.games) : '—';
  const maxColor = Math.max(1, ...RING_ORDER.map((c) => s.winsByColor[c]));

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: ui.bg }]} edges={['top', 'bottom']}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Header ui={ui} title="Statistics" subtitle="Every roll, captured forever" onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        {s.games === 0 ? (
          <Animated.View entering={FadeInDown.duration(340)} style={[styles.empty, { backgroundColor: ui.surface, borderColor: ui.border }]}>
            <View style={[styles.emptyIcon, { backgroundColor: ui.surfaceAlt }]}>
              <Ionicons name="stats-chart" size={30} color={ui.primary} />
            </View>
            <Text style={{ color: ui.text, fontWeight: '900', fontSize: 18, marginTop: 12 }}>No games yet</Text>
            <Text style={{ color: ui.textDim, fontWeight: '600', fontSize: 13, textAlign: 'center', marginTop: 6, lineHeight: 19 }}>
              Play your first match and your career numbers will appear here.
            </Text>
            <Btn ui={ui} label="Play a match" icon="play" onPress={() => navigation.navigate('GameSetup', { mode: 'classic' })} style={{ marginTop: 16 }} />
          </Animated.View>
        ) : (
          <>
            <Animated.View entering={FadeInDown.duration(320)} style={styles.grid}>
              <Tile ui={ui} icon="trophy" tint={theme.players.yellow.main} label="Wins" value={`${s.wins}`} />
              <Tile ui={ui} icon="stats-chart" tint={ui.primary} label="Win rate" value={`${winRate}%`} />
              <Tile ui={ui} icon="podium" tint={theme.players.green.main} label="Podiums" value={`${podium}`} />
              <Tile ui={ui} icon="flame" tint={theme.players.red.main} label="Best streak" value={`${s.bestStreak}`} />
            </Animated.View>

            <Text style={[styles.section, { color: ui.textDim }]}>WINS BY COLOUR</Text>
            <Card ui={ui}>
              {RING_ORDER.map((c) => {
                const v = s.winsByColor[c];
                return (
                  <View key={c} style={styles.barRow}>
                    <View style={[styles.barDot, { backgroundColor: theme.players[c].main, borderColor: theme.players[c].dark }]} />
                    <Text style={{ color: ui.textDim, fontWeight: '800', fontSize: 12.5, width: 58, textTransform: 'capitalize' }}>{c}</Text>
                    <View style={[styles.barTrack, { backgroundColor: ui.border }]}>
                      <View style={{ width: `${Math.round((v / maxColor) * 100)}%`, height: '100%', backgroundColor: theme.players[c].main, borderRadius: 5 }} />
                    </View>
                    <Text style={{ color: ui.text, fontWeight: '900', fontSize: 12.5, width: 26, textAlign: 'right' }}>{v}</Text>
                  </View>
                );
              })}
            </Card>

            <Text style={[styles.section, { color: ui.textDim }]}>GAME MODES</Text>
            <Card ui={ui}>
              <ModeRow ui={ui} icon="grid" label="Classic" value={`${save.stats.modes.classic || 0}`} />
              <ModeRow ui={ui} icon="flash" label="Quick Match" value={`${save.stats.modes.quick || 0}`} />
              <ModeRow ui={ui} icon="people" label="Room (2P pass & play)" value={`${save.stats.modes.room || 0}`} />
              <ModeRow ui={ui} icon="school" label="Practice" value={`${save.stats.modes.practice || 0}`} last />
            </Card>

            <Text style={[styles.section, { color: ui.textDim }]}>DID YOU KNOW</Text>
            <Card ui={ui}>
              <ModeRow ui={ui} icon="dice" label="Dice rolls" value={`${s.rolls}`} />
              <ModeRow ui={ui} icon="sparkles" label="Sixes rolled" value={`${s.sixes} (${sixRate}%)`} />
              <ModeRow ui={ui} icon="hand-left" label="Tokens captured" value={`${s.captures}`} />
              <ModeRow ui={ui} icon="home" label="Tokens brought home" value={`${s.tokensHome}`} />
              <ModeRow ui={ui} icon="time" label="Average match" value={avgGame} />
              <ModeRow ui={ui} icon="flash" label="Fastest win" value={s.fastestWinMs ? formatTime(s.fastestWinMs) : '—'} last />
            </Card>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Tile({ ui, icon, label, value, tint }: { ui: any; icon: string; label: string; value: string; tint: string }) {
  return (
    <View style={[styles.tile, { backgroundColor: ui.surface, borderColor: ui.border }]}>
      <View style={[styles.tileIcon, { backgroundColor: alpha(tint, 0.16) }]}>
        <Ionicons name={icon as any} size={17} color={tint} />
      </View>
      <Text style={{ color: ui.text, fontWeight: '900', fontSize: 23, marginTop: 9 }}>{value}</Text>
      <Text style={{ color: ui.textDim, fontWeight: '800', fontSize: 11.5 }}>{label}</Text>
    </View>
  );
}

function ModeRow({ ui, icon, label, value, last }: { ui: any; icon: string; label: string; value: string; last?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 11, borderBottomWidth: last ? 0 : 1, borderBottomColor: ui.border }}>
      <View style={[styles.rowIcon, { backgroundColor: ui.surfaceAlt }]}>
        <Ionicons name={icon as any} size={15} color={ui.primary} />
      </View>
      <Text style={{ flex: 1, color: ui.textDim, fontWeight: '700', fontSize: 13.5, marginLeft: 11 }}>{label}</Text>
      <Text style={{ color: ui.text, fontWeight: '900', fontSize: 13.5 }}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -5 },
  tile: { width: '47.5%', marginHorizontal: 5, marginBottom: 10, padding: 15, borderRadius: 22, borderWidth: 1.5 },
  tileIcon: { width: 36, height: 36, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  section: { fontWeight: '900', fontSize: 11.5, letterSpacing: 1.6, marginTop: 20, marginBottom: 11 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 7 },
  barDot: { width: 15, height: 15, borderRadius: 8, borderWidth: 1.5 },
  barTrack: { flex: 1, height: 9, borderRadius: 5, overflow: 'hidden' },
  rowIcon: { width: 30, height: 30, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', borderRadius: 26, borderWidth: 1.5, padding: 26, marginTop: 20 },
  emptyIcon: { width: 62, height: 62, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
