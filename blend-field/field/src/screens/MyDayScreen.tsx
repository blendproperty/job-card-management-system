import { useCallback, useEffect, useState } from "react";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { myJobs } from "../api";
import { flush, onPending, pendingCount } from "../outbox";
import { Banner, Button, Card, color, OutcomeBadge, StatusPill, T } from "../ui";
import { fmtSlot } from "../format";
import type { FieldJob } from "../types";

/** M02 My day: today's jobs in slot order; the first open one is marked Next. */
export function MyDayScreen({ me, onOpen, onSignOut }: {
  me: { display_name: string }; onOpen: (id: string) => void; onSignOut: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [jobs, setJobs] = useState<FieldJob[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [pending, setPending] = useState(pendingCount());

  useEffect(() => onPending(setPending), []);

  const load = useCallback(async () => {
    setRefreshing(true);
    await flush();
    try {
      const list = await myJobs();
      setJobs(list);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRefreshing(false);
    }
  }, []);
  // Start loading after an async boundary (load sets state).
  useEffect(() => { Promise.resolve().then(load); }, [load]);

  const open = jobs?.filter((j) => j.stage !== "completed") ?? [];
  const done = jobs?.filter((j) => j.stage === "completed") ?? [];
  const nextId = open[0]?.id;

  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <View style={{ backgroundColor: color["nav-bg"], paddingTop: insets.top + 14, paddingHorizontal: 16, paddingBottom: 14, flexDirection: "row", alignItems: "flex-end" }}>
        <View style={{ flex: 1 }}>
          <T variant="lg" weight="bold" style={{ color: color["on-nav"] }} accessibilityRole="header">Today</T>
          <T variant="xs" style={{ color: color["on-nav-muted"] }}>{me.display_name} · {jobs ? `${open.length} to do` : "loading"}</T>
        </View>
        <T variant="sm" weight="semibold" style={{ color: color.accent, padding: 8 }} onPress={onSignOut} accessibilityRole="button">Sign out</T>
      </View>
      {pending > 0 && <Banner tone="warning">Offline · {pending} change{pending === 1 ? "" : "s"} saved on this phone</Banner>}
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: insets.bottom + 24 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={color["accent-text"]} />}
      >
        {error && <Banner tone="danger">{error}</Banner>}
        {jobs && jobs.length === 0 && (
          <Card style={{ alignItems: "center", paddingVertical: 32 }}>
            <T weight="semibold">No jobs for you today</T>
            <T muted variant="sm">The office will send new jobs here.</T>
          </Card>
        )}
        {open.map((j) => <JobCard key={j.id} job={j} next={j.id === nextId} onPress={() => onOpen(j.id)} />)}
        {done.length > 0 && <T variant="xs" weight="semibold" muted style={{ marginTop: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Done</T>}
        {done.map((j) => <JobCard key={j.id} job={j} onPress={() => onOpen(j.id)} />)}
        <Button label={refreshing ? "Refreshing" : "Refresh"} variant="secondary" loading={refreshing} onPress={load} />
      </ScrollView>
    </View>
  );
}

function JobCard({ job, next, onPress }: { job: FieldJob; next?: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${next ? "Next job. " : ""}Job ${job.number}, ${job.title}, ${job.site.label}`}>
      {({ pressed }) => (
        <Card accent={next} style={pressed && { backgroundColor: color.surface }}>
          <T variant="xs" muted style={{ fontFamily: "monospace" }}>{next ? `NEXT · ${job.number}` : job.number}</T>
          <T weight="semibold" numberOfLines={2}>{job.title}</T>
          <T variant="sm" muted numberOfLines={1}>{job.site.label}</T>
          <T variant="sm" muted>{fmtSlot(job.scheduled_start, job.scheduled_end)}</T>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            <StatusPill stage={job.stage} />
            {job.resolution && <OutcomeBadge name={job.resolution.name} successful={job.resolution.successful} />}
          </View>
        </Card>
      )}
    </Pressable>
  );
}
