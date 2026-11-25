import { ActivityIndicator, Pressable, StyleSheet, Text, View, type PressableProps, type TextProps, type ViewProps } from "react-native";
import { tokens } from "./theme/tokens";
import { STAGE_LABEL, type Stage } from "./types";

const c = tokens.color;
export const font = { regular: "Figtree_400Regular", medium: "Figtree_500Medium", semibold: "Figtree_600SemiBold", bold: "Figtree_700Bold" };
const t = tokens.type;

export function T({ style, variant = "base", weight, muted, ...p }: TextProps & {
  variant?: keyof typeof t; weight?: keyof typeof font; muted?: boolean;
}) {
  const v = t[variant];
  const w = weight ?? (v.weight >= 700 ? "bold" : v.weight >= 600 ? "semibold" : v.weight >= 500 ? "medium" : "regular");
  return (
    <Text
      {...p}
      style={[{ fontFamily: font[w], fontSize: v.size, lineHeight: v.line, color: muted ? c["text-muted"] : c.text }, style]}
    />
  );
}

/** components.md Button + StatusActionBar sizing. Mobile default is lg (48); action bar uses 56. */
export function Button({ label, onPress, variant = "primary", disabled, loading, tall, icon, style, ...p }: PressableProps & {
  label: string; variant?: "primary" | "secondary" | "danger"; loading?: boolean; tall?: boolean; icon?: React.ReactNode;
}) {
  const bg = variant === "primary" ? c.accent : variant === "danger" ? c.danger : c.bg;
  const fg = variant === "primary" ? c["on-accent"] : variant === "danger" ? c["on-danger"] : c.text;
  const off = disabled || loading;
  return (
    <Pressable
      {...p}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      accessibilityLabel={label}
      disabled={off}
      onPress={onPress}
      style={({ pressed }) => [
        s.btn,
        { backgroundColor: pressed && variant === "primary" ? c["accent-hover"] : bg, height: tall ? 56 : tokens.layout["touch-min"] },
        variant === "secondary" && { borderWidth: 1, borderColor: c["border-input"] },
        off && { opacity: 0.5 },
        pressed && { transform: [{ translateY: 1 }] },
        style as object,
      ]}
    >
      {loading ? <ActivityIndicator color={fg} /> : icon}
      <T variant={tall ? "base" : "sm"} weight="semibold" style={{ color: fg }}>{label}</T>
    </Pressable>
  );
}

const STATUS: Record<Stage, { fg: string; bg: string; dot: string }> = {
  unassigned: { fg: c["status-unassigned-fg"], bg: c["status-unassigned-bg"], dot: c["status-unassigned-dot"] },
  assigned: { fg: c["status-assigned-fg"], bg: c["status-assigned-bg"], dot: c["status-assigned-dot"] },
  en_route: { fg: c["status-en-route-fg"], bg: c["status-en-route-bg"], dot: c["status-en-route-dot"] },
  arrived: { fg: c["status-arrived-fg"], bg: c["status-arrived-bg"], dot: c["status-arrived-dot"] },
  in_progress: { fg: c["status-in-progress-fg"], bg: c["status-in-progress-bg"], dot: c["status-in-progress-dot"] },
  pending: { fg: c["status-pending-fg"], bg: c["status-pending-bg"], dot: c["status-pending-dot"] },
  completed: { fg: c["status-completed-fg"], bg: c["status-completed-bg"], dot: c.accent },
  cancelled: { fg: c["status-cancelled-fg"], bg: c["status-cancelled-bg"], dot: c["status-cancelled-dot"] },
};

export function StatusPill({ stage }: { stage: Stage }) {
  const st = STATUS[stage];
  return (
    <View style={[s.pill, { backgroundColor: st.bg }]} accessible accessibilityLabel={`Status: ${STAGE_LABEL[stage]}`}>
      <View style={[s.dot, { backgroundColor: st.dot }]} />
      <T variant="xs" weight="semibold" style={{ color: st.fg }}>{STAGE_LABEL[stage]}</T>
    </View>
  );
}

/** components.md OutcomeBadge: done = near-black with a check, couldn't finish = solid red with an X. */
export function OutcomeBadge({ name, successful }: { name: string; successful: boolean }) {
  const fg = successful ? c["outcome-done-fg"] : c["outcome-failed-fg"];
  return (
    <View accessible accessibilityLabel={`Outcome: ${name} (${successful ? "done" : "not done"})`}
      style={[s.pill, { backgroundColor: successful ? c["outcome-done-bg"] : c["outcome-failed-bg"] }]}>
      <T variant="xs" weight="bold" style={{ color: fg }}>{successful ? "✓" : "✕"}</T>
      <T variant="xs" weight="semibold" style={{ color: fg }}>{name}</T>
    </View>
  );
}

export function Card({ style, accent, ...p }: ViewProps & { accent?: boolean }) {
  return <View {...p} style={[s.card, accent && { borderLeftWidth: 4, borderLeftColor: c.accent }, style]} />;
}

export function Banner({ tone, children }: { tone: "warning" | "danger" | "info"; children: React.ReactNode }) {
  const map = { warning: [c["warning-soft"], c.warning], danger: [c["danger-soft"], c.danger], info: [c["accent-soft"], c.text] } as const;
  return (
    <View accessibilityRole="alert" style={[s.banner, { backgroundColor: map[tone][0] }]}>
      <T variant="sm" weight="semibold" style={{ color: map[tone][1] }}>{children}</T>
    </View>
  );
}

export const s = StyleSheet.create({
  btn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: tokens.radius.md, paddingHorizontal: 20 },
  pill: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", height: 22, paddingHorizontal: 9, borderRadius: tokens.radius.pill },
  dot: { width: 7, height: 7, borderRadius: 4 },
  card: { borderWidth: 1, borderColor: c.border, borderRadius: tokens.radius.md, padding: 12, gap: 6, backgroundColor: c.bg },
  banner: { paddingHorizontal: 16, paddingVertical: 8 },
});

export { c as color };
