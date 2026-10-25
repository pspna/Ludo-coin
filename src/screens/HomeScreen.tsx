import React, { useEffect } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming, Easing } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../lib/nav';
import { useStore } from '../lib/store';
import { shade } from '../lib/theme';
import { ACHIEVEMENTS, achievementValue } from '../lib/storage';
import { Btn, Press } from '../components/ui';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

type ModeKey = 'create_room' | 'join_room' | 'classic' | 'quick' | 'practice';

const MODES: { key: ModeKey; title: string; desc: string; icon: string; colors: string[] }[] = [
  { key: 'create_room', title: 'Create Room', desc: 'Host live match · 6-digit code', icon: 'add-circle', colors: ['#22C55E', '#15803D'] },
  { key: 'join_room', title: 'Join Room', desc: 'Enter code · join lobby', icon: 'enter', colors: ['#06B6D4', '#0E7490'] },
  { key: 'classic', title: 'Classic Match', desc: '2–4 players · pass & play/CPU', icon: 'grid', colors: ['#7C3AED', '#4C1D95'] },
  { key: 'quick', title: 'Quick Match', desc: 'Fast 1v1 vs computer', icon: 'flash', colors: ['#F59E0B', '#B45309'] },
  { key: 'practice', title: 'Practice Solo', desc: 'Learn board & mechanics', icon: 'school', colors: ['#6366F1', '#4338CA'] },
];

const TILES: { key: string; title: string; icon: string; route: keyof RootStackParamList; colors: string[] }[] = [
  { key: 'profile', title: 'Profile', icon: 'person', route: 'Profile', colors: ['#F472B6', '#BE185D'] },
  { key: 'stats', title: 'Statistics', icon: 'stats-chart', route: 'Stats', colors: ['#34D399', '#047857'] },
  { key: 'achievements', title: 'Achievements', icon: 'trophy', route: 'Achievements', colors: ['#FBBF24', '#B45309'] },
  { key: 'customize', title: 'Customize', icon: 'color-palette', route: 'Customization', colors: ['#60A5FA', '#1D4ED8'] },
  { key: 'settings', title: 'Settings', icon: 'settings', route: 'Settings', colors: ['#A78BFA', '#6D28D9'] },
  { key: 'help', title: 'How to Play', icon: 'help-buoy', route: 'Help', colors: ['#F87171', '#B91C1C'] },
];

export default function HomeScreen({ navigation }: Props) {
  const { save, isDark, theme } = useStore();
  const ui = isDark ? theme.dark_ : theme.light;
  const unlocked = ACHIEVEMENTS.filter((a) => (save.achievements[a.id] || 0) >= a.goal).length;

  const float = useSharedValue(0);
  useEffect(() => {
    float.value = withRepeat(withSequence(withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.quad) }), withTiming(0, { duration: 2600, easing: Easing.inOut(Easing.quad) })), -1, true);
  }, []);
  const diceStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -6 + float.value * 12 }, { rotate: `${-8 + float.value * 16}deg` }] }));
  const tokenStyle = useAnimatedStyle(() => ({ transform: [{ translateY: 8 - float.value * 12 }] }));

  const goMode = (modeKey: ModeKey) => {
    if (modeKey === 'create_room') {
      navigation.navigate('CreateRoom');
      return;
    }
    if (modeKey === 'join_room') {
      navigation.navigate('JoinRoom');
      return;
    }
    navigation.navigate('GameSetup', { mode: modeKey });
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: ui.bg }]} edges={['top', 'bottom']}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <View style={[styles.blob, { backgroundColor: alpha(theme.players.red.main, 0.09), top: -70, left: -50 }]} />
        <View style={[styles.blob, { backgroundColor: alpha(theme.players.blue.main, 0.08), top: 140, right: -80 }]} />
      </View>

      <View style={styles.topBar}>
        <Press onPress={() => navigation.navigate('Profile')} style={styles.profileBtn}>
          <View style={[styles.avatarRing, { borderColor: theme.players[save.profile.avatar].main }]}>
            <LinearGradient
              colors={[theme.players[save.profile.avatar].light, theme.players[save.profile.avatar].main] as any}
              style={styles.avatar}
            >
              <Text style={styles.avatarText}>{save.profile.name.slice(0, 1).toUpperCase()}</Text>
            </LinearGradient>
          </View>
          <View style={{ marginLeft: 11 }}>
            <Text style={[styles.hello, { color: ui.textDim }]}>Welcome back</Text>
            <Text style={[styles.name, { color: ui.text }]} numberOfLines={1}>
              {save.profile.name}
            </Text>
          </View>
        </Press>

        <View style={[styles.coins, { backgroundColor: ui.surface, borderColor: ui.border }]}>
          <Ionicons name="star" size={14} color="#E9A81C" />
          <Text style={[styles.coinText, { color: ui.text }]}>{save.profile.coins}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 30 }} showsVerticalScrollIndicator={false}>
        {/* ---------- hero ---------- */}
        <Animated.View entering={FadeInDown.duration(420)} style={styles.heroWrap}>
          <LinearGradient colors={[theme.players.red.main, theme.players.blue.main] as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
            <View pointerEvents="none" style={[styles.heroCircle, { borderColor: 'rgba(255,255,255,0.16)' }]} />
            <View pointerEvents="none" style={[styles.heroCircle2, { borderColor: 'rgba(255,255,255,0.12)' }]} />

            <View style={styles.heroRow}>
              <View style={{ flex: 1 }}>
                <View style={styles.kingRow}>
                  <Ionicons name="trophy" size={13} color="#FFE49A" />
                  <Text style={styles.king}>LUDO ROYALE</Text>
                </View>
                <Text style={styles.heroTitle}>Ready to rule{'\\n'}the board?</Text>
                <Text style={styles.heroSub}>Classic rules · 2–4 players · real-time animation</Text>
              </View>
              <Animated.View style={[styles.decoDice, diceStyle]}>
                <View style={styles.miniDice}>
                  <View style={styles.miniPips}>
                    <View style={styles.miniPip} />
                    <View style={styles.miniPip} />
                  </View>
                  <View style={styles.miniPips}>
                    <View style={styles.miniPip} />
                    <View style={styles.miniPip} />
                  </View>
                </View>
              </Animated.View>
              <Animated.View style={[styles.decoToken, tokenStyle]}>
                <View style={styles.miniToken} />
              </Animated.View>
            </View>

            <Btn
              ui={{ ...ui, onPrimary: '#3A1E00' }}
              variant="gold"
              size="lg"
              full
              label="PLAY NOW"
              icon="play"
              iconSize={22}
              onPress={() => goMode('classic')}
              style={{ marginTop: 18 }}
            />
          </LinearGradient>
        </Animated.View>

        {/* ---------- modes ---------- */}
        <Text style={[styles.section, { color: ui.textDim }]}>GAME MODES</Text>
        <View style={styles.modeRow}>
          {MODES.map((m, i) => (
            <Animated.View key={m.key} entering={FadeInDown.delay(80 + i * 70).duration(400)} style={styles.modeItem}>
              <Press onPress={() => goMode(m.key)} style={{ flex: 1 }}>
                <View style={[styles.modeCard, { backgroundColor: ui.surface, borderColor: ui.border }]}>
                  <LinearGradient colors={m.colors as any} style={styles.modeIcon}>
                    <Ionicons name={m.icon as any} size={20} color="#fff" />
                  </LinearGradient>
                  <Text style={[styles.modeTitle, { color: ui.text }]}>{m.title}</Text>
                  <Text style={[styles.modeDesc, { color: ui.textDim }]} numberOfLines={2}>
                    {m.desc}
                  </Text>
                </View>
              </Press>
            </Animated.View>
          ))}
        </View>

        {/* ---------- tiles ---------- */}
        <Text style={[styles.section, { color: ui.textDim }]}>YOUR KINGDOM</Text>
        <View style={styles.grid}>
          {TILES.map((t, i) => (
            <Animated.View key={t.key} entering={FadeInDown.delay(150 + i * 55).duration(380)} style={styles.gridItem}>
              <Press onPress={() => navigation.navigate(t.route as any)} style={{ flex: 1 }}>
                <View style={[styles.tile, { backgroundColor: ui.surface, borderColor: ui.border }]}>
                  <LinearGradient colors={t.colors as any} style={styles.tileIcon}>
                    <Ionicons name={t.icon as any} size={19} color="#fff" />
                  </LinearGradient>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.tileTitle, { color: ui.text }]}>{t.title}</Text>
                    <Text style={[styles.tileSub, { color: ui.textDim }]}>
                      {t.key === 'achievements'
                        ? `${unlocked}/${ACHIEVEMENTS.length} unlocked`
                        : t.key === 'stats'
                        ? `${save.stats.wins} wins · ${save.stats.games} games`
                        : t.key === 'profile'
                        ? save.profile.name
                        : t.key === 'customize'
                        ? 'Boards · dice · tokens'
                        : t.key === 'settings'
                        ? 'Sound, speed, theme'
                        : 'Rules & tips'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={ui.textFaint} />
                </View>
              </Press>
            </Animated.View>
          ))}
        </View>

        <Text style={[styles.footer, { color: ui.textFaint }]}>Ludo Royale · v1.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function alpha(hex: string, a: number) {
  const h = hex.replace('#', '');
  const n = parseInt(h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  blob: { position: 'absolute', width: 260, height: 260, borderRadius: 200 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12 },
  profileBtn: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  avatarRing: { width: 48, height: 48, borderRadius: 24, borderWidth: 2.5, alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: '900', fontSize: 18 },
  hello: { fontSize: 12, fontWeight: '600' },
  name: { fontSize: 17, fontWeight: '900', maxWidth: 170 },
  coins: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 13, paddingVertical: 9, borderRadius: 999, borderWidth: 1.5 },
  coinText: { fontWeight: '900', fontSize: 14 },
  heroWrap: { borderRadius: 28 },
  hero: { borderRadius: 28, padding: 20, overflow: 'hidden', shadowColor: '#5B21B6', shadowOpacity: 0.4, shadowRadius: 20, shadowOffset: { width: 0, height: 12 }, elevation: 10 },
  heroCircle: { position: 'absolute', width: 230, height: 230, borderRadius: 160, borderWidth: 26, top: -90, right: -60 },
  heroCircle2: { position: 'absolute', width: 160, height: 160, borderRadius: 120, borderWidth: 18, bottom: -70, left: -50 },
  heroRow: { flexDirection: 'row', alignItems: 'center' },
  kingRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  king: { color: '#FFE49A', fontWeight: '900', fontSize: 11.5, letterSpacing: 2.4 },
  heroTitle: { color: '#fff', fontSize: 26, fontWeight: '900', lineHeight: 31 },
  heroSub: { color: 'rgba(255,255,255,0.85)', fontSize: 12.5, fontWeight: '600', marginTop: 7 },
  decoDice: { position: 'absolute', right: 6, top: -4 },
  miniDice: { width: 62, height: 62, borderRadius: 17, backgroundColor: '#fff', padding: 11, justifyContent: 'space-between', shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
  miniPips: { flexDirection: 'row', justifyContent: 'space-between' },
  miniPip: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#7C3AED' },
  decoToken: { position: 'absolute', right: 58, bottom: 2 },
  miniToken: { width: 30, height: 30, borderRadius: 16, backgroundColor: '#FBBF24', borderWidth: 3, borderColor: 'rgba(0,0,0,0.18)', shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 4 },
  section: { fontWeight: '900', fontSize: 11.5, letterSpacing: 1.6, marginTop: 24, marginBottom: 11 },
  modeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  modeItem: { width: '46%' },
  modeCard: { borderRadius: 20, borderWidth: 1.5, padding: 13, minHeight: 122, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 2 },
  modeIcon: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  modeTitle: { fontSize: 14.5, fontWeight: '900' },
  modeDesc: { fontSize: 11.5, fontWeight: '600', marginTop: 3, lineHeight: 15 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -5 },
  gridItem: { width: '50%', paddingHorizontal: 5, paddingBottom: 10 },
  tile: { flexDirection: 'row', alignItems: 'center', borderRadius: 20, borderWidth: 1.5, padding: 12, gap: 11, shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 9, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  tileIcon: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  tileTitle: { fontSize: 14, fontWeight: '900' },
  tileSub: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  footer: { textAlign: 'center', fontSize: 11.5, fontWeight: '700', marginTop: 14 },
});
