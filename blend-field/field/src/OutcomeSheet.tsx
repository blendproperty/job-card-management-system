import { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { outcomesFor } from "./api";
import { Banner, Button, color, font, T } from "./ui";
import { tokens } from "./theme/tokens";
import type { Outcome } from "./types";

export type OutcomeChoice = { outcome: Outcome; comment: string | null };

/**
 * components.md OutcomeSheet: "How did it go?". Done outcomes need photo + signature;
 * "Couldn't finish" outcomes need neither. Finishing stays disabled until an outcome is chosen.
 * After an outcome that suggests a follow-up, the sheet asks "Book a follow-up?".
 */
export function OutcomeSheet({ visible, jobTypeId, missing, offline, onGoTo, onFinish, onFollowUp, onClose }: {
  visible: boolean;
  jobTypeId: string | null;
  /** Steps still missing for a Done outcome, e.g. [{key:"photo", label:"Add at least one photo"}]. */
  missing: { key: "photo" | "signature"; label: string }[];
  offline: boolean;
  onGoTo: (step: "photo" | "signature") => void;
  /** Resolves true when the completion was accepted (or queued offline). */
  onFinish: (c: OutcomeChoice) => Promise<boolean>;
  onFollowUp: (note: string | null) => Promise<void>;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [outcomes, setOutcomes] = useState<Outcome[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<Outcome | null>(null);
  const [comment, setComment] = useState("");
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<"choose" | "follow_up">("choose");
  const [note, setNote] = useState("");

  // The parent mounts the sheet only while open, so state starts fresh every time.
  useEffect(() => {
    let alive = true;
    outcomesFor(jobTypeId).then((o) => alive && setOutcomes(o)).catch((e: Error) => alive && setError(e.message));
    return () => { alive = false; };
  }, [jobTypeId]);

  const commentMissing = !!picked?.requires_comment && !comment.trim();
  const blockedByMissing = !!picked?.successful && missing.length > 0;
  const canFinish = !!picked && !commentMissing && !blockedByMissing && !busy;

  const finish = async () => {
    setTouched(true);
    if (!picked || !canFinish) return;
    setBusy(true);
    const ok = await onFinish({ outcome: picked, comment: comment.trim() || null });
    setBusy(false);
    if (!ok) return;
    if (picked.suggest_follow_up) setStep("follow_up");
    else onClose();
  };

  const group = (title: string, list: Outcome[]) => (
    <View accessibilityRole="radiogroup" accessibilityLabel={title} style={{ gap: 8 }}>
      <T variant="xs" weight="semibold" muted style={{ textTransform: "uppercase", letterSpacing: 0.5 }}>{title}</T>
      {list.map((o) => {
        const on = picked?.id === o.id;
        const accent = o.successful ? color["outcome-done-bg"] : color["outcome-failed-bg"];
        return (
          <Pressable key={o.id} onPress={() => setPicked(o)} accessibilityRole="radio" accessibilityState={{ checked: on }}
            accessibilityLabel={`${o.name}${o.requires_comment ? ", needs a comment" : ""}`}
            style={{ minHeight: 52, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, borderRadius: tokens.radius.md,
              borderWidth: on ? 2 : 1, borderColor: on ? accent : color.border, backgroundColor: on ? color.surface : color.bg }}>
            <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: on ? accent : color["border-input"], alignItems: "center", justifyContent: "center" }}>
              {on && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: accent }} />}
            </View>
            <T weight={on ? "semibold" : "regular"} style={{ flex: 1 }}>{o.name}</T>
          </Pressable>
        );
      })}
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={busy ? undefined : onClose}>
      <View style={{ flex: 1, backgroundColor: "rgba(8,33,33,0.45)", justifyContent: "flex-end" }}>
        <View accessibilityViewIsModal style={{ backgroundColor: color.bg, borderTopLeftRadius: tokens.radius.lg, borderTopRightRadius: tokens.radius.lg, maxHeight: "90%", paddingBottom: insets.bottom + 16 }}>
          <View style={{ flexDirection: "row", alignItems: "center", padding: 16, paddingBottom: 8 }}>
            <T variant="lg" accessibilityRole="header" style={{ flex: 1 }}>{step === "choose" ? "How did it go?" : "Book a follow-up?"}</T>
            {!busy && <T variant="sm" weight="semibold" style={{ color: color["accent-text"], padding: 8 }} accessibilityRole="button" onPress={onClose}>{step === "choose" ? "Cancel" : "Close"}</T>}
          </View>

          {step === "choose" ? (
            <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 4, gap: 18 }} keyboardShouldPersistTaps="handled">
              {error && <Banner tone="danger">{error}</Banner>}
              {!outcomes && !error && <T muted>Loading outcomes…</T>}
              {outcomes && group("Done", outcomes.filter((o) => o.successful))}
              {outcomes && group("Couldn't finish", outcomes.filter((o) => !o.successful))}

              {blockedByMissing && (
                <View style={{ gap: 6 }} accessibilityLiveRegion="polite">
                  <T variant="sm" weight="semibold">Needed before you can mark it done:</T>
                  {missing.map((m) => (
                    <T key={m.key} variant="sm" weight="semibold" accessibilityRole="button" onPress={() => onGoTo(m.key)}
                      style={{ color: color["accent-text"], paddingVertical: 6 }}>{`${m.label} ›`}</T>
                  ))}
                </View>
              )}

              {picked && (
                <View style={{ gap: 6 }}>
                  <T variant="sm" weight="semibold">{picked.requires_comment ? "What happened? (required)" : "Comment (optional)"}</T>
                  <TextInput value={comment} onChangeText={setComment} onBlur={() => setTouched(true)} multiline
                    accessibilityLabel={picked.requires_comment ? "Comment, required" : "Comment"}
                    placeholder={picked.successful ? "Anything the office should know" : "e.g. Rang twice, no answer"}
                    placeholderTextColor={color["text-subtle"]}
                    style={[{ minHeight: 88, borderWidth: 1, borderRadius: tokens.radius.sm, padding: 12, fontSize: 16, fontFamily: font.regular, color: color.text, textAlignVertical: "top",
                      borderColor: touched && commentMissing ? color.danger : color["border-input"] }, { outlineStyle: "none" } as object]} />
                  {touched && commentMissing && <T variant="xs" style={{ color: color.danger }}>{`Add a comment for "${picked.name}".`}</T>}
                </View>
              )}

              <Button tall label={offline ? "Finish job (will sync)" : "Finish job"} disabled={!canFinish} loading={busy} onPress={finish}
                accessibilityHint={!picked ? "Choose how the job went first" : blockedByMissing ? missing.map((m) => m.label).join(". ") : undefined} />
            </ScrollView>
          ) : (
            <View style={{ padding: 16, gap: 14 }}>
              <T muted>The office will get a request to book another visit. You can add a note.</T>
              <TextInput value={note} onChangeText={setNote} accessibilityLabel="Note for the office" placeholder="e.g. Tenant home after 14:00"
                placeholderTextColor={color["text-subtle"]}
                style={[{ height: 48, borderWidth: 1, borderColor: color["border-input"], borderRadius: tokens.radius.sm, paddingHorizontal: 12, fontSize: 16, fontFamily: font.regular, color: color.text }, { outlineStyle: "none" } as object]} />
              <Button tall label="Yes, ask the office" loading={busy}
                onPress={async () => { setBusy(true); await onFollowUp(note.trim() || null); setBusy(false); onClose(); }} />
              <Button label="Not now" variant="secondary" disabled={busy} onPress={onClose} />
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}
