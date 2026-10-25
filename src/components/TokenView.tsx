import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import type { ColorSpec, TokenStyleId } from '../lib/theme';
import type { Pt } from '../lib/types';

interface Props {
  spec: ColorSpec;
  styleId: TokenStyleId;
  cell: number;
  pos: Pt;
  sizeFactor?: number;
  selectable?: boolean;
  dim?: boolean;
  moving?: { waypoints: Pt[]; stepMs: number } | null;
  zIndex?: number;
  onPress?: (id: string) => void;
  tokenId: string;
}

export function TokenView({ spec, styleId, cell, pos, sizeFactor = 0.84, selectable, dim, moving, zIndex = 1, onPress, tokenId }: Props) {
  const x = useSharedValue(pos.x * cell);
  const y = useSharedValue(pos.y * cell);
  const pulse = useSharedValue(0);
  const pop = useSharedValue(1);

  useEffect(() => {
    if (moving && moving.waypoints.length) {
      const d = moving.stepMs;
      const ease = Easing.inOut(Easing.quad);
      x.value = withSequence(...moving.waypoints.map((p) => withTiming(p.x * cell, { duration: d, easing: ease })));
      y.value = withSequence(...moving.waypoints.map((p) => withTiming(p.y * cell, { duration: d, easing: ease })));
      pop.value = withSequence(
        ...moving.waypoints.map(() => withTiming(1.2, { duration: d * 0.45 })),
        withTiming(1, { duration: d * 0.4 }),
      );
    } else {
      cancelAnimation(x);
      cancelAnimation(y);
      x.value = withTiming(pos.x * cell, { duration: 200, easing: Easing.out(Easing.quad) });
      y.value = withTiming(pos.y * cell, { duration: 200, easing: Easing.out(Easing.quad) });
    }
  }, [moving, pos.x, pos.y, cell]);

  useEffect(() => {
    if (selectable) {
      pulse.value = withRepeat(withSequence(withTiming(1, { duration: 620 }), withTiming(0, { duration: 620 })), -1, true);
    } else {
      cancelAnimation(pulse);
      pulse.value = withTiming(0, { duration: 200 });
    }
    return () => cancelAnimation(pulse);
  }, [selectable]);

  const size = cell * sizeFactor;

  const wrap = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value - cell }, { translateY: y.value - cell }, { scale: pop.value }],
  }));
  const glow = useAnimatedStyle(() => ({
    opacity: 0.25 + pulse.value * 0.65,
    transform: [{ scale: 1 + pulse.value * 0.34 }],
  }));

  return (
    <Animated.View pointerEvents={onPress ? 'auto' : 'none'} style={[styles.wrap, { width: cell * 2, height: cell * 2, zIndex }, wrap]}>
      <Animated.View style={[styles.center, { pointerEvents: 'none' }]}>
        {selectable ? (
          <Animated.View
            style={[
              styles.glow,
              {
                width: size * 1.5,
                height: size * 1.5,
                borderRadius: size,
                backgroundColor: spec.glow,
                shadowColor: spec.main,
              },
              glow,
            ]}
          />
        ) : null}
        <TokenBody spec={spec} styleId={styleId} size={size} dim={dim} />
      </Animated.View>
      {onPress ? (
        <Pressable
          onPress={() => onPress(tokenId)}
          style={[styles.hit, { left: cell - size / 2, top: cell - size / 2, width: Math.max(size, cell * 0.9), height: Math.max(size, cell * 0.9) }]}
        />
      ) : null}
    </Animated.View>
  );
}

function TokenBody({ spec, styleId, size, dim }: { spec: ColorSpec; styleId: TokenStyleId; size: number; dim?: boolean }) {
  const opacity = dim ? 0.42 : 1;

  if (styleId === 'flat') {
    return (
      <View style={[styles.shadowWrap, { width: size, height: size, opacity }]}>
        <View style={[styles.disc, { backgroundColor: spec.main, borderColor: spec.dark, borderRadius: size / 2 }]}>
          <View style={[styles.ring, { width: size * 0.62, height: size * 0.62, borderRadius: size, borderColor: spec.light }]} />
          <View style={[styles.dot, { width: size * 0.24, height: size * 0.24, borderRadius: size, backgroundColor: spec.light }]} />
        </View>
      </View>
    );
  }

  if (styleId === 'gem') {
    return (
      <View style={[styles.shadowWrap, { width: size, height: size, opacity }]}>
        <View style={[styles.gemOuter, { width: size * 0.9, height: size * 0.9, transform: [{ rotate: '45deg' }], backgroundColor: spec.main, borderColor: spec.dark, borderRadius: size * 0.2 }]}>
          <View style={[styles.gemInner, { backgroundColor: spec.light }]} />
          <View style={[styles.gemShine, { backgroundColor: spec.glow }]} />
        </View>
      </View>
    );
  }

  if (styleId === 'crown') {
    return (
      <View style={[styles.shadowWrap, { width: size, height: size, opacity }]}>
        <View style={[styles.disc, { backgroundColor: spec.main, borderColor: spec.dark, borderRadius: size / 2 }]}>
          <View style={[styles.ring, { width: size * 0.74, height: size * 0.74, borderRadius: size, borderColor: spec.light }]} />
          <Text style={{ fontSize: size * 0.44, lineHeight: size * 0.5, color: '#FFF6D8', fontWeight: '900', textShadowColor: 'rgba(0,0,0,0.35)', textShadowRadius: 2, textShadowOffset: { width: 0, height: 1 } }}>
            {'\u265B'}
          </Text>
        </View>
      </View>
    );
  }

  // default: polished orb
  return (
    <View style={[styles.shadowWrap, { width: size, height: size, opacity }]}>
      <View style={[styles.disc, { backgroundColor: spec.main, borderColor: spec.dark, borderRadius: size / 2 }]}>
        <View style={[styles.orbShine, { width: size * 0.56, height: size * 0.4, top: size * 0.08, left: size * 0.12, borderRadius: size }]}>
          <View style={[styles.orbDot, { width: size * 0.18, height: size * 0.18, borderRadius: size, backgroundColor: 'rgba(255,255,255,0.85)' }]} />
        </View>
        <View style={[styles.orbShade, { width: size * 0.72, height: size * 0.34, bottom: size * 0.03, left: size * 0.14, borderRadius: size, backgroundColor: spec.dark }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, top: 0 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  hit: { position: 'absolute' },
  glow: { position: 'absolute', shadowOpacity: 0.9, shadowRadius: 12, elevation: 6 },
  shadowWrap: { alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 4 },
  disc: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, overflow: 'hidden' },
  ring: { position: 'absolute', borderWidth: 2, opacity: 0.75 },
  dot: { opacity: 0.95 },
  orbShine: { position: 'absolute', backgroundColor: 'rgba(255,255,255,0.42)', alignItems: 'flex-start', paddingLeft: 4, paddingTop: 2 },
  orbDot: { opacity: 0.9 },
  orbShade: { position: 'absolute', opacity: 0.28 },
  gemOuter: { alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
  gemInner: { width: '46%', height: '46%', borderRadius: 4, opacity: 0.9 },
  gemShine: { position: 'absolute', top: '8%', left: '12%', width: '24%', height: '24%', borderRadius: 4, opacity: 0.85 },
});
