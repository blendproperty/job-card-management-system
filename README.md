# Job Card Management System

The existing `prototype/` and `server-build/` are the preliminary review build. `blend-field/` contains the separate Next.js, Expo and Supabase/Postgres M0 prototype imported from the local Blend Field project at commit e5294f1. Its own README contains historical setup instructions; see the environment examples and Supabase configuration for current dependencies. This is a development foundation, not a production release.

Joy's proposed workflow and feedback require tenant requests, internal approval, trade-based auto-allocation and reassignment, work and overtime recording, evidence timestamps, signatures and manager closure. The M0 implementation does not yet cover all of these. Persistent offline sync, provider integration, pilot data and access rules must be implemented and verified before operational use.

Do not deploy `server-build/` directly on a VPS: it relies on the ChatGPT/Cloudflare authentication and database environment. Blend Field depends on the Supabase auth, storage and API services in addition to PostgreSQL; a standalone PostgreSQL container is not a substitute. Provider credentials must remain outside the repository.
