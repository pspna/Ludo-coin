import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { StatusBar } from 'expo-status-bar';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../lib/nav';
import { useStore } from '../lib/store';
import { alpha } from '../lib/theme';
import { ACHIEVEMENTS, achievementValue } from '../lib/storage';
import { Header } from '../components/ui';

type Props = NativeStackScreenProps<RootStackParamList, 'Achievements'>;

const TIER: Record<string, { label: string; color: string }> = {
  bronze: { label: 'Bronze', color: '#C77B3C' },
  silver: { label: 'Silver', color: '#9AA3B2' },
  gold: { label: 'Gold', color: '#E9A81C' },
};

export default function AchievementsScreen({ navigation }: Props) {
  const { isDark, theme, save } = useStore();
  const ui = isDark ? theme.dark_ : theme.light;
  const unlocked = ACHIEVEMENTS.filter((a) => (save.achievements[a.id] || 0) >= a.goal).length;
  const pct = Math.round((unlocked / ACHIEVEMENTS.length) * 100);

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: ui.bg }]} edges={['top', 'bottom']}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Header ui={ui} title="Achievements" subtitle={`${unlocked} of ${ACHIEVEMENTS.length} unlocked`} onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        <View style={[styles.hero, { backgroundColor: ui.surface, borderColor: ui.border }]}>
          <View style={[styles.heroIcon, { backgroundColor: alpha('#E9A81C', 0.16) }]}>
            <Ionicons name="trophy" size={26} color="#E9A81C" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: ui.text, fontWeight: '900', fontSize: 17 }}>{pct}% complete</Text>
            <View style={[styles.track, { backgroundColor: ui.border }]}>
              <View style={{ width: `${pct}%`, height: '100%', backgroundColor: '#E9A81C', borderRadius: 4 }} />
            </View>
          </View>
        </View>

        {ACHIEVEMENTS.map((a, i) => {
          const val = achievementValue(a, save.stats);
          const got = val >= a.goal;
          const tier = TIER[a.tier];
          const p = Math.round((val / a.goal) * 100);
          return (
            <Animated.View key={a.id} entering={FadeInDown.delay(30 + i * 35).duration(320)}>
              <View style={[styles.row, { backgroundColor: ui.surface, borderColor: got ? tier.color : ui.border }]}>
                <View style={[styles.icon, { backgroundColor: got ? alpha(tier.color, 0.18) : ui.surfaceAlt, borderColor: got ? tier.color : ui.border }]}>
                  <Ionicons name={a.icon as any} size={21} color={got ? tier.color : ui.textFaint} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                    <Text style={{ color: got ? ui.text : ui.textDim, fontWeight: '900', fontSize: 14.5 }}>{a.title}</Text>
                    <View style={[styles.tier, { backgroundColor: alpha(tier.color, 0.16) }]}>
                      <Text style={{ color: tier.color, fontWeight: '900', fontSize: 9.5, letterSpacing: 0.6 }}>{tier.label.toUpperCase()}</Text>
                    </View>
                  </View>
                  <Text style={{ color: ui.textDim, fontWeight: '600', fontSize: 12, marginTop: 2 }}>{a.desc}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
                    <View style={[styles.track, { backgroundColor: ui.border, flex: 1 }]}>
                      <View style={{ width: `${p}%`, height: '100%', backgroundColor: got ? tier.color : ui.primary, borderRadius: 4 }} />
                    </View>
                    <Text style={{ color: got ? tier.color : ui.textFaint, fontWeight: '900', fontSize: 11 }}>
                      {got ? 'DONE' : `${val}/${a.goal}`}
                    </Text>
                  </View>
                </View>
                {got ? <Ionicons name="checkmark-circle" size={20} color={tier.color} /> : <Ionicons name="lock-closed" size={16} color={ui.textFaint} />}
              </View>
            </Animated.View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 22, borderWidth: 1.5, padding: 15, marginBottom: 14 },
  heroIcon: { width: 52, height: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  track: { height: 7, borderRadius: 4, overflow: 'hidden', marginTop: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 20, borderWidth: 1.5, padding: 13, marginBottom: 10 },
  icon: { width: 46, height: 46, borderRadius: 16, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  tier: { paddingHorizontal: 6, paddingVertical: 2.5, borderRadius: 6 },
});
