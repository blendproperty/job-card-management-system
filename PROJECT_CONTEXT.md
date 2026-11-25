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
