# Agon — Ludo Royale 🎲

A polished, full-featured Ludo (Parcheesi-style) game built with **Expo + React Native + TypeScript**. Play the classic 4-player board game solo against computer opponents, in a quick 1v1, in practice mode, or pass-and-play with a friend on the same device via **Create Room**.

---

## ✨ Features

- **Classic Match** — 2–4 players, mix of humans and CPUs, full board with safe squares, captures, and home lanes.
- **Quick Match** — fast 1v1 against a Medium-difficulty computer.
- **Create Room** *(new)* — set up a 2-player **pass-and-play** match on one device. Generates a shareable room code, lets each player pick a name and colour, and (optionally) fill any remaining seats with computer players.
- **Practice** — solo sandbox to learn the board with no opponents.
- **Local multiplayer anywhere** — in the regular match setup screen you can also swap any computer seat for a "friend" seat (pass-and-play), not just via Create Room.
- **Computer opponents** with 4 difficulty levels (Easy → Expert).
- Profile, statistics, achievements, cosmetic customization (boards, dice, tokens), sound effects, haptics, and light/dark themes.
- Runs on **iOS, Android, and Web** from a single codebase.

### About "Create Room"
This is a **local, same-device pass-and-play room** — there is no backend/server in this project, so a room code is used to label the match (and can be shared as a fun invite), but both players play by taking turns on the one device that created the room. It is **not** internet multiplayer between two separate phones. If you want true cross-device online play, that requires adding a real-time backend (e.g. a WebSocket server or a service like Supabase/Firebase) — this project does not include one.

---

## 🧰 Prerequisites

- [Node.js](https://nodejs.org/) 20+ (LTS recommended)
- npm 10+ (comes with Node)
- The [Expo Go](https://expo.dev/go) app on your phone (easiest way to test on a real device), **or**
- Xcode (for iOS simulator, macOS only) / Android Studio (for Android emulator)

You do **not** need to install the Expo CLI globally — the `npx expo` commands below handle that automatically.

---

## 🚀 Getting started

```bash
# 1. Install dependencies
npm install

# 2. Start the Expo dev server
npm start
```

This opens the Expo developer tools in your terminal with a QR code. From there you can:

- Press **`w`** to open the app in your web browser
- Press **`a`** to open it in a connected Android emulator/device
- Press **`i`** to open it in the iOS simulator (macOS only)
- Scan the QR code with the **Expo Go** app on your phone for the fastest way to try it on a real device

### Platform-specific shortcuts

```bash
npm run web       # Launch directly in the browser
npm run android   # Launch directly on Android
npm run ios       # Launch directly on iOS (macOS only)
```

### If `npm install` complains about peer dependencies

Some Expo/React Native package versions in `package.json` are very recent, and npm's dependency resolver can be strict about peer versions (e.g. `react-native-reanimated` wanting a specific `react-native-worklets` range). If `npm install` fails with an `ERESOLVE` error, run:

```bash
npm install --legacy-peer-deps
```

---

## 📁 Project structure

```
App.tsx                     Root component: fonts, navigation container, screen stack
index.ts                    Expo entry point
app.json                    Expo app config (name, icons, splash, plugins)
eas.json                    EAS Build/Submit profiles (for creating real .ipa/.apk builds)
vercel.json                 Config for deploying the web build to Vercel

src/
  lib/
    types.ts                Shared TypeScript types (Seat, Token, MatchState, GameMode, ...)
    ludo.ts                 Core game rules & board math (moves, captures, win conditions)
    ai.ts                   Computer player logic + difficulty presets
    store.tsx               Global app state (profile, stats, settings) via React Context
    storage.ts               Persistence (AsyncStorage) + achievements + coin rewards
    theme.ts                Visual themes, player colours, dice/token cosmetic styles
    sound.ts                Sound effects & haptics
    nav.ts                  Typed navigation param list

  components/
    Board.tsx                The Ludo board rendering
    TokenView.tsx            Individual token rendering/animation
    Dice.tsx                 Dice rendering/animation
    ui.tsx                   Shared UI kit (buttons, cards, headers, pressables)

  screens/
    SplashScreen.tsx
    OnboardingScreen.tsx
    HomeScreen.tsx           Home hub — launch any game mode, jump to profile/stats/etc.
    GameSetupScreen.tsx      Configure a Classic/Quick/Practice match (seats, colours, difficulty)
    CreateRoomScreen.tsx     New: configure & start a 2-player pass-and-play "room" match
    GameScreen.tsx           The actual match: board, dice, turns, results overlay
    ProfileScreen.tsx
    StatsScreen.tsx
    AchievementsScreen.tsx
    CustomizationScreen.tsx
    SettingsScreen.tsx
    HelpScreen.tsx

assets/                      App icons, splash image, sound effects
scripts/                     Dev utility scripts (sound generation, AI simulation)
```

---

## 🎮 How to play a Create Room match

1. From the Home screen, tap **Create Room** under Game Modes.
2. A room code is generated automatically (tap **New code** to reroll it, or **Share** to send it to a friend as an invite).
3. Enter both players' names and, if you like, tap a player's colour dot to change their colour.
4. Optionally tap **Add a computer player** to fill the remaining 1–2 seats with CPUs.
5. Tap **ENTER ROOM & START**.
6. During the match, the highlighted rail entry and the on-screen prompt ("Your turn" / "`Name`'s turn") tell you whose go it is — pass the device across when the turn changes. Only the active player's dice and tokens are tappable.

## 🕹️ How to add a local friend from the normal setup screen

You don't have to use Create Room to play locally with someone else:

1. Start a **Classic** match from Home.
2. On the setup screen, any computer seat has a **"Swap for a friend playing on this device"** link — tap it to turn that CPU into a second human (pass-and-play) seat.
3. You can swap it back with the **Make CPU** button at any time before starting.

---

## 🧪 Developer scripts

```bash
node scripts/sim.js        # Headless simulation of the AI/game logic (useful when tweaking ludo.ts or ai.ts)
node scripts/gensounds.js  # Regenerate placeholder sound assets
```

---

## 🏗️ Building real apps (optional)

This project is set up for [EAS Build](https://docs.expo.dev/build/introduction/):

```bash
npx eas-cli build --platform android --profile preview
npx eas-cli build --platform ios --profile preview
```

You'll need a free Expo account (`npx eas-cli login`) and, for iOS, an Apple Developer account. For the web version, `npx expo export --platform web` produces a static `dist/` folder that `vercel.json` is already configured to serve.

---

## 🔮 If you want *real* online multiplayer

The current "Create Room" feature is local pass-and-play by design (no backend exists in this project). To turn it into true cross-device multiplayer, the app would need:

1. A backend to hold room/match state (e.g. a small Node/WebSocket server, or a managed service like Supabase Realtime or Firebase Realtime Database).
2. Each client subscribing to that room's state instead of holding it purely in local React state (as `GameScreen.tsx` does today).
3. A way to generate & look up rooms by code server-side, and to reconcile moves/turns between devices (including handling disconnects).

Happy to help design and build that if/when you want to take it in that direction.
