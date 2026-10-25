import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { Press } from './ui';
import type { DiceStyle } from '../lib/theme';

const PIPS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

interface Props {
  value: number | null;
  rolling: boolean;
  size?: number;
  style: DiceStyle;
  onPress?: () => void;
  disabled?: boolean;
  hint?: string;
}

export function Dice({ value, rolling, size = 74, style, onPress, disabled, hint }: Props) {
  const [face, setFace] = useState(value ?? 1);
  const rot = useSharedValue(0);
  const scale = useSharedValue(1);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (rolling) {
      scale.value = withSequence(
        withTiming(1.14, { duration: 110, easing: Easing.out(Easing.quad) }),
        withRepeat(withSequence(withTiming(0.96, { duration: 120 }), withTiming(1.08, { duration: 120 })), -1, true),
      );
      rot.value = withRepeat(withSequence(withTiming(-16, { duration: 130 }), withTiming(16, { duration: 130 })), -1, true);
      let n = 0;
      timer.current = setInterval(() => {
        n += 1;
        setFace(1 + ((n * 3 + Math.floor(Math.random() * 6)) % 6));
      }, 80);
    } else {
      if (timer.current) {
        clearInterval(timer.current);
        timer.current = null;
      }
      setFace(value ?? 1);
      rot.value = withTiming(0, { duration: 180 });
      scale.value = withSequence(withTiming(1.24, { duration: 90 }), withTiming(1, { duration: 220, easing: Easing.out(Easing.back(2)) }));
    }
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [rolling, value]);

  const anim = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rot.value}deg` }, { scale: scale.value }],
  }));

  const pipColor = style.pip;
  const showFace = rolling ? face : value ?? face;

  const body = (
    <Animated.View
      style={[
        styles.face,
        {
          width: size,
          height: size,
          borderRadius: size * 0.26,
          backgroundColor: style.face,
          borderColor: style.border,
          shadowColor: style.glow,
        },
        anim,
      ]}
    >
      <View style={[styles.gloss, { backgroundColor: style.face2, width: size * 0.62, height: size * 0.3, top: size * 0.06, left: size * 0.19, borderRadius: size * 0.2 }]} />
      <View style={styles.pipGrid}>
        {Array.from({ length: 9 }).map((_, i) => (
          <View key={i} style={styles.pipCell}>
            {PIPS[showFace]?.includes(i) ? (
              <View style={{ width: size * 0.15, height: size * 0.15, borderRadius: size * 0.075, backgroundColor: pipColor }} />
            ) : null}
          </View>
        ))}
      </View>
    </Animated.View>
  );

  if (!onPress) return body;

  return (
    <View style={{ alignItems: 'center' }}>
      <Press onPress={onPress} disabled={disabled} scaleTo={0.9}>
        {body}
      </Press>
      {hint ? <Text style={[styles.hint, { color: 'rgba(255,255,255,0.92)' }]}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  face: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    shadowOpacity: 0.9,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
    overflow: 'hidden',
  },
  gloss: { position: 'absolute', opacity: 0.55 },
  pipGrid: {
    width: '76%',
    height: '76%',
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  pipCell: { width: '33.33%', height: '33.33%', alignItems: 'center', justifyContent: 'center' },
  hint: { marginTop: 8, fontWeight: '800', fontSize: 12, textShadowColor: 'rgba(0,0,0,0.35)', textShadowRadius: 3, textShadowOffset: { width: 0, height: 1 } },
});
