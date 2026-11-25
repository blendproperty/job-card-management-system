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
