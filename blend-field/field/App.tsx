import { useEffect, useState } from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useFonts, Figtree_400Regular, Figtree_500Medium, Figtree_600SemiBold, Figtree_700Bold } from "@expo-google-fonts/figtree";
import { ActivityIndicator, View } from "react-native";
import { supabase } from "./src/supabase";
import { me as loadMe } from "./src/api";
import { clearOutbox } from "./src/outbox";
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
    const resolve = async (signedIn: boolean) => {
      if (!signedIn) { setSession({ state: "signed_out" }); return; }
      const m = await loadMe().catch(() => null);
      if (!m) { setSession({ state: "signed_out" }); return; }
      setSession(m.role === "engineer" || m.role === "contractor" ? { state: "ready", member: m } : { state: "office", member: m });
    };
    supabase.auth.getSession().then(({ data }) => resolve(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") { setRoute({ name: "day" }); resolve(!!s); }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const signOut = async () => { clearOutbox(); await supabase.auth.signOut(); };

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
