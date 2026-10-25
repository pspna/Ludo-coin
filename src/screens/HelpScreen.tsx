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
import { Btn, Card, Header } from '../components/ui';

type Props = NativeStackScreenProps<RootStackParamList, 'Help'>;

const RULES: { icon: string; tint: string; title: string; body: string }[] = [
  { icon: 'dice', tint: '#7C3AED', title: 'Roll a six to start', body: 'A token sits in its base until you roll a 6. Rolling a 6 also earns you another roll straight away.' },
  { icon: 'walk', tint: '#2E7DF6', title: 'Race around the board', body: 'Move clockwise around the outer track, then turn into your coloured home lane and finish in the centre.' },
  { icon: 'hand-left', tint: '#E23B3B', title: 'Capture opponents', body: 'Land on a square occupied by an opponent and it goes straight back to its base. Capturing earns you another roll.' },
  { icon: 'shield-checkmark', tint: '#2FA84F', title: 'Safe squares', body: 'The four starred squares and every coloured start square are safe havens. Tokens there cannot be captured.' },
  { icon: 'home', tint: '#F2B01E', title: 'Exact roll to finish', body: 'You need the exact number to enter the centre. A roll too high means the token stays put.' },
  { icon: 'trophy', tint: '#D99A16', title: 'Win the crown', body: 'Bring all four tokens home to win. Other players are ranked by how far their tokens travelled.' },
];

const TIPS = [
  'Three sixes in a row forfeits your turn — greed has a price.',
  'A token sitting on a star square is safe, but it cannot move a capturable neighbour out of danger.',
  'Leaving your base early is usually right: a token on the move earns more options every roll.',
  'Expert computers will happily wait on a safe square until your token passes within six.',
  'Bringing a token home earns an extra roll — chain them to run up a big lead.',
];

const GLOSSARY: { term: string; def: string }[] = [
  { term: 'Base', def: 'The four-square yard where your tokens start.' },
  { term: 'Start square', def: 'The coloured square where a token enters the track.' },
  { term: 'Home lane', def: 'The five safe squares of your colour leading to the centre.' },
  { term: 'Star square', def: 'A starred safe square where tokens cannot be captured.' },
  { term: 'Centre', def: 'The finishing triangle. All four tokens must reach it.' },
];

export default function HelpScreen({ navigation }: Props) {
  const { isDark, theme } = useStore();
  const ui = isDark ? theme.dark_ : theme.light;

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: ui.bg }]} edges={['top', 'bottom']}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Header ui={ui} title="How to Play" subtitle="Classic Ludo rules" onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 34 }} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInDown.duration(320)}>
          <View style={[styles.banner, { backgroundColor: ui.surface, borderColor: ui.border }]}>
            <View style={[styles.bannerIcon, { backgroundColor: alpha(ui.primary, 0.15) }]}>
              <Ionicons name="book" size={22} color={ui.primary} />
            </View>
            <Text style={{ color: ui.textDim, fontWeight: '600', fontSize: 13, flex: 1, lineHeight: 19 }}>
              Ludo is a race for 2 to 4 players. Roll the dice, move your tokens around the board and be the first to bring all four home.
            </Text>
          </View>
        </Animated.View>

        <Text style={[styles.section, { color: ui.textDim }]}>THE RULES</Text>
        {RULES.map((r, i) => (
          <Animated.View key={r.title} entering={FadeInDown.delay(60 + i * 45).duration(320)}>
            <View style={[styles.rule, { backgroundColor: ui.surface, borderColor: ui.border }]}>
              <View style={[styles.ruleIcon, { backgroundColor: alpha(r.tint, 0.15) }]}>
                <Ionicons name={r.icon as any} size={19} color={r.tint} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: ui.text, fontWeight: '900', fontSize: 14.5 }}>{r.title}</Text>
                <Text style={{ color: ui.textDim, fontWeight: '600', fontSize: 12.5, marginTop: 4, lineHeight: 18 }}>{r.body}</Text>
              </View>
            </View>
          </Animated.View>
        ))}

        <Text style={[styles.section, { color: ui.textDim }]}>QUICK TIPS</Text>
        <Card ui={ui}>
          {TIPS.map((t, i) => (
            <View key={t} style={{ flexDirection: 'row', gap: 10, paddingVertical: 9, borderBottomWidth: i === TIPS.length - 1 ? 0 : 1, borderBottomColor: ui.border }}>
              <Ionicons name="sparkles" size={15} color={ui.accent} style={{ marginTop: 2 }} />
              <Text style={{ color: ui.textDim, fontWeight: '600', fontSize: 12.5, flex: 1, lineHeight: 18 }}>{t}</Text>
            </View>
          ))}
        </Card>

        <Text style={[styles.section, { color: ui.textDim }]}>GLOSSARY</Text>
        <Card ui={ui}>
          {GLOSSARY.map((g, i) => (
            <View key={g.term} style={{ paddingVertical: 9, borderBottomWidth: i === GLOSSARY.length - 1 ? 0 : 1, borderBottomColor: ui.border }}>
              <Text style={{ color: ui.text, fontWeight: '900', fontSize: 13 }}>{g.term}</Text>
              <Text style={{ color: ui.textDim, fontWeight: '600', fontSize: 12.5, marginTop: 3, lineHeight: 18 }}>{g.def}</Text>
            </View>
          ))}
        </Card>

        <View style={{ marginTop: 22 }}>
          <Btn ui={ui} full size="lg" label="Got it — let's play" icon="play" onPress={() => navigation.navigate('GameSetup', { mode: 'classic' })} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  banner: { flexDirection: 'row', gap: 13, alignItems: 'center', borderRadius: 22, borderWidth: 1.5, padding: 15 },
  bannerIcon: { width: 46, height: 46, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  section: { fontWeight: '900', fontSize: 11.5, letterSpacing: 1.6, marginTop: 22, marginBottom: 11 },
  rule: { flexDirection: 'row', gap: 12, borderRadius: 20, borderWidth: 1.5, padding: 14, marginBottom: 10 },
  ruleIcon: { width: 42, height: 42, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
});
