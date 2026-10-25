import 'react-native-gesture-handler';
import React from 'react';
import { NavigationContainer, DarkTheme as NavDarkTheme, DefaultTheme as NavLightTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import Ionicons from '@expo/vector-icons/Ionicons';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { StoreProvider, useStore } from './src/lib/store';
import type { RootStackParamList } from './src/lib/nav';
import SplashScreen from './src/screens/SplashScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import HomeScreen from './src/screens/HomeScreen';
import GameSetupScreen from './src/screens/GameSetupScreen';
import CreateRoomScreen from './src/screens/CreateRoomScreen';
import JoinRoomScreen from './src/screens/JoinRoomScreen';
import RoomLobbyScreen from './src/screens/RoomLobbyScreen';
import GameScreen from './src/screens/GameScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import AchievementsScreen from './src/screens/AchievementsScreen';
import StatsScreen from './src/screens/StatsScreen';
import CustomizationScreen from './src/screens/CustomizationScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import HelpScreen from './src/screens/HelpScreen';

import { ErrorBoundary } from './src/components/ErrorBoundary';

const Stack = createNativeStackNavigator<RootStackParamList>();

function Root() {
  const { isDark, theme } = useStore();
  const ui = isDark ? theme.dark_ : theme.light;

  const base = isDark ? NavDarkTheme : NavLightTheme;
  const navTheme = {
    ...base,
    colors: {
      ...base.colors,
      background: ui.bg,
      card: ui.surface,
      text: ui.text,
      primary: ui.primary,
      border: ui.border,
    },
  };

  return (
    <NavigationContainer theme={navTheme}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack.Navigator
        initialRouteName="Splash"
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          contentStyle: { backgroundColor: ui.bg },
        }}
      >
        <Stack.Screen name="Splash" component={SplashScreen} options={{ animation: 'fade' }} />
        <Stack.Screen name="Onboarding" component={OnboardingScreen} options={{ animation: 'fade' }} />
        <Stack.Screen name="Home" component={HomeScreen} options={{ animation: 'fade' }} />
        <Stack.Screen name="GameSetup" component={GameSetupScreen} />
        <Stack.Screen name="CreateRoom" component={CreateRoomScreen} />
        <Stack.Screen name="JoinRoom" component={JoinRoomScreen} />
        <Stack.Screen name="RoomLobby" component={RoomLobbyScreen} />
        <Stack.Screen name="Game" component={GameScreen} options={{ animation: 'slide_from_bottom', gestureEnabled: false }} />
        <Stack.Screen name="Profile" component={ProfileScreen} />
        <Stack.Screen name="Achievements" component={AchievementsScreen} />
        <Stack.Screen name="Stats" component={StatsScreen} />
        <Stack.Screen name="Customization" component={CustomizationScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
        <Stack.Screen name="Help" component={HelpScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
export default function App() {
  const [fontsLoaded] = useFonts({
    ...Ionicons.font,
    ...FontAwesome.font,
    ...MaterialIcons.font,
  });

  if (!fontsLoaded) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <StoreProvider>
        <ErrorBoundary fallbackTitle="Ludo Royale Encountered an Error">
          <Root />
        </ErrorBoundary>
      </StoreProvider>
    </SafeAreaProvider>
  );
}
