import { useState } from "react";
import { ScrollView, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../supabase";
import { Banner, Button, color, font, T } from "../ui";
import { tokens } from "../theme/tokens";

/** M01 Sign in: emailed 6-digit code. Invite-only (shouldCreateUser: false). Phone/SMS codes come with Twilio. */
export function SignInScreen() {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focus, setFocus] = useState<string | null>(null);

  const send = async () => {
    const e = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(e)) { setError("Enter a valid email address."); return; }
    setBusy(true); setError(null);
    const { error: err } = await supabase.auth.signInWithOtp({ email: e, options: { shouldCreateUser: false } });
    setBusy(false);
    // Same answer for unknown addresses, so this screen can't be used to find accounts.
    if (err?.status === 429) { setError("Too many tries. Wait a minute and try again."); return; }
    if (err && /fetch|network/i.test(err.message)) { setError("No connection. Check your signal and try again."); return; }
    setEmail(e); setStep("code");
  };

  const verify = async () => {
    const token = code.replace(/\D/g, "");
    if (token.length !== 6) { setError("Enter the 6 digits from the email."); return; }
    setBusy(true); setError(null);
    const { error: err } = await supabase.auth.verifyOtp({ email, token, type: "email" });
    setBusy(false);
    if (err) setError(err.status === 429 ? "Too many tries. Wait a minute." : "That code didn't work. Check it, or send a new one.");
    // On success App's auth listener moves on.
  };

  const input = (name: string) => [
    { height: 48, borderWidth: 1, borderColor: color["border-input"], borderRadius: tokens.radius.sm, paddingHorizontal: 12, fontSize: 16, fontFamily: font.regular, color: color.text },
    focus === name && { borderColor: color.focus, borderWidth: 2, paddingHorizontal: 11 },
    { outlineStyle: "none" } as object,
  ];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: color["nav-bg"] }} contentContainerStyle={{ padding: 16, paddingTop: insets.top + 32, gap: 24 }} keyboardShouldPersistTaps="handled">
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: color.accent }} />
        <T variant="lg" weight="bold" style={{ color: color["on-nav"] }}>Blend Field</T>
      </View>
      <View style={{ backgroundColor: color.bg, borderRadius: tokens.radius.lg, padding: 20, gap: 14 }}>
        <T variant="xl" accessibilityRole="header">Sign in</T>
        {error && <Banner tone="danger">{error}</Banner>}
        {step === "email" ? (
          <>
            <T variant="sm" weight="semibold" nativeID="email-label">Work email</T>
            <TextInput accessibilityLabel="Work email" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email"
              keyboardType="email-address" inputMode="email" onSubmitEditing={send} returnKeyType="send"
              onFocus={() => setFocus("email")} onBlur={() => setFocus(null)} style={input("email")} />
            <Button label="Email me a code" tall loading={busy} onPress={send} />
            <T variant="xs" muted>No password. The office adds team members; ask them if you can{"'"}t get in.</T>
          </>
        ) : (
          <>
            <Banner tone="info">{`If ${email} is on the team, a 6-digit code is on its way.`}</Banner>
            <T variant="sm" weight="semibold" nativeID="code-label">6-digit code</T>
            <TextInput accessibilityLabel="6-digit code" value={code} onChangeText={setCode} keyboardType="number-pad" inputMode="numeric"
              autoComplete="one-time-code" textContentType="oneTimeCode" maxLength={6} autoFocus onSubmitEditing={verify}
              onFocus={() => setFocus("code")} onBlur={() => setFocus(null)} style={[...input("code"), { letterSpacing: 8, fontSize: 20 }]} />
            <Button label="Sign in" tall loading={busy} onPress={verify} />
            <T variant="sm" weight="semibold" style={{ color: color["accent-text"], paddingVertical: 8 }} accessibilityRole="button"
              onPress={() => { setStep("email"); setCode(""); setError(null); }}>Use a different email</T>
          </>
        )}
      </View>
    </ScrollView>
  );
}
