# Project context

## 2026-11-25 — Foundation imported; pilot not ready

Implementation: Imported the tracked Blend Field M0 source from local commit e5294f1 into `blend-field/`, preserving the existing preliminary prototype and server sketch. It contains a Next.js office app, Expo field app, Supabase/Postgres migrations, private evidence storage rules and outcomes. The import is a starting point; its prior reported behavior is not independently confirmed by this entry. Joy's 24 November response requests automatic trade assignment with reassignment, elapsed duration, timestamped work/photo events and reliable offline operation. The original proposal and Brett's review email also cover tenant requests, approvals, work/overtime, evidence, signatures and final FM closure. These remain requirements, not claims that every feature is implemented.

Testing: Source import taken from a clean local commit. On the original identical source, web and field TypeScript checks and lint passed; the local Next.js development server returned HTTP 200 on /login. Clean npm installs in the imported checkout succeeded; npm reported 3 web vulnerabilities (2 high, 1 moderate) and 3 moderate field vulnerabilities. The authenticated workflow and access suite were not rerun. The field outbox is in memory and is not durable offline sync. Real-device camera/signature, isolation, complete workflow and recovery tests remain outstanding.

Commit and push: foundation committed as b948baa and pushed to codex/blend-field-foundation-20261125; remote head and PROJECT_CONTEXT.md presence verified. This evidence update follows on the same branch. Merge: not performed. Deployment and configuration: not performed; the existing Cloudflare sketch is not a standalone VPS service and Blend Field needs Supabase services in addition to Postgres. VPS access was verified by SSH to srv938083 but the available account cannot access Docker and passwordless sudo was denied. DNS, secrets, auth, SMTP, storage, backup and restore configuration remain to be established. Live production verification: none.

Provider: Twilio inventory shows +27 60 017 8025 as Job Card Mobile with SMS and voice enabled. It is absent from the visible WhatChimp channel list and Twilio WhatsApp sender list. WhatChimp's Meta onboarding was started for that number; Meta reported an SMS verification code sent. Registration, templates, delivery, opt-in, WhatsApp and staff acceptance remain unverified. No customer notifications were sent. Joy/team workflow decisions, property/worker data, role approval, offline/device UAT, deployment, backup recovery, training and pilot sign-off remain open.



## 2026-11-25 — VPS preparation, deployment not yet performed

Implementation: Added a non-root multi-stage Next.js Dockerfile, standalone build configuration, Docker ignore file and Traefik Compose configuration for an isolated office app. Upgraded Next.js and eslint-config-next to 16.4.6 and Zod to 4.6.7, adjusting validation and ESLint configuration. This does not implement the remaining job-card workflows. The original provider and pilot gates below remain open.

Testing: Docker Compose configuration validation passed with placeholder public settings. The updated production Docker image built successfully with placeholder Supabase settings; TypeScript and ESLint passed, and npm audit after upgrade reported zero vulnerabilities. These checks do not validate authentication, access controls or the operational workflow. The image has not been connected to a hosted backend or tested on the VPS.

Commit and push: container and dependency changes committed as 3625771 and pushed to codex/blend-field-foundation-20261125; this evidence checkpoint follows. Merge: none. Deployment and configuration: no application or database containers deployed. The prior admin-account Docker restriction was resolved: an existing root deployment key successfully accessed Docker. Server readback showed Traefik on root_default, sufficient apparent free disk and available memory, and wildcard DNS resolving both proposed jobcards and jobcards-api hostnames to the VPS. An official Supabase source checkout at commit b2cd26e0546f801946226a1096b49d4a04ab586c was placed at /opt/job-cards-supabase for preparation only; no Supabase service was started, secrets generated or configuration applied. Existing SMTP configuration is present but suitability for GoTrue and delivery remain untested. Live production verification: none.

Outstanding: isolate and configure Supabase/Postgres, TLS routing, secrets, SMTP and OTP templates; apply migrations and create approved accounts; implement and test tenant intake, approvals, allocation/reassignment, overtime, timestamped evidence, signatures, FM closure, durable offline sync and notifications; verify access boundaries, backups/restores, real devices and staff UAT. WhatChimp sender verification and delivery remain open. Do not treat this foundation as a complete hosted pilot.


## 2026-11-25 — Isolated VPS backend started

Implementation: No additional application workflow implemented in this checkpoint. Three existing Blend Field SQL migrations were applied successfully, each in a separate transaction, to a new empty self-hosted Supabase/Postgres database.

Testing: `docker compose config --quiet` passed; Postgres, Auth, REST, Storage, Studio, gateway and pooler reported healthy on inspection. Migration commands exited successfully. Application authorization, data, backup/restore, SMTP, user sign-in and real workflow were not tested.

Commit and push: context checkpoint follows on codex/blend-field-foundation-20261125. Merge: none. Deployment and configuration: official Supabase Docker checkout b2cd26e0546f801946226a1096b49d4a04ab586c configured at /opt/job-cards-supabase/docker as isolated Compose project jobcards, with fresh generated secrets and disabled signup. Gateway and pooler published to loopback only; no public Traefik route or office app deployed. Public URLs are placeholders pending TLS routing. The server reported 8.8 GiB available memory and 80 GiB free disk after startup. Existing SMTP credentials were identified but not copied or configured. Live production verification: none. Sender verification, messaging, access, features, UAT, data, recovery, training and approval gates remain open.

## 2026-11-25 — Blend Job Cards office app live on its own VPS route

Implementation: Added the Traefik override for the dedicated Supabase API and the private job-files bucket migration. The office runtime was built on the VPS from d393322. Provisioned Brett's existing work address as administrator in the new Blend Property organisation, with a clearly labelled sample client and property.

Testing: Compose validation and the VPS image build passed. A server-generated OTP authenticated the owner and returned the expected property through the API. Public HTTPS checks returned 200 for login, 307 from jobs to login without a session, 404 at the API root, and 401 for an unauthenticated REST call.

Commit and push: Deployment configuration, migration and this checkpoint follow on the dedicated development branch. Merge: none. Deployment and configuration: office app is running at https://jobcards.srv938083.hstgr.cloud, with its own Supabase/Postgres, storage and API host at https://jobcards-api.srv938083.hstgr.cloud. The first credential for the existing Blend email sender was rejected with SMTP 535. The working credential for the same sender was configured on Job Cards only, with the display name Blend Job Cards. Signup remains disabled. No STOR24 database, sender, routes or service configuration were used or modified.

Live production verification: Public HTTPS and the authenticated database read passed. Live OTP request returned HTTP 200 and Outlook confirmed arrival at 09:37 SAST. The owner's first interactive sign-in and the full application workflow remain unverified. Field app rollout, tenant approvals, auto-allocation, durable offline sync, production data, staff UAT, recovery and training remain open. Job Card Mobile +27 60 017 8025 is the designated number. Meta verification and WhatChimp connection, templates and delivery remain pending. No WhatsApp notifications were sent.

## 2026-11-25 — Tenant intake, trade allocation and office closure

Implementation: Invited tenants with explicit property access can log maintenance requests and see their own status. Staff can log requests for approval. Office approval can allocate a matching active worker by trade, preferring the named worker if one was selected and otherwise considering open workload. If nobody matches, the approved job stays unassigned for dispatch. Staff can reassign after approval. An administrator can record final closure after field completion. A successful outcome requires uploaded before and after photos and a customer signature for closure. Job details show logged, work-started, completed and photo-upload times and elapsed time.

Testing: TypeScript and ESLint passed. Local Postgres applied both migrations in a transaction and verified tenant property and job visibility, out-of-scope request rejection, the pre-approval assignment gate, matching-trade allocation, manual reassignment, premature closure rejection and tenant status updates. The test rolled back. Contractor and tenant device acceptance remain open.

Commit and push: implementation checkpoint follows on codex/blend-field-foundation-20261125. Merge: none. Deployment and configuration: pending. Live production verification: pending.

The current delivery scope still includes dedicated FM role/access, overtime and contractor sign-off, field app rollout, durable offline operation, handset testing, and WhatChimp on Job Card Mobile +27 60 017 8025. Real tenant and worker profiles, trade assignments, staff acceptance and recovery verification remain open. No later milestone is a prerequisite to working on these items.

## 2026-11-25 — Office workflow and field web app deployed

Implementation: Office and tenant workflows described above are deployed. The existing Expo field app is packaged as a browser app with a dedicated Traefik route and the Job Cards Supabase endpoint.

Testing: The VPS built the Next.js production image and Expo browser bundle. The local transactional workflow check also confirmed missing evidence blocks final closure, one closure event survives a repeated request, and the tenant can see closure. The Expo dependency audit still reports three moderate findings, including a transitive minimatch advisory in Expo tooling.

Commit and push: Office workflow b46a44b and field deployment cb33154 pushed to codex/blend-field-foundation-20261125. Merge: none. Deployment and configuration: both SQL migrations applied in one transaction to the dedicated Job Cards Postgres. Office runtime b46a44b and field runtime cb33154 deployed in separate Docker services. No live users or worker trade mappings were added and no messaging settings changed.

Live production verification: Office login returned HTTPS 200, unauthenticated requests redirected to login, and both workflow functions were present in live Postgres. Field HTML and JavaScript returned HTTPS 200 after certificate issuance. The field bundle points to the dedicated Job Cards API, and the live API allowed the field origin for auth requests. Real tenant and engineer sign-in, private media upload and full workflow UAT remain unverified. The administrator role is the current closure authority. Dedicated FM access, contractor sign-off, overtime, durable offline use, native device rollout, WhatsApp setup, approved data, backup/restore and staff acceptance remain open.

## 2026-11-25 — Showcase workflows and office workspace

Implementation: Replaced the milestone placeholders with working schedule, client and property, asset, invoice draft, job report, field location and team settings screens. Added mobile office navigation, opt-in browser location sharing, account-scoped browser storage for cached field jobs and queued changes, worker sign-off and time capture, a dedicated organisation-scoped facility manager role, overtime approval and closure.

Testing: TypeScript and lint passed for office and field. Local PostgreSQL rolled back transactional checks that covered tenant scope, approval and allocation, reassignment, field transitions, sign-off requirements and facility manager overtime approval, with one audited closure event. Browser restart, media replay and live testing are pending this checkpoint.

Commit and push: implementation follows on codex/blend-field-foundation-20261125. Merge: none. Deployment and configuration: pending. Live production verification: pending.

The invoice screen supports local draft records. Xero export, payments, owner quote decisions, recurring asset service automation, native app release, approved live data, backup/restore and staff acceptance remain open. WhatChimp live delivery depends on verification and templates for Job Card Mobile +27 60 017 8025.

## 2026-11-25 — Showcase release deployed and checked on the hosted app

Implementation: All seven office sections that previously displayed milestone placeholders now work against the Job Cards database. They cover scheduling, clients and properties, asset registration, invoice drafts, reports, shared locations, and team trade settings. Field completion records the authenticated worker's sign-off, total work and overtime. The organisation-scoped facility manager can approve or decline overtime and close the job. The field browser caches its app shell, jobs and queued changes, including photos, by account.

Testing: TypeScript and lint passed for both apps. The Next.js and Expo Docker images built on the VPS. Transactional Postgres checks exercised role gates and work sign-off. A live browser test under simulated loss of connectivity verified that a queued arrival and photo survived a full reload and synced to Postgres and private storage when reconnected. The successful job then proceeded through before and after uploads, customer signature, worker sign-off, facility manager approval of 15 overtime minutes and closure. The manager's browser decoded both authorised private photos and signature, rendered all seven office pages and created a R977.50 draft. The tenant browser saw Closed and was redirected away from the private office job.

Commit and push: Office and field runtime fa1b936 pushed to the dedicated branch and deployed. Merge: none. Deployment and configuration: migration 000004 added the facility manager role before migration 000005 applied work sign-off and overtime enforcement. A pre-change DB dump was captured, but restore was not tested. Both services run in Docker behind their existing dedicated Traefik routes. Test sessions were removed and synthetic test worker and manager memberships were deactivated. Showcase Job #1000 (c41a9df9-bee9-446d-ac33-34466d0df60b) is the completed walkthrough and sample #1001 (d0cbc95b-5b5f-4881-b432-d6383d1ac627) is awaiting approval. Sample evidence uses synthetic test photographs and signature. Owner-managed showcase alias recipients were created for tenant, field and manager. SMTP/API accepted all three OTPs following retries, but inbox delivery for the aliases was not confirmed and operational invitations remain open.

Live production verification: Both HTTPS apps and the synthetic tenant-to-manager workflow were checked against the dedicated Job Cards database. Real handset, staff and tenant UAT remain open. The offline test covers the installed browser shell and jobs previously loaded while online. Native install release, Xero and payments, owner quote decisions, recurring asset-service automation, backup restoration and approved production data remain open. WhatsApp live sending is still gated by Meta verification, connection and approved templates for Job Card Mobile +27 60 017 8025. No STOR24 sender, data or credentials were used. No WhatsApp message was sent.

## 2026-11-25 — Tenant contacts and distinct role views

Implementation: Added tenant dashboard and new-request views. Name, surname, company and phone come from the tenant's saved profile, and email comes from the authenticated account. New requests retain a contact snapshot for authorised managers. The office new-job form can select a tenant with access to the selected property. The Trade app stays on its dedicated site, and the office is labelled PM / FM. A read-only role switcher uses sample information and links to the authenticated workspaces.

Testing: Office TypeScript and lint passed. Local PostgreSQL checks verified profile requirements, self-only writes, verified email capture, stable job contact snapshots, property-scoped manager selection and exclusion of private contact data from other tenants and the trade role.

Commit and push: implementation follows on the Job Cards development branch. Merge: none. Deployment and live verification: pending this checkpoint. Existing handover, account delivery, WhatChimp, field handset, operational data, recovery, native app and provider gates remain open.

## 2026-11-25 — Tenant contacts and role views verified live

Implementation: The tenant profile, tenant dashboard, office contact selector, private contact snapshot and read-only role views from the previous entry are live. Existing jobs retain their original records. Showcase job #1002 contains synthetic requester details for demonstrating the manager's new contact panel.

Testing: Local transactional checks and office TypeScript and lint passed. The VPS Next.js production image built successfully. Mobile-sized live browser checks opened all three public sample previews, saved a tenant profile, confirmed login email and single-property prefill, submitted a request, and saw Awaiting approval on the tenant dashboard. The facility manager opened job #1002, saw the five contact fields, and could select the same tenant after choosing their property in New job.

Commit and push: Runtime 8c87fdc pushed to codex/blend-field-foundation-20261125 and deployed to the dedicated VPS. Merge: none. Deployment and configuration: applied migration 000006 after taking a database dump. Test grants and temporary session files were removed. Trade runtime continues on its existing dedicated route. Live production verification: verified with synthetic accounts. Real tenant onboarding and delivery of role-alias codes, handset UAT, WhatChimp, approved operational data, backup restoration and original rollout gates remain open. No provider settings or STOR24 resources were changed.

## 2026-11-25 — Tenant and trade registers

Implementation: Replaced the office Clients navigation with Tenants, Trades and Properties. The old /clients URL redirects to Tenants. Managers enter or upload first name, surname, company, email and contact number by property/unit. Trade contacts also record their trade. Property owners and billing relationships remain under Properties. Imports validate the batch before writing, update matching contacts and audit the manager's writes. Added the numbered operational implementation plan in blend-field/docs/implementation-plan.md, informed by the Blend Field and Planado analyses.

Testing: Office TypeScript and lint passed. Local Postgres applied migration 000007. A rolled-back transaction verified manager create/update, actor audit, denial for tenant and worker and another organisation, and rejection of a cross-organisation property association.

Commit and push: implementation follows on codex/blend-field-foundation-20261125. Merge: none. Deployment and configuration: pending this checkpoint. Live production verification: pending. Uploaded contacts do not automatically create accounts, grant property access or qualify trade contacts for dispatch. Real data, role/recipient onboarding, building-specific allocation, WhatChimp, handset UAT, backup restoration and original rollout gates remain open.

## 2026-11-25 — Tenant and trade registers deployed and verified

Implementation: The managers' Tenants and Trades pages now show the five contact fields, property/unit selection, manual entry and CSV upload. Trades also capture trade category. Properties retains property owners and site setup. The numbered implementation plan is on the same GitHub branch.

Testing: VPS Next.js production Docker build passed and the install reported zero npm vulnerabilities. Live HTTPS browser checks with synthetic accounts verified /clients redirected to /tenants when signed in as FM, all tenant fields saved, a South African number was normalised, a malformed trade CSV wrote no records, a valid CSV with a quoted comma saved, and re-upload updated the record without duplicating it. Properties loaded and accounts without office access were redirected. Local Postgres RLS checks covered cross-organisation, tenant and trade access.

Commit and push: 8d4d73b pushed to codex/blend-field-foundation-20261125. This evidence checkpoint follows on that branch. Merge: none. Deployment and configuration: migration 000007 applied transactionally to the dedicated Job Cards Postgres after a pre-change custom-format dump. Docker deployed office runtime 8d4d73b behind the existing Traefik HTTPS route. Live production verification: the synthetic browser workflow passed. Fixture contacts and audit rows were removed, the synthetic manager was deactivated and temporary auth sessions were revoked.

Outstanding: approved tenant and trade imports, production invitations and unit access linking, property-scoped PM/AM/FM permissions, building-specific automatic dispatch and trade eligibility, approved email and in-app delivery flows, WhatChimp sender verification and delivery on +27 60 017 8025, staff and handset UAT, backup restoration and operational acceptance remain open. Uploading a register contact saves their details at that site. Account activation and dispatch setup are separate. No messaging configuration changed.

## 2026-11-25 — Tenant-to-contractor workflow

Implementation: Tenant requests now allocate directly when the selected property/unit and trade have a configured active, skilled contractor. Requests with special requirements, an unclassified trade or no eligible rule are recorded for manual review. Approval of a fallback tenant request leaves assignment to the manager. Manager assignment and automatic assignment use the same audited database path. In-app notifications appear in the tenant and contractor portals. The existing offline field evidence, time and tenant signature flow continues into manager closure. The directory and role preview now say Contractors.

Testing: Local Supabase/Postgres migration and a rollback-based test passed for rule creation, automatic assignment, fallback without a match and with special requirements, approval leaving manual allocation, repeated assignment deduplication, alert rules and cross-organisation isolation.

Commit and push: implementation follows on codex/blend-field-foundation-20261125. Merge: none. Deployment and live verification: pending this checkpoint. External email and WhatChimp delivery, actual participants and approved operational rule data, handsets, recovery and live acceptance remain open.

## 2026-11-25 — Tenant-to-contractor demo live on the VPS

Implementation: Added property/unit dispatch rules for active contractors with the selected trade, an auditable manual-review fallback, tenant and contractor in-app alerts, and the Contractors directory and labels. The demonstration uses the existing field workflow for work timestamps, before and after photos, reported time, tenant signature, contractor sign-off and manager overtime approval/closure.

Testing: Office and field TypeScript and lint passed. The rollback-based Postgres checks passed for automatic assignment, absent-match and special-requirement fallback, no automatic assignment on fallback approval, idempotent repeat assignment, and alert isolation. Live browser testing at mobile viewport created tenant requests #1003 and #1004. Plumbing auto-assigned; electrical went through FM approval and manual assignment. The contractor saw both assignment notifications, opened #1003 from its notification, uploaded before and after images, recorded 40 minutes including 5 minutes overtime, and captured a synthetic tenant signature. The FM decoded the two private photos and signature, approved overtime and closed the job. The tenant portal displayed closure and its in-app alert.

Commit and push: runtime ec1901d pushed to codex/blend-field-foundation-20261125. This verification entry follows on the same branch. Merge: none.
Deployment and configuration: both Next.js and Expo web production images built and deployed to the dedicated Job Cards Docker/Traefik services. Migration 000008 applied in one transaction after a nonempty custom-format Postgres backup. The Showcase Building Unit 101 plumbing rule now targets the existing owner-controlled demonstration contractor account. Electrical has no automatic rule for the demo. The owner-controlled demo tenant alias has a synthetic contact profile; the test-only memberships, access and temporary sessions used for browser verification were revoked. No STOR24 services or provider settings were changed.
Live production verification: authenticated synthetic browser testing passed end to end. Office and contractor entry points returned HTTP 200. The auth provider accepted a login-code request for the owner-controlled tenant alias; receipt did not appear in the checked mailbox results. Browser verification used generated synthetic sessions. Job notification delivery is in-app. External workflow email and WhatChimp on +27 60 017 8025, alias inbox delivery, approved production dispatch rules, real handset and staff acceptance, and backup restoration remain open.

## 2026-11-25 — Opt-in job notification email

Implementation: Tenant and contractor portals let users opt in to job email at their verified sign-in address. New workflow alerts queue one email per event and recipient. Before sending, the worker checks preferences and current job access. Managers see job email outcomes and attempt counts without recipient addresses. SMTP acceptance is tracked separately from inbox delivery. The independent mail worker uses a restricted database login, TLS SMTP and bounded retries. An interrupted send with an ambiguous outcome is preserved for review.

Testing: Local PostgreSQL checked opt-in, double-recipient queueing, cross-organisation isolation, privileged claim/finish access, retry timing, uncertain outcomes and skipped delivery after opt-out. Python test transport verified safe email content and SMTP acceptance, retry, failure and interruption handling.

Commit and push: implementation follows on codex/blend-field-foundation-20261125. Merge: none. Deployment, provider and live verification: pending. WhatChimp and proof of external inbox delivery remain open.

## 2026-11-25 — Hostinger job email live on the VPS

Implementation: Opt-in tenant and contractor email notifications and manager job-level status are live. New emails use the approved Hostinger mailbox no-reply@onpointoffices.co.za. In-app alerts remain available independently. The mail worker checks the recipient's active job access and opt-in and uses bounded retries and a distinct uncertain state.

Testing: Office and contractor TypeScript and lint, unit transport checks, local Postgres rollback tests and all three VPS container builds passed. Authenticated live browser testing confirmed both portals save opt-in and opt-out, and the manager page showed the live test's SMTP acceptance in one attempt. The dedicated worker authenticated to Postgres and Hostinger SMTP over TLS. Test-only access, preferences, contact details and sessions were cleaned up. No tenant or contractor outside the test received an email.

Commit and push: Application and worker revision 9fba99c pushed to codex/blend-field-foundation-20261125 and deployed. This evidence checkpoint follows on the same branch. Merge: none.
Deployment and configuration: Postgres migration 000009 applied transactionally after a nonempty database dump. Deployed updated Next.js and Expo web containers and a private Docker mail worker using a dedicated restricted database login. Hostinger's existing Job Cards sender was reused. No mailbox credentials, DNS records, STOR24 resources or WhatChimp settings were changed.
Live production verification: Job #1005 generated one test email to the workspace owner's existing address. Hostinger SMTP accepted it at 13:06:40 SAST on attempt one. No matching Outlook result or sender bounce was observed during verification. hPanel confirmed the sender mailbox and separately showed a prior test-alias message queued by the receiving gateway, which is not proof of inbox receipt. Recipient inbox delivery of #1005, demo alias inbox delivery, WhatChimp on +27 60 017 8025, approved operational recipients and rules, real-user and device acceptance, and backup restoration remain open.

## 2026-11-25 — Job #1005 recipient-side email trace

Implementation: No application changes. Hostinger remains the configured sender. Resend was evaluated as a transactional alternative, with separate sending-domain verification and delivery/bounce webhooks, and was not connected.
Testing and live production verification: Hostinger's outbound log for the 13:06:40 SAST test showed the receiving server accepted job #1005 at 13:06:41 SAST, queued as 592634C2043. The recipient domain's MX points to Mimecast. The exact subject and application-generated Message-ID were absent from Outlook queries, no matching bounce was found in the sender inbox, and the Microsoft Defender quarantine search returned no match. The Exchange session showed only My account rather than mail-flow tools. Mimecast Personal Portal required a Domain or Cloud password. The exact disposition after SMTP acceptance and inbox delivery remain unverified.
Commit and push: evidence-only update follows on codex/blend-field-foundation-20261125. Merge: none. Deployment and configuration: no changes. Scope of the unresolved work is the Mimecast trace or other recipient-side disposition for the exact message. Preserve the alias-delivery, WhatChimp, production data, UAT and recovery gates.

## 2026-11-25 — Job #1005 Outlook receipt confirmed

Live production verification: The workspace owner confirmed receipt and supplied an Outlook screenshot showing the opened Blend Job Cards #1005 test email and its tenant portal link. Combined with the existing Hostinger and gateway trace, this verifies end-to-end delivery for this one test. The screenshot does not establish the inbox arrival time or the reason earlier Outlook searches returned no match. The receipt resolves the #1005 inbox verification item in the previous entries. Demo alias receipt, operational recipients, WhatChimp, real-user and device acceptance, and backup restoration remain open.

Implementation and testing: Evidence update only. Commit and push: this checkpoint follows on codex/blend-field-foundation-20261125. Merge: none. Deployment and configuration: no change. Hostinger remains the active sender.

## 2026-11-25 — Job summary email layout

Implementation: Added a branded HTML job notification with a job-details table, a role-appropriate portal button and a plain-text alternative. It shows the job reference, title, property/unit label, trade, current status and appointment in SAST. The email uses the existing recipient consent and access checks. The job description, contact details and evidence are available in the authenticated app.

Testing: Local transactional Postgres checks verified the job summary, appointment formatting, worker-only execution and redaction when a delivery is skipped. Mime rendering checks verified both alternatives, safe escaping of job text, role-specific links and unscheduled jobs.

Commit and push: implementation follows on codex/blend-field-foundation-20261125. Merge: none. Deployment and live production verification: pending. The established Hostinger sender remains in place. Other recipient, provider, staff and recovery gates remain open.

## 2026-11-25 — Formatted email deployed and Users and Access implementation

Formatted email: Worker revision 61dd1db was pushed to the Job Cards development branch and deployed on the VPS after migration 000010 and a pre-change Postgres backup. Local MIME and responsive layout checks passed at 320 and 640 pixels. A live formatted test for showcase job #1006 went to the workspace owner only and Hostinger accepted it on the first attempt. No matching Outlook result was observed at this checkpoint. The temporary test preference, portal grant and contact profile were restored to their previous state.

Users and Access implementation: Administrators can provision Facilities Manager, Asset Manager and Property Manager accounts, change their roles and disable access. These roles can create and allocate jobs within their organisation. Facilities Managers and administrators retain final closure permissions. Registered tenants are held by default. An administrator can grant property-scoped view-only access and choose separately when to email a login invitation. View-only users cannot submit jobs or opt in to job alert email. Tenant job creation is an explicit per-property grant and existing grants retain their capability. The office app's Auth admin credential is server-only and is provisioned from the dedicated Job Cards runtime configuration.

Testing: Local transactional checks covered three manager roles, administrator-only access management, view-only enforcement, visibility of a manager-created job, tenant access revocation, explicit invitation queueing, duplicate prevention and worker status. Both mail templates rendered in local tests.

Commit and push: Users and Access implementation follows on codex/blend-field-foundation-20261125. Merge: none. Office and invitation worker deployment and live verification of these access changes are pending this checkpoint. No tenant invitations were sent. External receipt of #1006, actual team and tenant onboarding, WhatChimp, handset UAT and backup restoration remain open.

## 2026-11-25 — Users and Access verified on the VPS

Implementation: The administrator's Users and Access page can create, update or disable Facilities, Asset and Property Manager accounts. Managers can create jobs. Facilities Managers and administrators retain final closure. Tenant contacts can be held, granted view-only access or granted job creation by property. A login invitation is queued only when an administrator explicitly chooses to send it with view-only access enabled. The invitation explains how to request a one-time code. View-only access does not enable workflow email. The formatted job email remains active.

Testing: TypeScript, ESLint, Python MIME rendering, transactional Postgres checks and VPS image builds passed. Live browser verification provisioned all three manager roles, updated an existing account, held and enabled a view-only tenant, and confirmed the invitation action appeared without queueing an email. The first manager job creation exposed an existing counter permission issue. Migration 000013 corrected it, and the retest verified an Asset Manager created job #1007, the tenant could see it without intake controls, and disabling the manager removed access. The synthetic job, accounts, sessions and register fixtures were removed. Confirmed zero tenant invitations for those fixtures.

Commit and push: Runtime 14d3bb3 and job-number migration 0d11cda pushed to codex/blend-field-foundation-20261125. This evidence update follows on the same branch. Merge: none.
Deployment and configuration: migrations 000011, 000012 and 000013 applied to the dedicated Job Cards database. Backed up Postgres before the release. The Next.js office app and mail worker were rebuilt and deployed. The restricted mail worker passed its database and authenticated SMTP check. Supabase Auth provisioning uses server-only configuration in the office service.
Live production verification: The Users and Access workflows above passed with synthetic accounts. The formatted #1006 test was accepted by Hostinger and Outlook receipt was still unconfirmed after the final mailbox query. The tenant invitation path was tested locally with a test transport. No invitations were sent in production. Actual tenant release, team onboarding, inbox confirmation, WhatChimp, real-user/handset acceptance and backup restoration remain open.

## 2026-11-25 — Owner-only tenant sign-in invitation

Implementation and configuration: Used Users and Access database actions to register the workspace owner's existing dedicated test tenant alias against Showcase Building · Unit 101 and set that one grant to view-only. Queued one tenant sign-in invitation at the owner's explicit request. Existing sample job #1001 is available to that account. Actual tenant grants and invitations were outside the test.

Testing and live production verification: The active mail worker reported Hostinger SMTP acceptance at 15:06:57 SAST on attempt one. Under the test tenant identity, live Postgres returned one visible property, zero properties eligible for job creation and one visible sample job. Inbox receipt and the owner's interactive sign-in are pending. Operational tenant release, real-user/device acceptance, WhatChimp and recovery gates remain open.

Commit and push: evidence-only checkpoint follows on codex/blend-field-foundation-20261125. Merge: none. Deployment: no runtime release was required.
