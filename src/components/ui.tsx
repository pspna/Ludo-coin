import React, { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle, StyleProp, TextStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { shade } from '../lib/theme';
import { haptic, play } from '../lib/sound';

interface PressProps {
  children: React.ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  scaleTo?: number;
  sound?: boolean;
  hitSlop?: number;
}

export function Press({ children, onPress, onLongPress, style, disabled, scaleTo = 0.94, sound = true, hitSlop }: PressProps) {
  const s = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));

  const down = useCallback(() => {
    s.value = withSpring(scaleTo, { damping: 18, stiffness: 480 });
  }, [scaleTo]);
  const up = useCallback(() => {
    s.value = withSpring(1, { damping: 14, stiffness: 320 });
  }, []);

  return (
    <Animated.View style={[anim, style, disabled ? styles.disabled : null]}>
      <Pressable
        disabled={disabled}
        hitSlop={hitSlop}
        onPressIn={down}
        onPressOut={up}
        onLongPress={onLongPress}
        onPress={() => {
          if (sound) {
            play('click');
            haptic('select');
          }
          onPress && onPress();
        }}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

interface BtnProps {
  label: string;
  onPress?: () => void;
  icon?: string;
  iconSize?: number;
  variant?: 'primary' | 'surface' | 'ghost' | 'gold';
  size?: 'sm' | 'md' | 'lg';
  colors?: string[];
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  full?: boolean;
  ui: { text: string; textDim: string; surface: string; border: string; primary: string; onPrimary: string; gold: string; shadow: string };
}

export function Btn({ label, onPress, icon, iconSize = 20, variant = 'primary', size = 'md', colors, style, disabled, full, ui }: BtnProps) {
  const padV = size === 'lg' ? 17 : size === 'sm' ? 9 : 13;
  const padH = size === 'lg' ? 28 : size === 'sm' ? 14 : 20;
  const font = size === 'lg' ? 18 : size === 'sm' ? 13 : 15;

  const base: ViewStyle = {
    paddingVertical: padV,
    paddingHorizontal: padH,
    borderRadius: size === 'lg' ? 20 : 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: full ? 'stretch' : 'flex-start',
  };

  if (variant === 'primary' || variant === 'gold') {
    const grad = colors || (variant === 'gold' ? ['#F5C542', '#D08A0B'] : [ui.primary, shade(ui.primary, -0.3)]);
    const textColor = variant === 'gold' ? '#3A2A00' : ui.onPrimary;
    return (
      <Press onPress={onPress} disabled={disabled} style={[{ borderRadius: base.borderRadius, shadowColor: grad[0], shadowOpacity: 0.45, shadowRadius: 14, shadowOffset: { width: 0, height: 7 }, elevation: 6 }, style]}>
        <LinearGradient colors={grad as any} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={base}>
          {icon ? <Ionicons name={icon as any} size={iconSize} color={textColor} style={{ marginRight: 9 }} /> : null}
          <Text style={{ color: textColor, fontWeight: '900', fontSize: font, letterSpacing: 0.4 }}>{label}</Text>
        </LinearGradient>
      </Press>
    );
  }

  const isSurface = variant === 'surface';
  return (
    <Press onPress={onPress} disabled={disabled} style={style}>
      <View
        style={[
          base,
          {
            backgroundColor: isSurface ? ui.surface : 'transparent',
            borderWidth: isSurface ? 1.5 : 0,
            borderColor: ui.border,
          },
        ]}
      >
        {icon ? <Ionicons name={icon as any} size={iconSize} color={isSurface ? ui.text : ui.textDim} style={{ marginRight: 8 }} /> : null}
        <Text style={{ color: isSurface ? ui.text : ui.textDim, fontWeight: '800', fontSize: font }}>{label}</Text>
      </View>
    </Press>
  );
}

export function Card({ children, style, ui, elevated = true }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; ui: any; elevated?: boolean }) {
  return (
    <View
      style={[
        {
          backgroundColor: ui.surface,
          borderRadius: 22,
          borderWidth: 1,
          borderColor: ui.border,
          padding: 16,
          shadowColor: ui.shadow,
          shadowOpacity: elevated ? 0.14 : 0,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 8 },
          elevation: elevated ? 3 : 0,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Header({
  title,
  subtitle,
  onBack,
  right,
  ui,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: React.ReactNode;
  ui: any;
}) {
  return (
    <View style={styles.header}>
      {onBack ? (
        <Press onPress={onBack} style={{ marginRight: 12 }}>
          <View style={[styles.headerBtn, { backgroundColor: ui.surface, borderColor: ui.border }]}>
            <Ionicons name="chevron-back" size={22} color={ui.text} />
          </View>
        </Press>
      ) : (
        <View style={{ width: 8 }} />
      )}
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={[styles.headerTitle, { color: ui.text }]}>
          {title}
        </Text>
        {subtitle ? (
          <Text numberOfLines={1} style={[styles.headerSub, { color: ui.textDim }]}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
    </View>
  );
}

export function Pill({ label, icon, color, bg, style, textStyle }: { label: string; icon?: string; color: string; bg: string; style?: StyleProp<ViewStyle>; textStyle?: StyleProp<TextStyle> }) {
  return (
    <View style={[styles.pill, { backgroundColor: bg }, style]}>
      {icon ? <Ionicons name={icon as any} size={13} color={color} style={{ marginRight: 5 }} /> : null}
      <Text style={[{ color, fontWeight: '800', fontSize: 12.5 }, textStyle]}>{label}</Text>
    </View>
  );
}

export function SectionTitle({ children, ui, style }: { children: React.ReactNode; ui: any; style?: StyleProp<TextStyle> }) {
  return <Text style={[{ color: ui.textDim, fontWeight: '900', fontSize: 12, letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 10, marginTop: 18 }, style]}>{children}</Text>;
}

const styles = StyleSheet.create({
  disabled: { opacity: 0.45 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingBottom: 10, paddingTop: 6 },
  headerBtn: { width: 42, height: 42, borderRadius: 15, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 21, fontWeight: '900', letterSpacing: 0.2 },
  headerSub: { fontSize: 12.5, fontWeight: '600', marginTop: 1 },
  pill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
});

export const FadeIn = (delay = 0) => ({
  initial: { opacity: 0, translateY: 14 },
  animate: { opacity: 1, translateY: 0 },
  transition: { duration: 320, delay, type: 'timing' as const },
});

export function useFade(delay = 0) {
  const v = useSharedValue(0);
  const st = useAnimatedStyle(() => ({ opacity: v.value, transform: [{ translateY: (1 - v.value) * 16 }] }));
  React.useEffect(() => {
    v.value = withTiming(1, { duration: 380 + delay });
  }, [delay]);
  return st;
}
