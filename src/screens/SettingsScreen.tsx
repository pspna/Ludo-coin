import React, { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { StatusBar } from 'expo-status-bar';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../lib/nav';
import { useStore } from '../lib/store';
import { alpha } from '../lib/theme';
import { Btn, Card, Header, Press } from '../components/ui';
import { play, haptic, setFeedback } from '../lib/sound';
import { multiplayer, getDefaultServerUrl, testServerConnection } from '../lib/multiplayer';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

export default function SettingsScreen({ navigation }: Props) {
  const { isDark, theme, save, setSettings, resetAll } = useStore();
  const ui = isDark ? theme.dark_ : theme.light;
  const s = save.settings;

  const [serverUrlInput, setServerUrlInput] = useState(s.serverUrl || getDefaultServerUrl());
  const [testResult, setTestResult] = useState<{ testing?: boolean; ok?: boolean; message?: string } | null>(null);

  const toggle = (key: 'sound' | 'haptics' | 'animations' | 'hints' | 'autoRoll') => () => {
    const next = !s[key];
    setSettings({ [key]: next } as any);
    if (key === 'sound' || key === 'haptics') setFeedback({ sound: key === 'sound' ? next : s.sound, haptics: key === 'haptics' ? next : s.haptics });
    if (next) {
      play('click');
      haptic('light');
    }
  };

  const handleSaveServer = () => {
    const clean = serverUrlInput.trim().replace(/\/+$/, '');
    setSettings({ serverUrl: clean });
    multiplayer.setServerUrl(clean);
    play('click');
    haptic('success');
    setTestResult({ ok: true, message: 'Server endpoint saved!' });
  };

  const handleTestServer = async () => {
    setTestResult({ testing: true });
    haptic('light');
    const res = await testServerConnection(serverUrlInput.trim());
    setTestResult({ testing: false, ok: res.ok, message: res.message });
    if (res.ok) {
      play('click');
      haptic('success');
    } else {
      play('invalid');
      haptic('warning');
    }
  };

  const handleResetServer = () => {
    const def = getDefaultServerUrl();
    setServerUrlInput(def);
    setSettings({ serverUrl: def });
    multiplayer.setServerUrl(def);
    setTestResult(null);
    play('click');
    haptic('light');
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: ui.bg }]} edges={['top', 'bottom']}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Header ui={ui} title="Settings" subtitle="Tune your experience" onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 34 }} showsVerticalScrollIndicator={false}>
        <Text style={[styles.section, { color: ui.textDim }]}>FEEDBACK</Text>
        <Card ui={ui} style={{ paddingVertical: 4 }}>
          <ToggleRow ui={ui} icon="volume-high" tint={theme.players.blue.main} label="Sound effects" desc="Dice, captures and victory jingles" value={s.sound} onValueChange={toggle('sound')} />
          <ToggleRow ui={ui} icon="phone-portrait" tint={theme.players.green.main} label="Haptics" desc="Vibration on taps and big moments" value={s.haptics} onValueChange={toggle('haptics')} />
          <ToggleRow ui={ui} icon="color-wand" tint={theme.players.red.main} label="Animations" desc="Smooth token hops and dice rolls" value={s.animations} onValueChange={toggle('animations')} last />
        </Card>

        <Text style={[styles.section, { color: ui.textDim }]}>GAMEPLAY</Text>
        <Card ui={ui} style={{ paddingVertical: 4 }}>
          <ToggleRow ui={ui} icon="bulb" tint={theme.players.yellow.main} label="Highlight moves" desc="Glow the tokens that can move" value={s.hints} onValueChange={toggle('hints')} />
          <ToggleRow ui={ui} icon="flash" tint={ui.primary} label="Auto-move single token" desc="Move instantly when only one option exists" value={s.autoRoll} onValueChange={toggle('autoRoll')} last />
        </Card>

        <Text style={[styles.section, { color: ui.textDim }]}>DICE SPEED</Text>
        <Segmented
          ui={ui}
          options={[
            { key: 'fast', label: 'Fast' },
            { key: 'normal', label: 'Normal' },
            { key: 'slow', label: 'Slow' },
          ]}
          value={s.diceSpeed}
          onChange={(v) => {
            setSettings({ diceSpeed: v as any });
            play('click');
          }}
        />

        <Text style={[styles.section, { color: ui.textDim }]}>APPEARANCE</Text>
        <Segmented
          ui={ui}
          options={[
            { key: 'auto', label: 'Auto' },
            { key: 'light', label: 'Light' },
            { key: 'dark', label: 'Dark' },
          ]}
          value={s.appearance}
          onChange={(v) => {
            setSettings({ appearance: v as any });
            play('click');
          }}
        />
        <Text style={{ color: ui.textFaint, fontWeight: '600', fontSize: 11.5, marginTop: 8 }}>
          Board colours stay the same — this changes the app chrome around them.
        </Text>

        <Text style={[styles.section, { color: ui.textDim }]}>MULTIPLAYER SERVER</Text>
        <Card ui={ui}>
          <View style={{ paddingVertical: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Ionicons name="server" size={17} color={ui.primary} />
              <Text style={{ color: ui.text, fontWeight: '800', fontSize: 13.5, flex: 1 }}>Server Endpoint</Text>
              <Press onPress={handleResetServer}>
                <Text style={{ color: ui.primary, fontWeight: '800', fontSize: 11.5 }}>Reset Default</Text>
              </Press>
            </View>

            <View
              style={{
                backgroundColor: ui.surfaceAlt,
                borderWidth: 1,
                borderColor: ui.border,
                borderRadius: 10,
                paddingHorizontal: 12,
                paddingVertical: 8,
                marginBottom: 10,
              }}
            >
              <TextInput
                value={serverUrlInput}
                onChangeText={(text) => {
                  setServerUrlInput(text);
                  setTestResult(null);
                }}
                placeholder="https://your-server.onrender.com"
                placeholderTextColor={ui.textFaint}
                autoCapitalize="none"
                autoCorrect={false}
                style={{
                  color: ui.text,
                  fontSize: 13,
                  fontWeight: '600',
                  padding: 0,
                }}
              />
            </View>

            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
              <View style={{ flex: 1 }}>
                <Btn
                  title="Save Endpoint"
                  size="sm"
                  variant="primary"
                  onPress={handleSaveServer}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Btn
                  title={testResult?.testing ? "Testing..." : "Test Connection"}
                  size="sm"
                  variant="secondary"
                  disabled={testResult?.testing}
                  onPress={handleTestServer}
                />
              </View>
            </View>

            {testResult && (
              <View
                style={{
                  backgroundColor: testResult.testing
                    ? alpha(ui.primary, 0.12)
                    : testResult.ok
                    ? alpha('#22C55E', 0.12)
                    : alpha('#EF4444', 0.12),
                  borderRadius: 8,
                  padding: 8,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 8,
                }}
              >
                {testResult.testing ? (
                  <ActivityIndicator size="small" color={ui.primary} />
                ) : (
                  <Ionicons
                    name={testResult.ok ? 'checkmark-circle' : 'alert-circle'}
                    size={16}
                    color={testResult.ok ? '#22C55E' : '#EF4444'}
                  />
                )}
                <Text
                  style={{
                    color: testResult.testing
                      ? ui.primary
                      : testResult.ok
                      ? '#22C55E'
                      : '#EF4444',
                    fontSize: 12,
                    fontWeight: '700',
                    flex: 1,
                  }}
                >
                  {testResult.testing ? 'Testing server reachability...' : testResult.message}
                </Text>
              </View>
            )}

            <Text style={{ color: ui.textFaint, fontSize: 11, fontWeight: '500', lineHeight: 15 }}>
              💡 Vercel only hosts the web application. For online multiplayer (Create / Join room), host <Text style={{ fontWeight: '700' }}>server/server.js</Text> on Render or Railway, and paste the HTTPS endpoint above.
            </Text>
          </View>
        </Card>

        <Text style={[styles.section, { color: ui.textDim }]}>ABOUT</Text>
        <Card ui={ui}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6 }}>
            <Ionicons name="information-circle" size={18} color={ui.primary} />
            <Text style={{ color: ui.textDim, fontWeight: '700', fontSize: 13, marginLeft: 10, flex: 1 }}>Version</Text>
            <Text style={{ color: ui.text, fontWeight: '900', fontSize: 13 }}>1.0.0</Text>
          </View>
          <Press onPress={() => navigation.navigate('Help')}>
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12 }}>
              <Ionicons name="help-buoy" size={18} color={ui.primary} />
              <Text style={{ color: ui.textDim, fontWeight: '700', fontSize: 13, marginLeft: 10, flex: 1 }}>How to play</Text>
              <Ionicons name="chevron-forward" size={16} color={ui.textFaint} />
            </View>
          </Press>
        </Card>

        <View style={{ marginTop: 22 }}>
          <Btn ui={ui} full variant="ghost" label="Reset all progress" icon="trash" onPress={resetAll} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ToggleRow({ ui, icon, tint, label, desc, value, onValueChange, last }: { ui: any; icon: string; tint: string; label: string; desc: string; value: boolean; onValueChange: () => void; last?: boolean }) {
  const p = useSharedValue(value ? 1 : 0);
  const st = useAnimatedStyle(() => ({ transform: [{ translateX: p.value * 22 }] }));
  const bg = useAnimatedStyle(() => ({ backgroundColor: p.value > 0.5 ? ui.primary : ui.border }));

  React.useEffect(() => {
    p.value = withTiming(value ? 1 : 0, { duration: 180 });
  }, [value]);

  return (
    <Press onPress={onValueChange} sound={false}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 13, borderBottomWidth: last ? 0 : 1, borderBottomColor: ui.border }}>
        <View style={[styles.rowIcon, { backgroundColor: alpha(tint, 0.15) }]}>
          <Ionicons name={icon as any} size={16} color={tint} />
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={{ color: ui.text, fontWeight: '800', fontSize: 14.5 }}>{label}</Text>
          <Text style={{ color: ui.textFaint, fontWeight: '600', fontSize: 11.5, marginTop: 2 }}>{desc}</Text>
        </View>
        <Animated.View style={[styles.track, bg]}>
          <Animated.View style={[styles.knob, st]} />
        </Animated.View>
      </View>
    </Press>
  );
}

function Segmented({ ui, options, value, onChange }: { ui: any; options: { key: string; label: string }[]; value: string; onChange: (k: string) => void }) {
  return (
    <View style={[styles.seg, { backgroundColor: ui.surfaceAlt, borderColor: ui.border }]}>
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Press key={o.key} onPress={() => onChange(o.key)} style={{ flex: 1 }} sound={false}>
            <View style={[styles.segItem, on ? { backgroundColor: ui.primary, shadowColor: ui.primary } : null]}>
              <Text style={{ color: on ? ui.onPrimary : ui.textDim, fontWeight: '900', fontSize: 13 }}>{o.label}</Text>
            </View>
          </Press>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  section: { fontWeight: '900', fontSize: 11.5, letterSpacing: 1.6, marginTop: 22, marginBottom: 11 },
  rowIcon: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  track: { width: 50, height: 29, borderRadius: 15, justifyContent: 'center', paddingLeft: 3 },
  knob: { width: 23, height: 23, borderRadius: 12, backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 3, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  seg: { flexDirection: 'row', borderRadius: 16, borderWidth: 1, padding: 4, gap: 4 },
  segItem: { alignItems: 'center', paddingVertical: 10, borderRadius: 12, shadowOpacity: 0.4, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
});
