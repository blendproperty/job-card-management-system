// Access-rule tests against the local database: each seeded user signs in and we check what
// they can see and do. Run after `npm run db:reset`:  npm run test:rls
// Sign-in uses an admin-generated one-time code (local only), then verifyOtp like the apps do.
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
if (!/127\.0\.0\.1|localhost/.test(url)) throw new Error("Local database only.");

let failed = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `  ${detail}`}`);
  if (!ok) failed++;
};

async function as(email) {
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (error) throw error;
  const c = createClient(url, anonKey, { auth: { persistSession: false } });
  const { error: e2 } = await c.auth.verifyOtp({ email, token: data.properties.email_otp, type: "email" });
  if (e2) throw e2;
  return c;
}

const naledi = await as("naledi@blend.test");
const thandi = await as("thandi@blend.test");
const johan = await as("johan@blend.test");
const sam = await as("sam@otherco.test");
const anon = createClient(url, anonKey, { auth: { persistSession: false } });

const titles = async (c) => ((await c.from("jobs").select("title").order("number")).data ?? []).map((r) => r.title);

// ── visibility ──
check("office sees all 4 Blend jobs, not Other Co's", (await titles(naledi)).length === 4 && !(await titles(naledi)).includes("Other org's private job"));
check("Thandi sees only her 2 assigned jobs", JSON.stringify((await titles(thandi)).sort()) === JSON.stringify(["Change locks after move-out", "Geyser not heating"]));
check("Johan sees only his 1 job", (await titles(johan)).length === 1);
check("Other Co office sees only its own job", JSON.stringify(await titles(sam)) === JSON.stringify(["Other org's private job"]));
check("signed-out client sees no jobs", (await titles(anon)).length === 0);
check("signed-out client sees no members", ((await anon.from("members").select("id")).data ?? []).length === 0);
check("Thandi can't list clients (office-only)", ((await thandi.from("clients").select("id")).data ?? []).length === 0);
check("Thandi sees sites only for her jobs", ((await thandi.from("sites").select("label")).data ?? []).length === 2);

// ── direct writes are blocked for field users ──
const geyser = (await thandi.from("jobs").select("id, org_id").eq("title", "Geyser not heating").single()).data;
const upd = await thandi.from("jobs").update({ stage: "completed" }).eq("id", geyser.id).select();
check("Thandi can't update a job row directly", (upd.data ?? []).length === 0);
const ev = await thandi.from("job_events").insert({ org_id: geyser.org_id, job_id: geyser.id, kind: "note", occurred_at: new Date().toISOString() });
check("Thandi can't insert job events directly", !!ev.error);

// ── field ops through the database function ──
const now = () => new Date().toISOString();
const ops = (c, list) => c.rpc("field_apply_ops", { p_ops: list }).then((r) => { if (r.error) throw r.error; return r.data; });
const status = (job, to, id = randomUUID()) => ({ op_id: id, type: "status", job_id: job, to, occurred_at: now() });

let r = await ops(thandi, [status(geyser.id, "completed")]);
check("skipping a stage is rejected", r[0].status === "rejected" && /assigned/.test(r[0].reason), JSON.stringify(r));

const enRoute = randomUUID();
r = await ops(thandi, [status(geyser.id, "en_route", enRoute), status(geyser.id, "arrived"), status(geyser.id, "in_progress")]);
check("en route → arrived → in progress accepted", r.every((x) => x.status === "ok"), JSON.stringify(r));
r = await ops(thandi, [status(geyser.id, "en_route", enRoute)]);
check("replayed op is a duplicate, not re-applied", r[0].status === "duplicate");

const outcome = async (c, name) => (await c.from("resolutions").select("id").eq("name", name).single()).data.id;
const fixed = await outcome(thandi, "Fixed");
const notHome = await outcome(thandi, "Tenant not home");
const complete = (job, resolution_id, resolution_comment, id = randomUUID()) =>
  ({ ...status(job, "completed", id), resolution_id, resolution_comment });

check("field users can read their org's outcomes", ((await thandi.from("resolutions").select("id")).data ?? []).length === 6);
check("Other Co can't see Blend's outcomes", ((await sam.from("resolutions").select("id").eq("id", fixed)).data ?? []).length === 0);
check("field users can't edit outcomes", ((await thandi.from("resolutions").update({ name: "x" }).eq("id", fixed).select()).data ?? []).length === 0);

r = await ops(thandi, [status(geyser.id, "completed")]);
check("completing without an outcome is rejected", r[0].status === "rejected" && /how the job went/i.test(r[0].reason), JSON.stringify(r));
r = await ops(thandi, [complete(geyser.id, fixed)]);
check("'Done' outcome without photo is rejected", r[0].status === "rejected" && /photo/i.test(r[0].reason), JSON.stringify(r));
r = await ops(thandi, [complete(geyser.id, notHome, "  ")]);
check("required comment missing is rejected", r[0].status === "rejected" && /comment/i.test(r[0].reason), JSON.stringify(r));
const otherOutcome = (await sam.from("resolutions").select("id").eq("name", "Fixed").single()).data.id;
r = await ops(thandi, [complete(geyser.id, otherOutcome)]);
check("another org's outcome is rejected", r[0].status === "rejected", JSON.stringify(r));

// A failed outcome needs no photo or signature: use the locks job (assigned → … → in progress first).
const locks = (await thandi.from("jobs").select("id").eq("title", "Change locks after move-out").single()).data;
await ops(thandi, [status(locks.id, "en_route"), status(locks.id, "arrived"), status(locks.id, "in_progress")]);
const failedOp = randomUUID();
r = await ops(thandi, [complete(locks.id, notHome, "Rang twice, no answer. Guard has no key.", failedOp)]);
check("failed outcome with no photo is accepted", r[0].status === "ok", JSON.stringify(r));
r = await ops(thandi, [complete(locks.id, notHome, "again", failedOp)]);
check("replayed completion is a duplicate", r[0].status === "duplicate", JSON.stringify(r));
const lockRow = (await naledi.from("jobs").select("stage, resolution:resolutions(name, successful), resolution_comment").eq("id", locks.id).single()).data;
check("office sees the outcome and comment", lockRow.stage === "completed" && lockRow.resolution?.name === "Tenant not home" && /no answer/.test(lockRow.resolution_comment ?? ""), JSON.stringify(lockRow));
const ev2 = (await naledi.from("job_events").select("payload").eq("client_op_id", failedOp).single()).data;
check("outcome stored in the event payload", ev2?.payload?.resolution_name === "Tenant not home" && ev2?.payload?.successful === false, JSON.stringify(ev2));
r = await ops(thandi, [{ op_id: randomUUID(), type: "follow_up", job_id: locks.id, note: "Book for after 14:00", occurred_at: now() }]);
check("follow-up request allowed on a completed job", r[0].status === "ok", JSON.stringify(r));
r = await ops(johan, [{ op_id: randomUUID(), type: "follow_up", job_id: locks.id, occurred_at: now() }]);
check("follow-up request refused for someone not on the job", r[0].status === "rejected");
const direct = await naledi.from("jobs").update({ stage: "completed" }).eq("title", "Gate motor stuck half open").select();
check("a job can't be completed without an outcome, even by the office", !!direct.error, JSON.stringify(direct.data));

r = await ops(johan, [status(geyser.id, "pending")]);
check("Johan can't move Thandi's job", r[0].status === "rejected");

// photo: record, upload, confirm
const photoId = randomUUID();
r = await ops(thandi, [{ op_id: randomUUID(), type: "attachment", job_id: geyser.id, attachment_id: photoId, kind: "photo", stage: "after", taken_at: now(), content_type: "image/png", bytes: 68 }]);
check("photo attachment recorded", r[0].status === "ok", JSON.stringify(r));
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
const path = `${geyser.org_id}/${geyser.id}/${photoId}.png`;
let up = await johan.storage.from("job-files").upload(path, png, { contentType: "image/png" });
check("Johan can't upload into Thandi's job", !!up.error);
up = await thandi.storage.from("job-files").upload(`${geyser.org_id}/${geyser.id}/${randomUUID()}.png`, png, { contentType: "image/png" });
check("upload for an unrecorded attachment is refused", !!up.error);
up = await thandi.storage.from("job-files").upload(path, png, { contentType: "image/png" });
check("Thandi uploads her recorded photo", !up.error, up.error?.message);
up = await thandi.storage.from("job-files").upload(path, png, { contentType: "image/png", upsert: true });
check("uploaded photo can't be overwritten", !!up.error);
const mark = await thandi.rpc("field_mark_uploaded", { p_attachment: photoId, p_path: path });
check("photo marked uploaded", !mark.error && !!mark.data?.uploaded_at, mark.error?.message);

// signature
const sigId = randomUUID();
const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path d="M1 1 L9 9" stroke="#000"/></svg>';
r = await ops(thandi, [{ op_id: randomUUID(), type: "attachment", job_id: geyser.id, attachment_id: sigId, kind: "signature", stage: "after", taken_at: now(), signer_name: "Test Tenant", content_type: "image/svg+xml", bytes: svg.length }]);
const sigPath = `${geyser.org_id}/${geyser.id}/${sigId}.svg`;
up = await thandi.storage.from("job-files").upload(sigPath, new Blob([svg], { type: "image/svg+xml" }), { contentType: "image/svg+xml" });
await thandi.rpc("field_mark_uploaded", { p_attachment: sigId, p_path: sigPath });
check("signature recorded and uploaded", r[0].status === "ok" && !up.error, up.error?.message);

r = await ops(thandi, [complete(geyser.id, fixed)]);
check("'Done' completion accepted with photo + signature", r[0].status === "ok", JSON.stringify(r));
const done = (await naledi.from("jobs").select("stage, locked_at, on_site_seconds").eq("id", geyser.id).single()).data;
check("office sees it completed, locked, with time on site", done.stage === "completed" && !!done.locked_at && done.on_site_seconds !== null, JSON.stringify(done));
r = await ops(thandi, [status(geyser.id, "pending")]);
check("ops on a completed job are rejected", r[0].status === "rejected");
const offEdit = await naledi.from("jobs").update({ title: "edited" }).eq("id", geyser.id);
check("office can't edit a locked job either", !!offEdit.error);

// files: office reads via signed URL, outsider can't
const signed = await naledi.storage.from("job-files").createSignedUrl(path, 60);
check("office gets a signed URL for the photo", !!signed.data?.signedUrl, signed.error?.message);
const samSigned = await sam.storage.from("job-files").createSignedUrl(path, 60);
check("Other Co can't get a URL for Blend's photo", !samSigned.data?.signedUrl);

// office assignment function
const leak = (await naledi.from("jobs").select("id").eq("title", "Leak under kitchen sink").single()).data;
const asg = await sam.rpc("assign_job", { p_job: leak.id, p_members: [] });
check("Other Co can't assign Blend's job", !!asg.error);
const thandiMember = (await naledi.from("members").select("id").eq("display_name", "Thandi Mokoena").single()).data;
const ok = await naledi.rpc("assign_job", { p_job: leak.id, p_members: [thandiMember.id] });
check("office assigns a job", !ok.error && ok.data?.stage === "assigned", ok.error?.message);
check("Thandi now sees 3 jobs", (await titles(thandi)).length === 3);
const tAssign = await thandi.rpc("assign_job", { p_job: leak.id, p_members: [thandiMember.id] });
check("Thandi can't use the office assign function", !!tAssign.error);

console.log(failed ? `\n${failed} FAILED` : "\nAll access rules hold.");
process.exit(failed ? 1 : 0);
