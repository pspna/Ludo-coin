import React, { useEffect } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../lib/nav';
import { useStore } from '../lib/store';
import { DICE_MAP } from '../lib/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Splash'>;

export default function SplashScreen({ navigation }: Props) {
  const { save, ready, theme, isDark } = useStore();
  const { width } = useWindowDimensions();
  const ui = isDark ? theme.dark_ : theme.light;

  const scale = useSharedValue(0.5);
  const spin = useSharedValue(0);
  const glow = useSharedValue(0);
  const titleY = useSharedValue(24);

  useEffect(() => {
    scale.value = withSpring(1, { damping: 11, stiffness: 120 });
    spin.value = withRepeat(withSequence(withTiming(-10, { duration: 900, easing: Easing.inOut(Easing.quad) }), withTiming(10, { duration: 900, easing: Easing.inOut(Easing.quad) })), -1, true);
    glow.value = withRepeat(withSequence(withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.quad) }), withTiming(0, { duration: 1100, easing: Easing.inOut(Easing.quad) })), -1, true);
    titleY.value = withDelay(220, withTiming(0, { duration: 520, easing: Easing.out(Easing.cubic) }));

    const t = setTimeout(() => {
      navigation.replace(save.onboarded ? 'Home' : 'Onboarding');
    }, 1900);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, save.onboarded]);

  const logoStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }, { rotate: `${spin.value}deg` }] }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: 0.25 + glow.value * 0.5, transform: [{ scale: 1 + glow.value * 0.14 }] }));
  const titleStyle = useAnimatedStyle(() => ({ opacity: 1 - titleY.value / 24, transform: [{ translateY: titleY.value }] }));

  const dice = DICE_MAP.classic;

  return (
    <View style={[styles.root, { backgroundColor: ui.primary }]}>
      <LinearGradient colors={[ui.primary, shadeHex(ui.primary, -0.45)] as any} style={StyleSheet.absoluteFill} />
      <View style={styles.center}>
        <Animated.View style={[styles.glow, glowStyle]} />
        <Animated.View style={logoStyle}>
          <View style={[styles.logoBox, { backgroundColor: dice.face, borderColor: dice.border }]}>
            <View style={styles.pipRow}>
              {[0, 1, 2].map((i) => (
                <View key={i} style={[styles.pip, { backgroundColor: ui.primary }]} />
              ))}
            </View>
            <View style={styles.pipRow}>
              {[0, 1, 2].map((i) => (
                <View key={i} style={[styles.pip, { backgroundColor: ui.primary }]} />
              ))}
            </View>
            <View style={styles.pipRow}>
              {[0, 1, 2].map((i) => (
                <View key={i} style={[styles.pip, { backgroundColor: ui.primary }]} />
              ))}
            </View>
          </View>
          <View style={styles.crownWrap}>
            <Ionicons name="trophy" size={34} color="#FFD76A" />
          </View>
        </Animated.View>

        <Animated.View style={[{ alignItems: 'center', marginTop: 26 }, titleStyle]}>
          <Text style={styles.title}>LUDO</Text>
          <Text style={styles.titleAccent}>ROYALE</Text>
          <View style={styles.rule}>
            <Ionicons name="star" size={11} color="#FFD76A" />
            <Ionicons name="diamond" size={7} color="rgba(255,255,255,0.75)" style={{ marginHorizontal: 8 }} />
            <Ionicons name="star" size={11} color="#FFD76A" />
          </View>
          <Text style={styles.subtitle}>The royal board game</Text>
        </Animated.View>
      </View>
      <Text style={styles.footer}>classic rules · beautiful boards · real fun</Text>
      <StatusBar style="light" />
    </View>
  );
}

function shadeHex(hex: string, t: number) {
  const h = hex.replace('#', '');
  const n = parseInt(h, 16);
  const r = Math.max(0, Math.min(255, Math.round(((n >> 16) & 255) * (1 + t))));
  const g = Math.max(0, Math.min(255, Math.round(((n >> 8) & 255) * (1 + t))));
  const b = Math.max(0, Math.min(255, Math.round((n & 255) * (1 + t))));
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  center: { alignItems: 'center', justifyContent: 'center' },
  glow: { position: 'absolute', width: 260, height: 260, borderRadius: 200, backgroundColor: 'rgba(255,255,255,0.28)' },
  logoBox: {
    width: 132,
    height: 132,
    borderRadius: 34,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
    gap: 12,
  },
  pipRow: { flexDirection: 'row', gap: 14 },
  pip: { width: 14, height: 14, borderRadius: 8 },
  crownWrap: {
    position: 'absolute',
    top: -22,
    right: -16,
    backgroundColor: '#2A1B4A',
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFD76A',
    shadowColor: '#FFD76A',
    shadowOpacity: 0.7,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  title: { color: '#FFFFFF', fontSize: 44, fontWeight: '900', letterSpacing: 10, lineHeight: 48 },
  titleAccent: { color: '#FFD76A', fontSize: 30, fontWeight: '900', letterSpacing: 12, marginTop: -2 },
  rule: { flexDirection: 'row', alignItems: 'center', marginTop: 14 },
  subtitle: { color: 'rgba(255,255,255,0.86)', fontSize: 13.5, fontWeight: '600', letterSpacing: 2.2, marginTop: 8, textTransform: 'uppercase' },
  footer: { position: 'absolute', bottom: 34, color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: '600', letterSpacing: 0.6 },
});
