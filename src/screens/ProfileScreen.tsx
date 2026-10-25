import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../lib/nav';
import { useStore } from '../lib/store';
import { RING_ORDER, alpha } from '../lib/theme';
import { ACHIEVEMENTS, achievementValue } from '../lib/storage';
import { Btn, Card, Header, Press } from '../components/ui';
import { formatTime } from './GameScreen';

type Props = NativeStackScreenProps<RootStackParamList, 'Profile'>;

export default function ProfileScreen({ navigation }: Props) {
  const { isDark, theme, save, setName, setAvatar, resetAll } = useStore();
  const ui = isDark ? theme.dark_ : theme.light;
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState(false);

  const s = save.stats;
  const winRate = s.games > 0 ? Math.round((s.wins / s.games) * 100) : 0;
  const unlocked = ACHIEVEMENTS.filter((a) => (save.achievements[a.id] || 0) >= a.goal);
  const favourite = RING_ORDER.reduce((best, c) => (s.winsByColor[c] > s.winsByColor[best] ? c : best), RING_ORDER[0]);

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: ui.bg }]} edges={['top', 'bottom']}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Header ui={ui} title="Profile" subtitle="Your royal identity" onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInDown.duration(360)}>
          <LinearGradient colors={[theme.players[save.profile.avatar].main, theme.players[save.profile.avatar].dark] as any} style={styles.card}>
            <View style={[styles.avatarRing, { borderColor: 'rgba(255,255,255,0.5)' }]}>
              <Text style={styles.avatarText}>{save.profile.name.slice(0, 1).toUpperCase()}</Text>
            </View>
            {editing ? (
              <TextInput
                value={save.profile.name}
                onChangeText={setName}
                autoFocus
                maxLength={14}
                placeholder="Your name"
                placeholderTextColor="rgba(255,255,255,0.6)"
                onBlur={() => setEditing(false)}
                onSubmitEditing={() => setEditing(false)}
                style={styles.nameInput}
                returnKeyType="done"
              />
            ) : (
              <Press onPress={() => setEditing(true)}>
                <View style={styles.nameRow}>
                  <Text style={styles.nameText}>{save.profile.name}</Text>
                  <Ionicons name="create-outline" size={16} color="rgba(255,255,255,0.9)" />
                </View>
              </Press>
            )}
            <View style={styles.coinRow}>
              <Ionicons name="star" size={14} color="#FFE49A" />
              <Text style={styles.coinText}>{save.profile.coins} coins</Text>
            </View>

            <Text style={styles.pickLabel}>PLAY AS</Text>
            <View style={styles.colorRow}>
              {RING_ORDER.map((c) => {
                const on = save.profile.avatar === c;
                return (
                  <Press key={c} onPress={() => setAvatar(c)}>
                    <View style={[styles.colorChip, { backgroundColor: on ? '#fff' : 'rgba(255,255,255,0.22)', borderColor: on ? '#fff' : 'rgba(255,255,255,0.35)' }]}>
                      <View style={[styles.colorDot, { backgroundColor: theme.players[c].main, borderColor: theme.players[c].dark }]} />
                      <Text style={{ color: on ? theme.players[c].main : '#fff', fontWeight: '900', fontSize: 12, marginLeft: 6, textTransform: 'capitalize' }}>{c}</Text>
                    </View>
                  </Press>
                );
              })}
            </View>
          </LinearGradient>
        </Animated.View>

        <Text style={[styles.section, { color: ui.textDim }]}>CAREER</Text>
        <View style={styles.grid}>
          <BigStat ui={ui} icon="trophy" label="Wins" value={`${s.wins}`} tint={theme.players.yellow.main} />
          <BigStat ui={ui} icon="game-controller" label="Games" value={`${s.games}`} tint={ui.primary} />
          <BigStat ui={ui} icon="stats-chart" label="Win rate" value={`${winRate}%`} tint={theme.players.green.main} />
          <BigStat ui={ui} icon="flame" label="Best streak" value={`${s.bestStreak}`} tint={theme.players.red.main} />
        </View>

        <Text style={[styles.section, { color: ui.textDim }]}>HIGHLIGHTS</Text>
        <Card ui={ui}>
          <Row icon="color-palette" tint={theme.players[favourite].main} label="Favourite colour" value={`${favourite} · ${s.winsByColor[favourite]} wins`} ui={ui} />
          <Divider ui={ui} />
          <Row icon="hand-left" tint={theme.players.red.main} label="Tokens captured" value={`${s.captures}`} ui={ui} />
          <Divider ui={ui} />
          <Row icon="home" tint={theme.players.green.main} label="Tokens sent home" value={`${s.tokensHome}`} ui={ui} />
          <Divider ui={ui} />
          <Row icon="dice" tint={ui.primary} label="Dice rolls" value={`${s.rolls} (${s.sixes} sixes)`} ui={ui} />
          <Divider ui={ui} />
          <Row icon="time" tint={theme.players.blue.main} label="Time at the table" value={formatTime(s.totalTimeMs)} ui={ui} />
        </Card>

        <Text style={[styles.section, { color: ui.textDim }]}>ACHIEVEMENTS</Text>
        <Card ui={ui}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <Text style={{ flex: 1, color: ui.text, fontWeight: '900', fontSize: 15 }}>
              {unlocked.length} of {ACHIEVEMENTS.length} unlocked
            </Text>
            <Press onPress={() => navigation.navigate('Achievements')}>
              <Text style={{ color: ui.primary, fontWeight: '900', fontSize: 13 }}>See all</Text>
            </Press>
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {ACHIEVEMENTS.slice(0, 4).map((a) => {
              const got = (save.achievements[a.id] || 0) >= a.goal;
              return (
                <View key={a.id} style={{ alignItems: 'center', flex: 1 }}>
                  <View style={[styles.achCircle, { backgroundColor: got ? alpha('#E9A81C', 0.16) : ui.surfaceAlt, borderColor: got ? '#E9A81C' : ui.border }]}>
                    <Ionicons name={(got ? a.icon : 'lock-closed') as any} size={19} color={got ? '#E9A81C' : ui.textFaint} />
                  </View>
                  <Text numberOfLines={1} style={{ color: got ? ui.text : ui.textFaint, fontSize: 9.5, fontWeight: '800', marginTop: 5 }}>
                    {a.title}
                  </Text>
                </View>
              );
            })}
          </View>
        </Card>

        <View style={{ marginTop: 24 }}>
          <Btn ui={ui} full variant="ghost" label="Reset all progress" icon="trash" onPress={() => setConfirm(true)} />
        </View>
      </ScrollView>

      {confirm ? (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: ui.overlay, alignItems: 'center', justifyContent: 'center', padding: 28 }]}>
          <Animated.View entering={FadeInDown.duration(220)} style={[styles.modal, { backgroundColor: ui.surface, borderColor: ui.border }]}>
            <Ionicons name="warning" size={32} color={ui.danger} />
            <Text style={[styles.modalTitle, { color: ui.text }]}>Reset everything?</Text>
            <Text style={[styles.modalSub, { color: ui.textDim }]}>Coins, stats, achievements and unlocks will be permanently deleted.</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
              <Btn ui={ui} variant="surface" label="Cancel" onPress={() => setConfirm(false)} style={{ flex: 1 }} />
              <Btn ui={ui} label="Reset" onPress={() => { resetAll(); setConfirm(false); }} style={{ flex: 1 }} />
            </View>
          </Animated.View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

function BigStat({ ui, icon, label, value, tint }: { ui: any; icon: string; label: string; value: string; tint: string }) {
  return (
    <View style={[styles.bigStat, { backgroundColor: ui.surface, borderColor: ui.border }]}>
      <View style={[styles.bigIcon, { backgroundColor: alpha(tint, 0.16) }]}>
        <Ionicons name={icon as any} size={17} color={tint} />
      </View>
      <Text style={{ color: ui.text, fontWeight: '900', fontSize: 22, marginTop: 8 }}>{value}</Text>
      <Text style={{ color: ui.textDim, fontWeight: '800', fontSize: 11.5 }}>{label}</Text>
    </View>
  );
}

function Row({ icon, label, value, tint, ui }: { icon: string; label: string; value: string; tint: string; ui: any }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 11 }}>
      <View style={[styles.rowIcon, { backgroundColor: alpha(tint, 0.15) }]}>
        <Ionicons name={icon as any} size={15} color={tint} />
      </View>
      <Text style={{ flex: 1, color: ui.textDim, fontWeight: '700', fontSize: 13.5, marginLeft: 11 }}>{label}</Text>
      <Text style={{ color: ui.text, fontWeight: '900', fontSize: 13.5 }}>{value}</Text>
    </View>
  );
}

function Divider({ ui }: { ui: any }) {
  return <View style={{ height: 1, backgroundColor: ui.border }} />;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  card: { borderRadius: 28, padding: 22, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.22, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 8 },
  avatarRing: { width: 88, height: 88, borderRadius: 44, borderWidth: 3, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.18)' },
  avatarText: { color: '#fff', fontSize: 36, fontWeight: '900' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 },
  nameText: { color: '#fff', fontSize: 21, fontWeight: '900' },
  nameInput: { color: '#fff', fontSize: 20, fontWeight: '900', marginTop: 12, borderBottomWidth: 2, borderBottomColor: 'rgba(255,255,255,0.6)', minWidth: 160, textAlign: 'center', paddingVertical: 4 },
  coinRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, backgroundColor: 'rgba(0,0,0,0.18)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  coinText: { color: '#fff', fontWeight: '900', fontSize: 13 },
  pickLabel: { color: 'rgba(255,255,255,0.8)', fontWeight: '900', fontSize: 10.5, letterSpacing: 1.6, marginTop: 18 },
  colorRow: { flexDirection: 'row', gap: 8, marginTop: 9 },
  colorChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 11, paddingVertical: 8, borderRadius: 999, borderWidth: 1.5 },
  colorDot: { width: 15, height: 15, borderRadius: 8, borderWidth: 1.5 },
  section: { fontWeight: '900', fontSize: 11.5, letterSpacing: 1.6, marginTop: 24, marginBottom: 11 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -5 },
  bigStat: { padding: 15, borderRadius: 22, borderWidth: 1.5, marginBottom: 10, alignItems: 'flex-start', marginHorizontal: 5, width: '47.5%' },
  bigIcon: { width: 36, height: 36, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  rowIcon: { width: 30, height: 30, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  achCircle: { width: 46, height: 46, borderRadius: 16, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  modal: { width: '100%', borderRadius: 26, borderWidth: 1.5, padding: 22, alignItems: 'center' },
  modalTitle: { fontSize: 19, fontWeight: '900', marginTop: 10 },
  modalSub: { fontSize: 13, fontWeight: '600', textAlign: 'center', marginTop: 7, lineHeight: 18 },
});
