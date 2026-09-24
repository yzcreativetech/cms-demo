# VCA Philippines CMS Demo
## Technical Roadmap

### Project Goal

Build a static VCA Philippines demo website and a lightweight custom CMS proof of concept. The stack is HTML, CSS, vanilla JavaScript, Supabase, and GitHub Pages. The public homepage keeps authored HTML content visible when Supabase is unavailable. The site remains labeled as a sample/demo.

### Core Architecture

- HTML supplies semantic structure and static fallback content; CSS supplies presentation; future JavaScript handles editor and public-page behavior.
- Supabase supplies Auth, database persistence, Storage, and backend authorization. Browser UI restrictions do not replace RLS or Storage policies.
- The CMS edits one homepage configuration (`id = 1`) and a repeatable set of announcement/event rows. The public page reads saved content but never gains editing capability.
- The browser may later contain the Supabase project URL and publishable/anon key. Never put a service role key, database password, or CMS password in frontend files.

### Project Structure

```text
index.html                    Public homepage with static fallback content
vca_css.css                   Public styles
assets/                       Current logo, hero, and movement images
admin/login.html              CMS login UI
admin/index.html              CMS homepage editor UI
admin/admin.css               Login and editor styles
supabase/schema.sql           Two-table schema, triggers, RLS, public SELECT policies
supabase/seed.sql             Canonical homepage and announcement data
supabase/reset.sql            Transactional content reset to canonical data
supabase/security.sql         Approved admin grants, RLS, and Storage security
```

Future JavaScript services and page modules will be added as their steps are implemented. Supabase Auth, Storage, and browser integration are not present in these local files yet.

### Current Content Model

`public.homepage_content` holds one row, enforced by a check constraint on `id = 1`. Its editable fields are:

- Site identity: `site_logo_url`.
- Brand Theme: `theme_primary_color`, `theme_secondary_color`, `theme_background_color`, `theme_text_color`, `theme_heading_font`, `theme_body_font`.
- Hero: `hero_eyebrow`, `hero_title`, `hero_description`, `hero_image_url`, `hero_button_text`, `hero_button_link`.
- Our Movement: `about_label`, `about_title`, `about_description`, `about_image_url`.
- Footer: `footer_text`.

The row also has `created_at` and `updated_at`. Hex color checks and an automatic `updated_at` trigger are defined in `schema.sql`.

`public.homepage_announcements` holds repeatable rows with `id`, `homepage_id`, `announcement_date`, `announcement_title`, `announcement_description`, `sort_order`, `created_at`, and `updated_at`. `homepage_id` references `homepage_content.id` with cascading deletion. Future editor state should use an `announcements[]` collection. The existing Add Announcement / Event and Delete controls will map to these rows.

The canonical seed contains one homepage row and one announcement row. Current image paths are `assets/vca_phils_logo.png`, `assets/hero-default.webp`, and `assets/movement.webp`. The public colors are primary `#233B82`, secondary `#98C2EC`, background `#FFFFFF`, and text `#1F2937`.

Both font fields store `system-default`. Future JavaScript will map this value to the current public CSS stack: `system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`. The editor also offers curated font options; no font loading is implemented yet.

### Core CMS Behavior Rules

Future editor state distinguishes `defaultState` (canonical seed), `savedState` (last persisted data), and `currentState` (visible edits), including `announcements[]`.

- Restore Default loads `defaultState` into the editor without saving.
- Cancel returns the editor to `savedState`.
- Undo and Redo change browser-side state only. They never write to Supabase.
- Save Changes is the normal operation that persists edits and updates `savedState` after success.
- Image selection creates a local preview; upload occurs on Save. The original static image paths remain valid fallback references.

---

# STEP 1 — Public Homepage
**Status: COMPLETE**

The public demo homepage contains the logo, hero, Our Movement, one announcement, and footer, with CMS targets and static content. Key files: `index.html`, `vca_css.css`, and `assets/`. Keep the static fallback after future Supabase hydration.

# STEP 2 — CMS HTML Shell
**Status: COMPLETE**

`admin/login.html` and `admin/index.html` provide the login screen, navigation, editor, image previews and inputs, status regions, Undo, Redo, Cancel, Restore Default, Save Changes, View Website, Logout, and announcement Add/Delete controls. The Brand Theme section has four paired color picker/hex controls and two font dropdowns. These controls remain presentation-only pending JavaScript integration.

# STEP 3 — CMS Styling and Brand Theme UI
**Status: COMPLETE**

`admin/admin.css` styles the login and editor, including cards, controls, focus states, responsive layouts, and Brand Theme controls. Final browser viewport checks remain part of end-to-end QA.

# STEP 4 — Supabase Schema and Seed
**Status: COMPLETE**

The Supabase project and the two-table schema, canonical seed, and reset are the approved Step 4 baseline. `supabase/schema.sql`, `supabase/seed.sql`, and `supabase/reset.sql` document it locally. The single-row constraint, repeatable announcement structure, automatic `updated_at` triggers, RLS on both tables, and public SELECT policies are complete. Anonymous writes have no policy granting access. The canonical seed has one row in each table and matches the static homepage.

Step 4 database checks reported complete: seed queries, single-row enforcement, `updated_at`, RLS, and public-read policies. The local SQL files document this state; they do not themselves prove the remote project state. Authenticated admin write policies and Storage security are documented in Step 6.

# STEP 5 — Authentication Foundation
**Status: COMPLETE**

Set up Supabase Auth with one manually created CMS user and email/password login. Add session handling, login errors, logout, and a guard for direct visits to `admin/index.html`. Use only frontend-safe Supabase configuration.

**Acceptance:** Valid login reaches the editor; invalid login reports an error; refresh preserves an active session; logout and direct logged-out visits deny editor access; no privileged secret appears in browser files.

STEP 5 — Authentication Foundation

SUPABASE THREAD
├── 5A Create CMS admin user
├── 5B Configure Auth settings
└── 5C Capture admin UUID
        ↓
JAVASCRIPT THREAD
├── 5D Supabase frontend client
├── 5E auth-service.js
├── 5F login.js
├── 5G admin session guard
├── 5H logout
└── 5I authentication testing


# STEP 6 — Admin RLS and Storage Security
**Status: COMPLETE**

`supabase/security.sql` documents the approved admin UUID-scoped grants and policies, using `YOUR-ADMIN-UUID` for reuse. Public SELECT remains enabled. The approved admin can UPDATE homepage row `id = 1` and INSERT/UPDATE/DELETE its announcements; homepage INSERT/DELETE remain unavailable.

The dashboard-configured public `cms-demo` bucket accepts PNG/JPEG/WebP files up to 5 MB. Admin uploads are limited to `logos`, `hero`, and `movement`, using new unique filenames. Storage UPDATE/DELETE policies are intentionally absent.

**Verification reported complete:** Direct API/browser tests passed for public homepage reads, admin database writes, announcement CRUD, admin Storage upload, anonymous write/upload blocking, and public image reads while logged out. This repository task documents those results without connecting to Supabase or executing SQL.

# STEP 7 — CMS Editor State
**Status: COMPLETE**

Build form-to-state mapping for all homepage fields and `announcements[]`, including Add/Delete and image selection metadata. Track `defaultState`, `savedState`, and `currentState`. Keep DOM rendering separate from data access.

**Acceptance:** Existing fields populate from state; edits and repeatable announcements update `currentState`; validation and status messages are clear; no edit writes to Supabase before Save.

Implemented under `admin/js`: canonical defaults, isolated editor state, read-only bootstrap, DOM rendering, validation, and the homepage controller. The bootstrap reads the homepage and ordered announcements to establish `savedState`; failed loads keep editing disabled and prompt a page reload. Default and saved snapshots are deeply frozen, and edits use a separate working copy. Existing announcement IDs/timestamps remain available alongside temporary client IDs. Image selections retain immutable File objects separately from existing URL fields; the view owns/revokes preview URLs. Dirty detection compares complete state, including selected Files.

**Verification:** Headless Chrome passed 21 state/rendering checks and 19 controller interaction checks using local fixtures: clone isolation, revert-to-clean, repeated Add/Delete, metadata preservation, repeated rendering, unique IDs/labels, scalar mapping, validation, file previews/rejection, disabled deferred controls, and submit prevention. Browser module parsing and `git diff --check` passed. No editor write/upload calls exist; auth modules are unchanged. Live Supabase loading and authenticated login/logout were not exercised in these fixture tests.

**Deferred:** Save, uploads, Undo/Redo, Cancel, and Restore Default remain disabled/unimplemented. There is no automatic fallback masquerading as saved data. Step 8 is next; broader load/save behavior remains Step 9.

# STEP 8 — Undo, Redo, Cancel, Restore Default
**Status: NEXT**

Add browser-side history for unsaved editor changes. Cancel restores `savedState`; Restore Default loads `defaultState` only after confirmation and does not save. Define predictable history behavior after Save and for image previews.

**Acceptance:** Undo/Redo work across consecutive edits; a new edit clears redo history; Cancel restores saved text and previews; Restore Default loads canonical values without a database write; controls show appropriate disabled states.

# STEP 9 — Content Load and Save
**Status: PENDING**

Load `homepage_content` row `id = 1` and ordered `homepage_announcements` into editor state. Validate before Save; persist edits to the existing row and announcement rows. Update `savedState` only after success. Prevent duplicate submission and preserve unsaved work on failure.

**Acceptance:** The editor loads current saved data; changes persist and reload; Add/Delete map to repeatable rows; failures remain retryable without losing edits; no second homepage row is created.

# STEP 10 — Image Upload
**Status: PENDING**

Support logo, hero, and Our Movement replacement through Storage. Validate type and size, preview selected files locally, and upload on Save before storing their references. Handle failed uploads and database failures without claiming success; document any orphaned upload limitation.

**Acceptance:** Each image can be selected and previewed; invalid files are rejected; selection alone does not upload; Save stores usable image references; failures preserve editor state and report clearly.

# STEP 11 — Public Homepage Hydration
**Status: PENDING**

Read the homepage row and ordered announcements and populate the existing `data-cms` targets. Apply colors and font values, mapping `system-default` to the current CSS stack. Use safe text assignment for editable copy. Leave authored static content intact if loading fails.

**Acceptance:** Saved text, theme, images, button, and all announcement rows appear publicly; order is correct; the static page remains readable during errors; public code cannot edit content.

# STEP 12 — Security QA
**Status: PENDING**

Test anonymous and admin identities directly against database and Storage policies, including announcement writes, not only against hidden UI controls. Test login, logout, direct admin route access, session expiry, and frontend secret exposure.

**Acceptance:** Public reads work; anonymous database writes and uploads fail; authorized admin writes and uploads work; logged-out editor access is blocked; no privileged secrets are exposed.

# STEP 13 — End-to-End QA
**Status: PENDING**

Exercise login, content edits, repeated announcements, history, Cancel, Restore Default, Save, image replacement, public hydration, and logout. Include failure/retry cases, browser console checks, database row checks, and visual QA for public, login, and editor pages at narrow and wide viewports.

**Acceptance:** The full demo workflow passes; saved changes and restored defaults appear publicly; one homepage row remains; announcement order and image paths remain valid; responsive layouts have no blocking overflow or errors.

# STEP 14 — GitHub Pages Deployment
**Status: PENDING**

Publish the approved demo after QA. Verify relative paths under the GitHub Pages repository subpath, Supabase Auth origin/redirect configuration, public data reads, CMS Save and upload, and visible SAMPLE ONLY labeling. Commit and deployment are separate review actions.

**Acceptance:** Public and admin pages load online; login and protected editor work; edits, images, and restore flow work; static fallback and demo labels remain; no privileged secret is deployed.

---

## Current Progress

| Step | Milestone | Status |
|---|---|---|
| 1 | Public Homepage | COMPLETE |
| 2 | CMS HTML Shell | COMPLETE |
| 3 | CMS Styling + Brand Theme UI | COMPLETE |
| 4 | Supabase Schema + Seed | COMPLETE |
| 5 | Authentication Foundation | COMPLETE |
| 6 | Admin RLS + Storage Security | COMPLETE |
| 7 | CMS Editor State | COMPLETE |
| 8 | Undo / Redo / Cancel / Restore Default | NEXT |
| 9 | Content Load / Save | PENDING |
| 10 | Image Upload | PENDING |
| 11 | Public Homepage ↔ Supabase | PENDING |
| 12 | Security QA | PENDING |
| 13 | End-to-End QA | PENDING |
| 14 | GitHub Pages Deployment | PENDING |

## Out of Scope

Multi-user administration, public sign-up, user-management and role systems, forgot-password workflow, page builders, drag-and-drop editing, rich text editing, a media library, revision database, publishing workflow, multi-tenant or multi-church CMS, and a full production backup system.

## Milestone Change Rule

Complete and verify each step before marking it complete. Record intentional limitations in this roadmap. Changes to the content model or security contract require a deliberate roadmap update.
