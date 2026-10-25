import React, { useRef, useState } from 'react';
import { FlatList, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../lib/nav';
import { useStore } from '../lib/store';
import { Btn, Press } from '../components/ui';

 type Props = NativeStackScreenProps<RootStackParamList, 'Onboarding'>;

interface Page {
  key: string;
  icon: string;
  colors: string[];
  title: string;
  body: string;
  chips: string[];
}

const PAGES: Page[] = [
  {
    key: 'p1',
    icon: 'dice',
    colors: ['#7C3AED', '#4C1D95'],
    title: 'Welcome to Ludo Royale',
    body: 'The classic race-to-the-centre board game, rebuilt with buttery animation, juicy feedback and gorgeous boards.',
    chips: ['2 – 4 players', 'Classic rules', 'One thumb'],
  },
  {
    key: 'p2',
    icon: 'happy',
    colors: ['#F59E0B', '#B45309'],
    title: 'Play anyone, anywhere',
    body: 'Pass-and-play with friends on one device, or take on computers that range from easy-going to genuinely ruthless.',
    chips: ['Local multiplayer', '4 difficulties', 'Quick matches'],
  },
  {
    key: 'p3',
    icon: 'trophy',
    colors: ['#0EA5E9', '#075985'],
    title: 'Earn, unlock, crown yourself',
    body: 'Win coins, unlock boards, dice and token styles, and chase 16 achievements on your way to the top of the table.',
    chips: ['6 boards', '16 achievements', 'Coin rewards'],
  },
];

export default function OnboardingScreen({ navigation }: Props) {
  const { width } = useWindowDimensions();
  const { isDark, theme, update } = useStore();
  const ui = isDark ? theme.dark_ : theme.light;
  const [index, setIndex] = useState(0);
  const listRef = useRef<FlatList>(null);

  const finish = () => {
    update((d) => {
      d.onboarded = true;
    });
    navigation.replace('Home');
  };

  const next = () => {
    if (index >= PAGES.length - 1) return finish();
    listRef.current?.scrollToIndex({ index: index + 1, animated: true });
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: ui.bg }]} edges={['top', 'bottom']}>
      <View style={styles.topRow}>
        <View style={styles.brandRow}>
          <View style={[styles.brandDot, { backgroundColor: ui.primary }]}>
            <Ionicons name="diamond" size={11} color="#fff" />
          </View>
          <Text style={[styles.brand, { color: ui.text }]}>Ludo Royale</Text>
        </View>
        <Press onPress={finish}>
          <Text style={[styles.skip, { color: ui.textDim }]}>Skip</Text>
        </Press>
      </View>

      <FlatList
        ref={listRef}
        data={PAGES}
        keyExtractor={(p) => p.key}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
        renderItem={({ item }: { item: Page }) => (
          <View style={{ width, paddingHorizontal: 26, alignItems: 'center', justifyContent: 'center' }}>
            <Animated.View entering={FadeInDown.duration(420)}>
              <LinearGradient colors={item.colors as any} style={[styles.art, { shadowColor: item.colors[0] }]}>
                <Ionicons name={item.icon as any} size={92} color="#fff" />
              </LinearGradient>
            </Animated.View>
            <Animated.View entering={FadeInDown.delay(90).duration(420)} style={{ width: '100%' }}>
              <Text style={[styles.title, { color: ui.text }]}>{item.title}</Text>
              <Text style={[styles.body, { color: ui.textDim }]}>{item.body}</Text>
              <View style={styles.chipRow}>
                {item.chips.map((c) => (
                  <View key={c} style={[styles.chip, { backgroundColor: ui.surfaceAlt, borderColor: ui.border }]}>
                    <Ionicons name="checkmark-circle" size={13} color={ui.primary} />
                    <Text style={[styles.chipText, { color: ui.text }]}>{c}</Text>
                  </View>
                ))}
              </View>
            </Animated.View>
          </View>
        )}
      />

      <View style={styles.bottom}>
        <View style={styles.dots}>
          {PAGES.map((p, i) => (
            <View
              key={p.key}
              style={[
                styles.dot,
                {
                  backgroundColor: i === index ? ui.primary : ui.border,
                  width: i === index ? 24 : 8,
                },
              ]}
            />
          ))}
        </View>
        <Btn
          ui={ui}
          size="lg"
          full
          label={index === PAGES.length - 1 ? 'Start Playing' : 'Next'}
          icon={index === PAGES.length - 1 ? 'trophy' : 'arrow-forward'}
          onPress={next}
        />
      </View>
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 22, paddingTop: 6 },
  brandRow: { flexDirection: 'row', alignItems: 'center' },
  brandDot: { width: 26, height: 26, borderRadius: 9, alignItems: 'center', justifyContent: 'center', marginRight: 9 },
  brand: { fontWeight: '900', fontSize: 15, letterSpacing: 0.4 },
  skip: { fontWeight: '800', fontSize: 14, padding: 6 },
  art: {
    width: 190,
    height: 190,
    borderRadius: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 38,
    shadowOpacity: 0.5,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 14 },
    elevation: 10,
  },
  title: { fontSize: 27, fontWeight: '900', textAlign: 'center', letterSpacing: 0.2 },
  body: { fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 12, fontWeight: '500' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 22 },
  chip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 11, paddingVertical: 7, borderRadius: 999, borderWidth: 1, gap: 6 },
  chipText: { fontSize: 12.5, fontWeight: '800' },
  bottom: { paddingHorizontal: 24, paddingBottom: 12 },
  dots: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 7, marginBottom: 20 },
  dot: { height: 8, borderRadius: 4 },
});
