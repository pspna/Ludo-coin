import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';
import { StatusBar } from 'expo-status-bar';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../lib/nav';
import { useStore } from '../lib/store';
import { DICE_STYLES, RING_ORDER, THEMES, TOKEN_STYLES, alpha, contrastText } from '../lib/theme';
import { Header, Press } from '../components/ui';
import { haptic, play } from '../lib/sound';

type Props = NativeStackScreenProps<RootStackParamList, 'Customization'>;

export default function CustomizationScreen({ navigation }: Props) {
  const { isDark, theme, save, buy, equip } = useStore();
  const ui = isDark ? theme.dark_ : theme.light;
  const [msg, setMsg] = useState<string | null>(null);

  const notify = (text: string) => {
    setMsg(text);
    setTimeout(() => setMsg(null), 1800);
  };

  const act = (kind: 'theme' | 'dice' | 'token', id: string, cost: number, owned: boolean, equipped: boolean) => {
    if (equipped) return;
    if (owned) {
      equip(kind, id);
      play('click');
      haptic('select');
      return;
    }
    if (save.profile.coins < cost) {
      play('invalid');
      haptic('warning');
      notify(`You need ${cost - save.profile.coins} more coins`);
      return;
    }
    const ok = buy(kind, id, cost);
    if (ok) {
      play('home');
      haptic('success');
      notify('Unlocked and equipped!');
    }
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: ui.bg }]} edges={['top', 'bottom']}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Header
        ui={ui}
        title="Customize"
        subtitle="Make the table yours"
        onBack={() => navigation.goBack()}
        right={
          <View style={[styles.coins, { backgroundColor: ui.surface, borderColor: ui.border }]}>
            <Ionicons name="star" size={14} color="#E9A81C" />
            <Text style={{ color: ui.text, fontWeight: '900', fontSize: 13.5 }}>{save.profile.coins}</Text>
          </View>
        }
      />

      {msg ? (
        <Animated.View entering={FadeInDown.duration(200)} exiting={FadeOut.duration(200)} style={[styles.toast, { backgroundColor: ui.text }]}>
          <Text style={{ color: ui.bg, fontWeight: '800', fontSize: 12.5 }}>{msg}</Text>
        </Animated.View>
      ) : null}

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 34 }} showsVerticalScrollIndicator={false}>
        <Text style={[styles.section, { color: ui.textDim }]}>BOARD THEMES</Text>
        <View style={styles.grid}>
          {THEMES.map((t, i) => (
            <Animated.View key={t.id} entering={FadeInDown.delay(i * 45).duration(320)} style={styles.itemWrap}>
              <Press onPress={() => act('theme', t.id, t.cost, save.custom.ownedThemes.includes(t.id), save.custom.theme === t.id)} style={{ flex: 1 }}>
                <View
                  style={[
                    styles.item,
                    {
                      backgroundColor: ui.surface,
                      borderColor: save.custom.theme === t.id ? ui.primary : ui.border,
                      borderWidth: save.custom.theme === t.id ? 2.5 : 1.5,
                    },
                  ]}
                >
                  <View style={[styles.boardPreview, { backgroundColor: t.board.bg, borderColor: t.board.trackBorder }]}>
                    <View style={styles.previewGrid}>
                      {RING_ORDER.map((c) => (
                        <View key={c} style={[styles.previewQuad, { backgroundColor: t.players[c].main }]} />
                      ))}
                    </View>
                    <View style={[styles.previewCenter, { backgroundColor: t.board.center }]} />
                  </View>
                  <Text style={{ color: ui.text, fontWeight: '900', fontSize: 13.5, marginTop: 9 }}>{t.name}</Text>
                  <Text numberOfLines={1} style={{ color: ui.textDim, fontWeight: '600', fontSize: 10.5, marginTop: 2 }}>
                    {t.tagline}
                  </Text>
                  <Badge ui={ui} owned={save.custom.ownedThemes.includes(t.id)} equipped={save.custom.theme === t.id} cost={t.cost} canAfford={save.profile.coins >= t.cost} />
                </View>
              </Press>
            </Animated.View>
          ))}
        </View>

        <Text style={[styles.section, { color: ui.textDim }]}>DICE</Text>
        <View style={styles.grid}>
          {DICE_STYLES.map((d, i) => (
            <Animated.View key={d.id} entering={FadeInDown.delay(i * 45).duration(320)} style={styles.itemWrap}>
              <Press onPress={() => act('dice', d.id, d.cost, save.custom.ownedDice.includes(d.id), save.custom.dice === d.id)} style={{ flex: 1 }}>
                <View
                  style={[
                    styles.item,
                    {
                      backgroundColor: ui.surface,
                      borderColor: save.custom.dice === d.id ? ui.primary : ui.border,
                      borderWidth: save.custom.dice === d.id ? 2.5 : 1.5,
                      alignItems: 'center',
                    },
                  ]}
                >
                  <View style={[styles.dicePreview, { backgroundColor: d.face, borderColor: d.border }]}>
                    <View style={styles.dicePipWrap}>
                      {[0, 1, 2, 3, 4].map((k) => (
                        <View key={k} style={[styles.dicePip, { backgroundColor: d.pip }]} />
                      ))}
                    </View>
                  </View>
                  <Text style={{ color: ui.text, fontWeight: '900', fontSize: 13.5, marginTop: 10 }}>{d.name}</Text>
                  <Badge ui={ui} owned={save.custom.ownedDice.includes(d.id)} equipped={save.custom.dice === d.id} cost={d.cost} canAfford={save.profile.coins >= d.cost} />
                </View>
              </Press>
            </Animated.View>
          ))}
        </View>

        <Text style={[styles.section, { color: ui.textDim }]}>TOKENS</Text>
        <View style={styles.grid}>
          {TOKEN_STYLES.map((t, i) => (
            <Animated.View key={t.id} entering={FadeInDown.delay(i * 45).duration(320)} style={styles.itemWrap}>
              <Press onPress={() => act('token', t.id, t.cost, save.custom.ownedTokens.includes(t.id), save.custom.token === t.id)} style={{ flex: 1 }}>
                <View
                  style={[
                    styles.item,
                    {
                      backgroundColor: ui.surface,
                      borderColor: save.custom.token === t.id ? ui.primary : ui.border,
                      borderWidth: save.custom.token === t.id ? 2.5 : 1.5,
                      alignItems: 'center',
                    },
                  ]}
                >
                  <View style={styles.tokenPreviewBox}>
                    <TokenPreview styleId={t.id} color={theme.players.red} />
                  </View>
                  <Text style={{ color: ui.text, fontWeight: '900', fontSize: 13.5, marginTop: 10 }}>{t.name}</Text>
                  <Badge ui={ui} owned={save.custom.ownedTokens.includes(t.id)} equipped={save.custom.token === t.id} cost={t.cost} canAfford={save.profile.coins >= t.cost} />
                </View>
              </Press>
            </Animated.View>
          ))}
        </View>

        <Text style={{ color: ui.textFaint, fontWeight: '700', fontSize: 11.5, textAlign: 'center', marginTop: 12 }}>
          Win matches to earn coins and unlock everything.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Badge({ ui, owned, equipped, cost, canAfford }: { ui: any; owned: boolean; equipped: boolean; cost: number; canAfford: boolean }) {
  if (equipped) {
    return (
      <View style={[styles.badge, { backgroundColor: ui.primary }]}>
        <Ionicons name="checkmark" size={11} color={ui.onPrimary} />
        <Text style={{ color: ui.onPrimary, fontWeight: '900', fontSize: 10.5, marginLeft: 4 }}>EQUIPPED</Text>
      </View>
    );
  }
  if (owned) {
    return (
      <View style={[styles.badge, { backgroundColor: ui.surfaceAlt, marginTop: 8 }]}>
        <Text style={{ color: ui.textDim, fontWeight: '900', fontSize: 10.5 }}>TAP TO EQUIP</Text>
      </View>
    );
  }
  return (
    <View style={[styles.badge, { backgroundColor: canAfford ? alpha('#E9A81C', 0.18) : ui.surfaceAlt, marginTop: 8, borderColor: canAfford ? '#E9A81C' : 'transparent', borderWidth: 1 }]}>
      <Ionicons name="star" size={11} color={canAfford ? '#E9A81C' : ui.textFaint} />
      <Text style={{ color: canAfford ? '#E9A81C' : ui.textFaint, fontWeight: '900', fontSize: 10.5, marginLeft: 4 }}>{cost}</Text>
    </View>
  );
}

function TokenPreview({ styleId, color }: { styleId: string; color: any }) {
  const size = 44;
  if (styleId === 'flat') {
    return (
      <View style={[styles.token, { backgroundColor: color.main, borderColor: color.dark, borderRadius: size / 2 }]}>
        <View style={{ width: size * 0.6, height: size * 0.6, borderRadius: size, borderWidth: 2.5, borderColor: color.light }} />
      </View>
    );
  }
  if (styleId === 'gem') {
    return (
      <View style={[styles.token, { backgroundColor: color.main, borderColor: color.dark, borderRadius: 10, transform: [{ rotate: '45deg' }] }]}>
        <View style={{ width: size * 0.34, height: size * 0.34, borderRadius: 5, backgroundColor: color.light }} />
      </View>
    );
  }
  if (styleId === 'crown') {
    return (
      <View style={[styles.token, { backgroundColor: color.main, borderColor: color.dark, borderRadius: size / 2 }]}>
        <Ionicons name="diamond" size={19} color="#FFF3CF" />
      </View>
    );
  }
  return (
    <View style={[styles.token, { backgroundColor: color.main, borderColor: color.dark, borderRadius: size / 2 }]}>
      <View style={{ position: 'absolute', top: 6, left: 9, width: 15, height: 10, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.5)' }} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  coins: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 999, borderWidth: 1.5 },
  toast: { alignSelf: 'center', paddingHorizontal: 16, paddingVertical: 9, borderRadius: 999, marginTop: 6 },
  section: { fontWeight: '900', fontSize: 11.5, letterSpacing: 1.6, marginTop: 20, marginBottom: 11 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -5 },
  itemWrap: { width: '50%', paddingHorizontal: 5, paddingBottom: 10 },
  item: { borderRadius: 22, borderWidth: 1.5, padding: 14, alignItems: 'center', minHeight: 158, justifyContent: 'center' },
  boardPreview: { width: 62, height: 62, borderRadius: 16, borderWidth: 2, padding: 7, alignItems: 'center', justifyContent: 'center' },
  previewGrid: { flexDirection: 'row', flexWrap: 'wrap', width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  previewQuad: { width: 17, height: 17, borderRadius: 5, margin: 1.5 },
  previewCenter: { position: 'absolute', width: 15, height: 15, borderRadius: 5, borderWidth: 1.5, borderColor: 'rgba(0,0,0,0.12)' },
  dicePreview: { width: 54, height: 54, borderRadius: 15, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  dicePipWrap: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', flexWrap: 'wrap' },
  dicePip: { width: 8, height: 8, borderRadius: 4, margin: 2.5 },
  tokenPreviewBox: { height: 54, alignItems: 'center', justifyContent: 'center' },
  token: { width: 44, height: 44, borderWidth: 2.5, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 5, shadowOffset: { width: 0, height: 3 }, elevation: 3 },
  badge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, marginTop: 9 },
});
