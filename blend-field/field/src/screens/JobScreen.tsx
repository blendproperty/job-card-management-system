import { useCallback, useEffect, useRef, useState, type ComponentRef } from "react";
import { Platform, Pressable, ScrollView, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { myJob, nowIso, storagePath, uuid } from "../api";
import { enqueue, flush, withPending, type FlushResult } from "../outbox";
import { OutcomeSheet, type OutcomeChoice } from "../OutcomeSheet";
import { SignaturePad } from "../SignaturePad";
import { Banner, Button, Card, color, font, OutcomeBadge, StatusPill, T } from "../ui";
import { tokens } from "../theme/tokens";
import { fmtSlot, fmtTime } from "../format";
import type { FieldJob } from "../types";

type PhotoStage = "before" | "during" | "after";
const ON_SITE = ["arrived", "in_progress", "pending"];

/** M03 Job + M04 status flow + M06 photos + M07 signature. */
export function JobScreen({ id, onBack }: { id: string; onBack: () => void }) {
  const insets = useSafeAreaInsets();
  const [job, setJob] = useState<FieldJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "warning" | "danger"; text: string } | null>(null);
  const [busy, setBusy] = useState<null | "status" | "photo" | "signature">(null);
  const [photoStage, setPhotoStage] = useState<PhotoStage>("before");
  const [signer, setSigner] = useState("");
  const [svg, setSvg] = useState<string | null>(null);
  const [nameFocused, setNameFocused] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [workMinutes, setWorkMinutes] = useState("");
  const [overtimeMinutes, setOvertimeMinutes] = useState("0");
  const [workerSigned, setWorkerSigned] = useState(false);
  const validSignoff = /^[0-9]{1,5}$/.test(workMinutes) && /^[0-9]{1,5}$/.test(overtimeMinutes) &&
    Number(workMinutes) <= 10080 && Number(overtimeMinutes) <= Number(workMinutes) && workerSigned;
  const [offline, setOffline] = useState(false);
  const scroller = useRef<ComponentRef<typeof ScrollView>>(null);
  const sectionY = useRef<{ photo?: number; signature?: number }>({});

  const load = useCallback(async () => {
    try {
      const j = await myJob(id);
      setJob(withPending(j));
      setError(null);
      if (j.stage === "in_progress") setPhotoStage((s) => (s === "before" ? "after" : s));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [id]);
  // Start loading after an async boundary (load sets state).
  useEffect(() => { Promise.resolve().then(load); }, [load]);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const reconnect = () => { void flush().then((result) => {
      setOffline(result.offline);
      if (result.rejected.length) setNotice({ tone: "danger", text: result.rejected.map((x) => x.reason).join(" ") });
      return load();
    }); };
    window.addEventListener("online", reconnect);
    return () => window.removeEventListener("online", reconnect);
  }, [load]);

  const after = async (r: FlushResult) => {
    if (r.rejected.length) setNotice({ tone: "danger", text: r.rejected.map((x) => x.reason).join(" ") });
    else if (r.offline) setNotice({ tone: "warning", text: "No signal. Saved on this phone and will send when you're back online." });
    else setNotice(null);
    setOffline(r.offline);
    await load();
    return r;
  };

  const advance = async () => {
    if (!job?.next) return;
    if (job.next.to === "completed") { setSheet(true); return; } // OutcomeSheet decides how it ends
    setBusy("status");
    try {
      await after(await enqueue({ op_id: uuid(), type: "status", job_id: job.id, to: job.next.to, occurred_at: nowIso() }));
    } finally { setBusy(null); }
  };

  /** Completion with an outcome. Accepted or queued offline → true; rejected by the server → false. */
  const finishWith = async ({ outcome, comment }: OutcomeChoice) => {
    if (!job) return false;
    const r = await after(await enqueue({
      op_id: uuid(), type: "status", job_id: job.id, to: "completed", occurred_at: nowIso(),
      resolution_id: outcome.id, resolution_comment: comment,
      work_minutes: Number(workMinutes), overtime_minutes: Number(overtimeMinutes), worker_signed: workerSigned,
    }));
    return r.rejected.length === 0;
  };

  const requestFollowUp = async (note: string | null) => {
    if (!job) return;
    await after(await enqueue({ op_id: uuid(), type: "follow_up", job_id: job.id, note, occurred_at: nowIso() }));
    setNotice((n) => n ?? { tone: "warning", text: "Follow-up requested. The office will book it." });
  };

  const goTo = (step: "photo" | "signature") => {
    setSheet(false);
    const y = sectionY.current[step];
    if (y !== undefined) setTimeout(() => scroller.current?.scrollTo({ y: Math.max(0, y - 8), animated: true }), 250);
  };

  const addPhoto = async (fromLibrary = Platform.OS === "web") => {
    if (!job) return;
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 0.6, exif: false };
    if (!fromLibrary) {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) { setNotice({ tone: "warning", text: "Camera access is off. Turn it on in Settings, or choose from your library." }); return; }
    }
    const res = fromLibrary ? await ImagePicker.launchImageLibraryAsync(opts) : await ImagePicker.launchCameraAsync(opts);
    if (res.canceled || !res.assets[0]) return;
    setBusy("photo");
    try {
      const asset = res.assets[0];
      // ArrayBuffer, not Blob: Blob uploads from React Native arrive empty in Supabase Storage.
      const file = await fetch(asset.uri);
      const body = await file.arrayBuffer();
      const type = asset.mimeType ?? (file.headers.get("content-type") || "image/jpeg");
      const attachment_id = uuid();
      await after(await enqueue(
        { op_id: uuid(), type: "attachment", job_id: job.id, attachment_id, kind: "photo", stage: photoStage, taken_at: nowIso(), content_type: type, bytes: body.byteLength },
        { attachment_id, path: storagePath(job.org_id, job.id, attachment_id, type), body, content_type: type },
      ));
    } finally { setBusy(null); }
  };

  const saveSignature = async () => {
    if (!job || !svg) return;
    setBusy("signature");
    try {
      const attachment_id = uuid();
      const body = new TextEncoder().encode(svg).buffer as ArrayBuffer;
      await after(await enqueue(
        { op_id: uuid(), type: "attachment", job_id: job.id, attachment_id, kind: "signature", stage: "after", taken_at: nowIso(), signer_name: signer.trim() || null, content_type: "image/svg+xml", bytes: body.byteLength },
        { attachment_id, path: storagePath(job.org_id, job.id, attachment_id, "image/svg+xml"), body, content_type: "image/svg+xml" },
      ));
      setSvg(null);
    } finally { setBusy(null); }
  };

  const photos = job?.attachments.filter((a) => a.kind === "photo") ?? [];
  const signature = job?.attachments.find((a) => a.kind === "signature");
  const onSite = !!job && ON_SITE.includes(job.stage);
  const missing = [
    ...((job?.trade ? photos.some((p) => p.stage === "before") && photos.some((p) => p.stage === "after") : photos.length)
      ? [] : [{ key: "photo" as const, label: job?.trade ? "Add before and after photos" : "Add at least one photo" }]),
    ...(signature ? [] : [{ key: "signature" as const, label: "Get the customer's signature" }]),
  ];

  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <View style={{ backgroundColor: color["nav-bg"], paddingTop: insets.top + 8, paddingHorizontal: 8, paddingBottom: 14 }}>
        <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="Back to today" style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: 8, alignSelf: "flex-start" }}>
          <T variant="sm" weight="semibold" style={{ color: color.accent }}>‹ Today</T>
        </Pressable>
        {job && (
          <View style={{ paddingHorizontal: 8 }}>
            <T variant="xs" style={{ color: color["on-nav-muted"] }}>JOB {job.number}</T>
            <T variant="lg" weight="bold" style={{ color: color["on-nav"] }} accessibilityRole="header">{job.title}</T>
          </View>
        )}
      </View>
      {notice && <Banner tone={notice.tone}>{notice.text}</Banner>}

      <ScrollView ref={scroller} contentContainerStyle={{ padding: 16, gap: 16 }}>
        {error && <Banner tone="danger">{error}</Banner>}
        {!job && !error && <T muted>Loading…</T>}
        {job && (
          <>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              <StatusPill stage={job.stage} />
              {job.resolution && <OutcomeBadge name={job.resolution.name} successful={job.resolution.successful} />}
            </View>
            {job.resolution_comment && <T variant="sm" muted>{job.resolution_comment}</T>}
            <Card>
              <T weight="semibold">{job.site.label}</T>
              <T variant="sm" muted>{job.site.address}</T>
              <T variant="sm" muted>{fmtSlot(job.scheduled_start, job.scheduled_end)}</T>
              {job.site.access_notes && <T variant="sm"><T variant="sm" weight="semibold">Access: </T>{job.site.access_notes}</T>}
              {job.description && <T variant="sm">{job.description}</T>}
            </Card>

            {(onSite || photos.length > 0) && (
              <View style={{ gap: 8 }} onLayout={(e) => { sectionY.current.photo = e.nativeEvent.layout.y; }}>
                <Label>Photos</Label>
                {photos.length > 0 && (
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                    {photos.map((p) => (
                      <View key={p.id} accessible accessibilityLabel={`${p.stage} photo, ${fmtTime(p.taken_at)}${p.uploaded_at ? "" : ", uploading"}`}
                        style={{ width: 72, height: 72, borderRadius: tokens.radius.sm, backgroundColor: color["surface-2"], justifyContent: "flex-end", padding: 4 }}>
                        <T variant="xs" weight="bold" style={{ backgroundColor: color.bg, borderRadius: 4, paddingHorizontal: 4, alignSelf: "flex-start", textTransform: "capitalize" }}>{p.stage}</T>
                        {!p.uploaded_at && <T variant="xs" style={{ position: "absolute", top: 4, right: 4, color: color.warning }}>↑</T>}
                      </View>
                    ))}
                  </View>
                )}
                {onSite && !job.locked_at && (
                  <>
                    <View accessibilityRole="radiogroup" accessibilityLabel="Photo type" style={{ flexDirection: "row", borderRadius: tokens.radius.md, borderWidth: 1, borderColor: color.border, overflow: "hidden" }}>
                      {(["before", "during", "after"] as const).map((st) => (
                        <Pressable key={st} onPress={() => setPhotoStage(st)} accessibilityRole="radio" accessibilityState={{ checked: photoStage === st }}
                          style={{ flex: 1, minHeight: 44, alignItems: "center", justifyContent: "center", backgroundColor: photoStage === st ? color["accent-soft"] : color.bg }}>
                          <T variant="sm" weight={photoStage === st ? "semibold" : "regular"} style={{ textTransform: "capitalize" }}>{st}</T>
                        </Pressable>
                      ))}
                    </View>
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      <Button style={{ flex: 1 }} variant="secondary" label={Platform.OS === "web" ? "Add photo" : "Take photo"} loading={busy === "photo"} onPress={() => addPhoto()} />
                      {Platform.OS !== "web" && <Button style={{ flex: 1 }} variant="secondary" label="From library" onPress={() => addPhoto(true)} />}
                    </View>
                  </>
                )}
              </View>
            )}

            {job.trade && job.stage === "in_progress" && (
              <Card>
                <Label>Worker sign-off</Label>
                <T>Total work time (minutes)</T>
                <TextInput accessibilityLabel="Total work time in minutes" inputMode="numeric" value={workMinutes} onChangeText={setWorkMinutes} style={{ minHeight: 44, borderWidth: 1, borderColor: color.border, padding: 8 }} />
                <T>Overtime included (minutes)</T>
                <TextInput accessibilityLabel="Overtime included in total work time" inputMode="numeric" value={overtimeMinutes} onChangeText={setOvertimeMinutes} style={{ minHeight: 44, borderWidth: 1, borderColor: color.border, padding: 8 }} />
                <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: workerSigned }} onPress={() => setWorkerSigned(!workerSigned)} style={{ minHeight: 44, justifyContent: "center" }}>
                  <T>{workerSigned ? "✓" : "□"} I confirm these work details and sign off as the assigned worker</T>
                </Pressable>
              </Card>
            )}

            {(onSite || signature) && (
              <View style={{ gap: 8 }} onLayout={(e) => { sectionY.current.signature = e.nativeEvent.layout.y; }}>
                <Label>Tenant signature</Label>
                {signature ? (
                  <Card><T variant="sm">Signed by <T variant="sm" weight="semibold">{signature.signer_name ?? "customer"}</T> at {fmtTime(signature.taken_at)}</T></Card>
                ) : (
                  <>
                    <T variant="sm" weight="semibold" nativeID="signer-label">Tenant name</T>
                    <TextInput
                      accessibilityLabel="Tenant name"
                      value={signer}
                      onChangeText={setSigner}
                      placeholder="Who is signing?"
                      placeholderTextColor={color["text-subtle"]}
                      autoComplete="name"
                      onFocus={() => setNameFocused(true)}
                      onBlur={() => setNameFocused(false)}
                      style={[
                        { height: 48, borderWidth: 1, borderColor: color["border-input"], borderRadius: tokens.radius.sm, paddingHorizontal: 12, fontSize: 16, fontFamily: font.regular, color: color.text },
                        nameFocused && { borderColor: color.focus, borderWidth: 2, paddingHorizontal: 11 },
                        Platform.OS === "web" && ({ outlineStyle: "none" } as object),
                      ]}
                    />
                    <SignaturePad onChange={setSvg} disabled={busy === "signature"} />
                    <Button variant="secondary" label="Save signature" disabled={!svg || !signer.trim()} loading={busy === "signature"} onPress={saveSignature} />
                  </>
                )}
              </View>
            )}
          </>
        )}
      </ScrollView>

      {job?.next && !job.locked_at && (
        <View style={{ padding: 16, paddingBottom: insets.bottom + 16, borderTopWidth: 1, borderTopColor: color.border, gap: 6 }}>
          <Button tall label={job.next.label} disabled={!!job.trade && job.next.to === "completed" && !validSignoff} loading={busy === "status"} onPress={advance} />
        </View>
      )}
      {job?.locked_at && (
        <View style={{ padding: 16, paddingBottom: insets.bottom + 16, borderTopWidth: 1, borderTopColor: color.border }}>
          <T variant="sm" muted style={{ textAlign: "center" }}>Completed and sent to the office.</T>
        </View>
      )}
      {job && sheet && (
        <OutcomeSheet visible jobTypeId={job.job_type_id} missing={missing} offline={offline}
          onGoTo={goTo} onFinish={finishWith} onFollowUp={requestFollowUp} onClose={() => setSheet(false)} />
      )}
    </View>
  );
}

function Label({ children }: { children: string }) {
  return <T variant="xs" weight="semibold" muted style={{ textTransform: "uppercase", letterSpacing: 0.5 }}>{children}</T>;
}
