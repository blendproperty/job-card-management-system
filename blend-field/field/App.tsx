import { useEffect, useState } from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useFonts, Figtree_400Regular, Figtree_500Medium, Figtree_600SemiBold, Figtree_700Bold } from "@expo-google-fonts/figtree";
import { ActivityIndicator, Platform, View } from "react-native";
import { supabase } from "./src/supabase";
import { ApiError, me as loadMe, outcomesFor, clearOutcomeCache } from "./src/api";
import { readOffline, useOfflineAccount, writeOffline } from "./src/offline";
import { clearOutbox, flush, restoreOutbox } from "./src/outbox";
import { SignInScreen } from "./src/screens/SignInScreen";
import { MyDayScreen } from "./src/screens/MyDayScreen";
import { JobScreen } from "./src/screens/JobScreen";
import { Banner, Button, color } from "./src/ui";
import type { Member } from "./src/types";

// M0 navigation: a tiny state stack (sign-in → my day → job). Expo Router replaces it in M1.
type Route = { name: "day" } | { name: "job"; id: string };
type Session = { state: "loading" } | { state: "signed_out" } | { state: "office"; member: Member } | { state: "ready"; member: Member };

export default function App() {
  const [fontsLoaded] = useFonts({ Figtree_400Regular, Figtree_500Medium, Figtree_600SemiBold, Figtree_700Bold });
  const [session, setSession] = useState<Session>({ state: "loading" });
  const [route, setRoute] = useState<Route>({ name: "day" });

  useEffect(() => {
    if (Platform.OS === "web" && "serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/offline-worker.js").catch(() => undefined);
    }
    let disposed = false;
    let account: string | null | undefined;
    let generation = 0;
    const resolve = async (id: string | null) => {
      if (disposed || account === id) return;
      account = id;
      const version = ++generation;
      useOfflineAccount(id);
      clearOutbox();
      clearOutcomeCache();
      setRoute({ name: "day" });
      if (!id) { setSession({ state: "signed_out" }); return; }
      const m = await loadMe().then(async (member) => {
        if (generation === version) await writeOffline("member", member).catch(() => undefined);
        return member;
      }).catch((error: unknown) =>
        error instanceof ApiError && error.status === 0 ? readOffline<Member>("member").catch(() => undefined) : null);
      if (disposed || generation !== version) return;
      if (!m) { setSession({ state: "signed_out" }); return; }
      await restoreOutbox().catch(() => undefined);
      if (disposed || generation !== version) return;
      if (m.role === "engineer" || m.role === "contractor") {
        void outcomesFor(null).catch(() => undefined);
        setSession({ state: "ready", member: m });
      } else {
        setSession({ state: "office", member: m });
      }
    };
    const { data: sub } = supabase.auth.onAuthStateChange((event, authSession) => {
      if (event === "INITIAL_SESSION" || event === "SIGNED_IN" || event === "SIGNED_OUT") {
        setTimeout(() => { void resolve(authSession?.user.id ?? null); }, 0);
      }
    });
    return () => { disposed = true; sub.subscription.unsubscribe(); };
  }, []);

  const signOut = async () => {
    await flush();
    await supabase.auth.signOut({ scope: "local" });
  };

  if (!fontsLoaded || session.state === "loading") {
    return <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: color["nav-bg"] }}><ActivityIndicator color={color.accent} /></View>;
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      {session.state === "signed_out" && <SignInScreen />}
      {session.state === "office" && (
        <View style={{ flex: 1, justifyContent: "center", padding: 16, gap: 16, backgroundColor: color.bg }}>
          <Banner tone="warning">{`${session.member.display_name} is an office account. Use the office website instead.`}</Banner>
          <Button label="Sign out" variant="secondary" onPress={signOut} />
        </View>
      )}
      {session.state === "ready" && route.name === "day" && (
        <MyDayScreen me={session.member} onOpen={(id) => setRoute({ name: "job", id })} onSignOut={signOut} />
      )}
      {session.state === "ready" && route.name === "job" && <JobScreen id={route.id} onBack={() => setRoute({ name: "day" })} />}
    </SafeAreaProvider>
  );
}
