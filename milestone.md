# VCA Philippines CMS Demo
## Technical Architecture & Implementation Roadmap

> **Project type:** Custom-built website + custom CMS proof of concept  
> **Purpose:** Demonstrate that VCA Philippines can have a lightweight custom CMS without WordPress, Squarespace, or another website builder.  
> **Demo status:** SAMPLE ONLY  
> **Primary stack:** HTML, CSS, Vanilla JavaScript, Supabase, GitHub Pages

---

# 1. Project Objective

The goal of this proof of concept is to demonstrate that a custom-built VCA Philippines website can support a simple, secure CMS that allows an authorized user to:

- log in to a protected admin area;
- edit selected homepage text;
- replace selected homepage images;
- undo and redo unsaved changes;
- cancel unsaved edits;
- restore the original demo content;
- save changes to a real backend;
- see the saved content reflected on the public website;
- log out securely.

This is **not** intended to be a complete production CMS.

The proof of concept should remain intentionally small, easy to understand, easy to reset, and easy to extend later.

---

# 2. Scope Principles

The following principles govern the implementation:

1. **One responsibility per layer.**
   - HTML defines structure.
   - CSS defines appearance.
   - JavaScript defines behavior.
   - Supabase handles authentication, persistence, storage, and backend authorization.

2. **Build one layer at a time.**
   - Do not combine HTML, CSS, JavaScript, and backend work in the same milestone unless the roadmap explicitly calls for it.

3. **Keep the public website usable without Supabase.**
   - Static HTML content remains as fallback content.
   - If Supabase is temporarily unavailable, the public homepage should still display its default content.

4. **Do not build features that the demo does not need.**
   - No page builder.
   - No drag-and-drop.
   - No multi-user administration.
   - No advanced publishing workflow.
   - No full media library.

5. **Security must be enforced by Supabase RLS and Storage policies.**
   - Hiding controls in the frontend is not security.

6. **Undo and Redo are local editor functions.**
   - They must not write to the database on every edit.

7. **Only explicit Save writes permanent CMS changes.**

---

# 3. High-Level Architecture

```text
PUBLIC WEBSITE
index.html
   │
   └── js/public/homepage.js
            │
            └── js/services/content-service.js
                     │
                     ▼
                  Supabase
                  Database


CMS
/admin/login.html
/admin/index.html
   │
   ├── js/admin/login.js
   ├── js/admin/homepage-editor.js
   └── js/admin/editor-history.js
            │
            ├── js/services/auth-service.js
            ├── js/services/content-service.js
            └── js/services/storage-service.js
                     │
                     ▼
                  Supabase
                  Auth
                  Database
                  Storage
                  RLS
```

---

# 4. Technical Responsibilities

## HTML

Responsible for:

- semantic page structure;
- headings;
- navigation;
- forms;
- labels;
- inputs;
- textareas;
- buttons;
- image preview containers;
- status message containers;
- accessible IDs and relationships;
- stable hooks for CSS and JavaScript.

HTML must **not** contain:

- Supabase queries;
- authentication logic;
- undo/redo logic;
- upload logic;
- database rules;
- inline JavaScript;
- application secrets.

---

## CSS

Responsible for:

- page layout;
- spacing;
- typography;
- color;
- responsive behavior;
- form styling;
- button styling;
- focus states;
- disabled states;
- success/error states;
- CMS layout;
- image preview presentation.

CSS must **not** contain application behavior or backend logic.

---

## JavaScript

Responsible for:

- Supabase client usage;
- login interactions;
- session checking;
- logout;
- editor state;
- undo;
- redo;
- cancel;
- restore default;
- save;
- image selection;
- local image preview;
- image uploads;
- database reads/writes;
- public homepage content hydration.

JavaScript should remain modular and separated by responsibility.

---

## Supabase Auth

Responsible for:

- one demo CMS user;
- email/password login;
- authenticated session;
- logout;
- identifying the authorized CMS editor.

No public registration is required.

---

## Supabase Database

Responsible for:

- storing the currently saved homepage CMS content;
- storing image references;
- storing update timestamps.

Only one homepage content row is required for the proof of concept.

---

## Supabase Storage

Responsible for:

- uploaded logo replacements;
- uploaded hero images;
- uploaded Our Movement images.

---

## Supabase RLS / Storage Policies

Responsible for:

- public read access to published homepage content;
- blocking anonymous writes;
- blocking anonymous image uploads;
- allowing the authorized CMS user to update content;
- allowing the authorized CMS user to upload images.

---

# 5. Proposed Project Structure

```text
vca_phils/
│
├── index.html
├── vca_css.css
│
├── milestone.md
│
├── assets/
│   ├── vca_phils_logo.png
│   ├── hero-default.webp
│   └── movement.webp
│
├── admin/
│   ├── login.html
│   ├── index.html
│   └── admin.css
│
└── js/
    ├── config/
    │   └── supabase-config.js
    │
    ├── services/
    │   ├── auth-service.js
    │   ├── content-service.js
    │   └── storage-service.js
    │
    ├── public/
    │   └── homepage.js
    │
    └── admin/
        ├── login.js
        ├── homepage-editor.js
        └── editor-history.js
```

This structure may be adjusted later if the proof of concept expands, but it should remain the baseline during the demo build.

---

# 6. CMS Content Model

The CMS will manage only selected homepage content.

## Site Identity

- logo

## Hero

- eyebrow
- title
- description
- hero image
- button text
- button link

## Our Movement

- section label
- heading
- description
- image

## Latest Announcement

- date
- title
- description

## Footer

- footer text

---

# 7. CMS Control Behavior

## Undo

Purpose:

Return the editor to the previous **unsaved** state.

Rules:

- handled entirely in browser memory;
- does not update Supabase;
- may include text edits and image selections;
- button should be disabled when no previous state exists.

---

## Redo

Purpose:

Reapply the most recently undone state.

Rules:

- handled entirely in browser memory;
- does not update Supabase;
- redo history is cleared after a new edit is made following Undo;
- button should be disabled when no redo state exists.

---

## Cancel

Purpose:

Discard all unsaved changes and return to the content currently saved in Supabase.

Example:

```text
Saved:
VCA Philippines National

User types:
VCA Philippines Test

Cancel

Result:
VCA Philippines National
```

---

## Restore Default

Purpose:

Load the original demo content back into the editor.

Rules:

- requires confirmation;
- must not immediately write to Supabase;
- defaults are loaded into the editor as unsaved changes;
- user must click Save Changes to make the restored defaults permanent.

Flow:

```text
Restore Default
       ↓
Confirmation
       ↓
Load default editor state
       ↓
Review
       ↓
Save Changes
       ↓
Supabase updated
```

---

## Save Changes

Purpose:

Make the current editor state permanent.

Flow:

```text
Validate fields
      ↓
Upload any newly selected images
      ↓
Receive Storage paths/URLs
      ↓
Update homepage_content row
      ↓
Update saved editor state
      ↓
Reset appropriate history
      ↓
Show success message
```

Only Save Changes should permanently modify CMS content.

---

# STEP 1 --done
# Public Demo Homepage

## Status

**COMPLETED**

## Purpose

Create a simple public-facing VCA Philippines homepage that acts as the CMS target.

The page is intentionally small because its purpose is to demonstrate CMS functionality rather than final production design.

## Primary Files

```text
index.html
vca_css.css
```

## Existing Assets

```text
assets/vca_phils_logo.png
assets/hero-default.webp
assets/movement.webp
```

## Public Homepage Sections

- Header
- VCA logo
- Navigation
- Hero
- Hero image
- Our Movement
- Movement image
- Latest Announcement
- Footer
- SAMPLE ONLY watermark
- CMS Demo badge

## CMS Hooks

The public page must preserve stable `data-cms` hooks.

Current hooks:

```text
site-logo

hero-eyebrow
hero-title
hero-description
hero-button
hero-image

about-label
about-title
about-description
about-image

announcement-date
announcement-title
announcement-description

footer-text
```

## Design Requirements

- clean VCA-branded demo design;
- VCA primary blue;
- responsive;
- accessible focus states;
- no horizontal overflow;
- visible SAMPLE ONLY treatment;
- static HTML content retained as fallback.

## Out of Scope

- CMS logic;
- Supabase;
- authentication;
- image uploads;
- dynamic content loading.

## Acceptance Criteria

- [x] Public homepage exists.
- [x] VCA logo displays.
- [x] Hero image displays.
- [x] Movement image displays.
- [x] All intended CMS hooks are present.
- [x] Responsive behavior works.
- [x] SAMPLE ONLY watermark is visible.
- [x] CMS demo badge is visible.
- [x] No CMS behavior exists yet.
- [x] No Supabase integration exists yet.

---

# STEP 2
# CMS HTML Shell

## Technology

**HTML only**

## Purpose

Define the complete structural skeleton of the CMS before any styling, JavaScript behavior, authentication, or backend integration is introduced.

This step establishes the DOM contract that later CSS and JavaScript will depend on.

## Files to Create

```text
admin/login.html
admin/index.html
```

## Important Rule

Step 2 is structure only.

Do **not** implement:

- CSS design beyond linking the future stylesheet;
- JavaScript;
- Supabase;
- authentication;
- save logic;
- undo/redo logic;
- image upload behavior.

---

## STEP 2A
## Login Page HTML

File:

```text
admin/login.html
```

### Required Structure

The page should include:

- VCA logo;
- VCA Philippines CMS title;
- CMS Demo label;
- login form;
- email field;
- password field;
- Sign In button;
- form status/error container;
- SAMPLE ONLY / CMS DEMO message.

### Suggested Stable IDs

```text
login-form
login-email
login-password
login-submit
login-status
```

### Accessibility Requirements

- every input must have a `<label>`;
- labels must use matching `for` attributes;
- email input should use `type="email"`;
- password input should use `type="password"`;
- Sign In should use `type="submit"`;
- status container should support future accessible messages;
- logo must have appropriate alt text.

### No Behavior Yet

The form is allowed to submit nowhere or use a harmless placeholder action at this stage.

No JavaScript login logic should exist.

---

## STEP 2B --done
## Admin Homepage Editor HTML

File:

```text
admin/index.html
```

### Required Layout Regions

The HTML should define:

1. Admin header
2. Sidebar/navigation
3. Main editor region
4. Homepage form
5. Status/message region
6. Bottom action region

---

## Admin Header

Include:

- VCA Philippines CMS;
- SAMPLE ONLY / CMS DEMO indicator;
- View Website;
- Logout.

Suggested IDs:

```text
view-website-link
logout-button
```

No logout behavior yet.

---

## Sidebar

Include:

- Dashboard
- Homepage

Homepage should be represented as the current/active editor destination.

No complex routing is required.

---

## Editor Toolbar

Include:

- Edit Homepage heading;
- Undo button;
- Redo button.

Suggested IDs:

```text
undo-button
redo-button
```

Buttons should use `type="button"`.

---

## Site Identity Section

Fields:

### Current Logo Preview

Suggested element:

```text
site-logo-preview
```

### Replace Logo

Use a file input.

Suggested ID:

```text
site-logo-input
```

Recommended accept types:

```text
image/png,image/jpeg,image/webp
```

No file handling behavior yet.

---

## Hero Section

Fields:

### Eyebrow

Suggested ID:

```text
hero-eyebrow
```

### Hero Title

Suggested ID:

```text
hero-title
```

### Description

Suggested ID:

```text
hero-description
```

Use a `<textarea>`.

### Hero Image Preview

Suggested ID:

```text
hero-image-preview
```

### Hero Image File Input

Suggested ID:

```text
hero-image-input
```

### Button Text

Suggested ID:

```text
hero-button-text
```

### Button Link

Suggested ID:

```text
hero-button-link
```

---

## Our Movement Section

Fields:

### Section Label

Suggested ID:

```text
about-label
```

### Heading

Suggested ID:

```text
about-title
```

### Description

Suggested ID:

```text
about-description
```

Use a `<textarea>`.

### Image Preview

Suggested ID:

```text
about-image-preview
```

### Image File Input

Suggested ID:

```text
about-image-input
```

---

## Latest Announcement Section

Fields:

### Date

Suggested ID:

```text
announcement-date
```

For the demo, this may remain a text field unless a true date value is required later.

### Title

Suggested ID:

```text
announcement-title
```

### Description

Suggested ID:

```text
announcement-description
```

Use a `<textarea>`.

---

## Footer Section

Field:

### Footer Text

Suggested ID:

```text
footer-text
```

---

## Form Status Region

Create a container for future:

- validation errors;
- save progress;
- save success;
- save failure.

Suggested ID:

```text
editor-status
```

It should be semantically suitable for future accessible updates.

---

## Bottom Actions

Include:

### Restore Default

```text
restore-default-button
```

`type="button"`

### Cancel

```text
cancel-button
```

`type="button"`

### Save Changes

```text
save-button
```

`type="submit"`

---

## HTML Requirements

- semantic landmarks;
- one logical editor form;
- valid label/control relationships;
- stable IDs;
- logical heading hierarchy;
- accessible image alt text;
- no inline CSS;
- no inline JavaScript;
- no script tags required yet;
- no Supabase integration.

## Step 2 Acceptance Criteria

- [ ] `admin/login.html` exists.
- [ ] `admin/index.html` exists.
- [ ] Login form contains email/password controls.
- [ ] All homepage CMS fields are present.
- [ ] Undo and Redo buttons exist.
- [ ] Restore Default exists.
- [ ] Cancel exists.
- [ ] Save Changes exists.
- [ ] View Website exists.
- [ ] Logout exists.
- [ ] Logo preview exists.
- [ ] Hero image preview exists.
- [ ] Movement image preview exists.
- [ ] File inputs exist for all editable images.
- [ ] All labels map correctly to controls.
- [ ] Stable IDs are established.
- [ ] No JavaScript behavior is implemented.
- [ ] No Supabase integration exists.
- [ ] HTML validates structurally.

---

# STEP 3
# CMS CSS

## Technology

**CSS only**

## Purpose

Turn the raw Step 2 HTML into a clean, professional, responsive CMS interface.

No application logic should be introduced.

## File to Create

```text
admin/admin.css
```

## Pages to Style

- `admin/login.html`
- `admin/index.html`

## Design Direction

- simple;
- professional;
- VCA branded;
- clearly a demo;
- not overly decorative;
- easy to scan;
- comfortable for non-technical users.

## Suggested Design Tokens

Use simple CSS custom properties for:

- VCA blue;
- VCA sky blue;
- white;
- page background;
- card background;
- primary text;
- muted text;
- border color;
- error color;
- success color;
- warning color;
- standard radius;
- standard shadow;
- content width.

Do not create an unnecessarily large design system.

---

## Login Page Styling

Style:

- centered login card;
- VCA logo;
- CMS title;
- demo label;
- form labels;
- inputs;
- submit button;
- focus state;
- error/status area;
- SAMPLE ONLY treatment.

The login page must remain usable at 390px width.

---

## Admin Layout Styling

Desktop:

```text
Header
────────────────────────────
Sidebar | Main Editor
        |
        |
```

Mobile/tablet:

```text
Header
Navigation
Main Editor
```

The sidebar may stack or transform into a simple horizontal navigation area.

No JavaScript hamburger menu is required.

---

## Editor Section Styling

Each section should visually group its related fields:

- Site Identity
- Hero
- Our Movement
- Latest Announcement
- Footer

Use:

- cards or section panels;
- clear headings;
- consistent vertical spacing;
- readable field widths;
- consistent textarea sizing.

---

## Image Preview Styling

Logo preview:

- compact;
- preserve aspect ratio;
- neutral preview surface.

Hero/Movement preview:

- larger;
- preserve aspect ratio;
- use `object-fit: cover`;
- no stretching.

---

## Button Hierarchy

Primary:

- Save Changes

Secondary:

- View Website
- Undo
- Redo

Neutral:

- Cancel

Warning/destructive-style caution:

- Restore Default

Do not make Restore Default appear identical to Save.

---

## Required Interaction States

Style:

- `:hover`;
- `:focus-visible`;
- `:disabled`;
- success;
- error;
- loading-ready placeholders.

JavaScript behavior will be added later, but the CSS states can exist now.

---

## Responsive QA Widths

Test approximately:

```text
1440px
1200px
1024px
800px
650px
390px
```

## Step 3 Acceptance Criteria

- [ ] Login page is styled.
- [ ] CMS editor is styled.
- [ ] VCA branding is consistent.
- [ ] Layout is responsive.
- [ ] No horizontal overflow.
- [ ] Inputs are readable.
- [ ] Textareas are usable.
- [ ] Image previews are proportional.
- [ ] Keyboard focus is visible.
- [ ] Disabled buttons have a distinct state.
- [ ] Restore Default is visually distinct.
- [ ] No JavaScript behavior added.
- [ ] No Supabase integration added.

---

# STEP 4
# Supabase Schema + Seed

## Technology

**Supabase Database**

## Purpose

Create the persistent data model that stores the homepage CMS content.

The database design should remain intentionally small.

## Table

Create:

```text
homepage_content
```

## Recommended Columns

```text
id
site_logo_url

hero_eyebrow
hero_title
hero_description
hero_image_url
hero_button_text
hero_button_link

about_label
about_title
about_description
about_image_url

announcement_date
announcement_title
announcement_description

footer_text

created_at
updated_at
```

## Recommended Data Types

Conceptually:

```text
id                        uuid or bigint
site_logo_url             text

hero_eyebrow              text
hero_title                text
hero_description          text
hero_image_url            text
hero_button_text          text
hero_button_link          text

about_label               text
about_title               text
about_description         text
about_image_url           text

announcement_date         text
announcement_title        text
announcement_description  text

footer_text               text

created_at                timestamptz
updated_at                timestamptz
```

The exact primary-key approach should be decided before SQL is finalized.

## Single-Row Strategy

The proof of concept requires only one content record.

The CMS should edit that known row rather than creating multiple homepage records.

## Seed Data

Seed values must match the current static homepage.

Examples include:

```text
Victory Churches of Asia
VCA Philippines
Growing churches. Equipping leaders. Reaching communities with the Gospel of Jesus Christ.
Learn More
#about
Our Movement
One Church. Many Communities.
...
```

Image values should initially point to the current default images or a documented equivalent approach.

## Default State

The original homepage content should also be represented as a separate JavaScript/default configuration later for Restore Default.

The database seed and default state must initially match.

## updated_at

The database should support an update timestamp.

This may be handled using:

- application code; or
- a database trigger.

Choose one approach and document it.

## Step 4 Acceptance Criteria

- [ ] Supabase project exists.
- [ ] `homepage_content` table exists.
- [ ] Column names are final.
- [ ] Column data types are appropriate.
- [ ] One seed row exists.
- [ ] Seed values match the current homepage.
- [ ] Timestamps exist.
- [ ] The row can be queried in Supabase.
- [ ] No unnecessary tables were created.
- [ ] Reset/seed SQL is documented.

---

# STEP 5
# Supabase RLS + Storage Policies

## Technology

**Supabase RLS + Supabase Storage**

## Purpose

Secure the CMS backend before frontend write functionality is connected.

This milestone establishes backend authorization rules.

---

## Database RLS

Enable RLS on:

```text
homepage_content
```

## Anonymous/Public User Requirements

Public visitors must be able to:

```text
SELECT homepage content    YES
```

Public visitors must not be able to:

```text
INSERT homepage content    NO
UPDATE homepage content    NO
DELETE homepage content    NO
```

---

## Authenticated Demo Admin Requirements

The authorized admin must be able to:

```text
SELECT homepage content    YES
UPDATE homepage content    YES
```

For this proof of concept, INSERT and DELETE can remain blocked after the seed row is created.

This reduces accidental damage.

---

## One-User Restriction

Do not simply allow every authenticated Supabase user to update the CMS.

The write policy should be restricted to the single authorized user.

Possible approach:

```text
auth.uid() = '<approved-user-uuid>'
```

The exact implementation should be documented in the SQL/policy notes.

---

## Storage Bucket

Create:

```text
cms-demo
```

Suggested path organization:

```text
cms-demo/
├── logos/
├── hero/
└── movement/
```

---

## Storage Public Read Strategy

Choose and document whether:

1. files are publicly readable using public URLs; or
2. signed URLs are required.

For this simple public website demo, a public-read bucket/path is likely simpler, while upload/delete operations remain protected.

---

## Storage Write Requirements

Anonymous:

```text
Upload    NO
Update    NO
Delete    NO
```

Authorized admin:

```text
Upload    YES
Update    YES where needed
Delete    only if explicitly needed
```

Avoid granting broader permissions than necessary.

## Step 5 Security Tests

Test:

- anonymous database SELECT;
- anonymous database UPDATE;
- anonymous database INSERT;
- anonymous database DELETE;
- anonymous Storage upload;
- authenticated admin UPDATE;
- authenticated admin Storage upload.

## Step 5 Acceptance Criteria

- [ ] RLS is enabled.
- [ ] Public SELECT works.
- [ ] Anonymous UPDATE fails.
- [ ] Anonymous INSERT fails.
- [ ] Anonymous DELETE fails.
- [ ] Anonymous upload fails.
- [ ] Authorized admin UPDATE works.
- [ ] Authorized admin upload works.
- [ ] Policies are limited to one admin user.
- [ ] Service-role credentials are never exposed to frontend code.

---

# STEP 6
# Authentication

## Technology

**Supabase Auth + JavaScript**

## Purpose

Demonstrate real user authentication and protect the CMS interface.

Only one manually created CMS user is required.

## Files

```text
js/config/supabase-config.js
js/services/auth-service.js
js/admin/login.js
```

Admin page may also need session-guard integration through:

```text
js/admin/homepage-editor.js
```

or a small dedicated guard module if later justified.

---

## Supabase Configuration

Create a frontend-safe Supabase client configuration.

Allowed in frontend:

- Supabase project URL;
- Supabase anon/publishable key.

Never include:

- service role key;
- database password;
- private server credentials.

---

## Admin User

Create exactly one user manually through Supabase Auth.

No:

- sign-up page;
- registration link;
- user-management screen.

---

## Login Flow

```text
/admin/login.html
       ↓
Submit email/password
       ↓
Supabase signInWithPassword
       ↓
Valid?
 ┌─────┴─────┐
 NO          YES
 ↓            ↓
Show error   redirect to /admin/index.html
```

## Login UX

Support:

- idle;
- submitting;
- success/redirect;
- invalid credentials;
- network/backend error.

Disable the Sign In button while authentication is processing.

---

## Session Guard

When `/admin/index.html` opens:

```text
Check current Supabase session
           ↓
     Session exists?
       ┌────┴────┐
       NO        YES
       ↓          ↓
redirect login   load CMS
```

A logged-out visitor must not be able to use the admin editor merely by typing the admin URL.

---

## Logout

Flow:

```text
Logout
  ↓
Supabase signOut()
  ↓
Clear editor-sensitive state
  ↓
Redirect to login.html
```

---

## Refresh Behavior

Authenticated user:

- browser refresh should keep the CMS usable if the Supabase session remains valid.

Logged-out user:

- browser refresh should remain on or return to login.

## Step 6 Acceptance Criteria

- [ ] Supabase client initializes.
- [ ] Correct credentials log in.
- [ ] Incorrect credentials show an error.
- [ ] Login button handles loading state.
- [ ] Authenticated session persists appropriately.
- [ ] Direct logged-out access to admin is rejected.
- [ ] Logout works.
- [ ] Logout redirects to login.
- [ ] No credentials are hard-coded into HTML/JS.
- [ ] No public sign-up exists.

---

# STEP 7
# CMS Editor State

## Technology

**Vanilla JavaScript**

## Purpose

Create a clean browser-side representation of the CMS form.

This milestone establishes the editor's internal state before adding database save behavior.

## Primary File

```text
js/admin/homepage-editor.js
```

## State Concepts

The editor should distinguish:

```text
defaultState
savedState
currentState
```

Later, history adds:

```text
undoStack
redoStack
```

---

## defaultState

Represents the original CMS demo values.

This should match the initial seed content.

It is used by:

```text
Restore Default
```

---

## savedState

Represents the latest successfully loaded/saved Supabase content.

It is used by:

```text
Cancel
```

---

## currentState

Represents what the user currently sees in the form.

This may differ from savedState when there are unsaved edits.

---

## State Fields

State should cover all editable fields:

```text
site_logo

hero_eyebrow
hero_title
hero_description
hero_image
hero_button_text
hero_button_link

about_label
about_title
about_description
about_image

announcement_date
announcement_title
announcement_description

footer_text
```

Image state may later require separate information for:

- current saved URL;
- newly selected File object;
- preview URL.

---

## Form-to-State Functions

Define clear responsibilities such as:

```text
readFormState()
applyStateToForm(state)
hasUnsavedChanges()
```

Names may vary, but responsibilities should remain separated.

---

## Dirty State

The editor should know whether currentState differs from savedState.

This enables future UI behavior such as:

```text
Unsaved changes
```

and helps determine Cancel behavior.

---

## Image Preview Preparation

At this stage, image selection may support local preview behavior only if Step 7 implementation includes it.

No Storage upload occurs yet.

## Step 7 Acceptance Criteria

- [ ] `defaultState` exists.
- [ ] `savedState` exists.
- [ ] `currentState` exists.
- [ ] Editor fields can populate from state.
- [ ] State can be read from the form.
- [ ] Unsaved changes can be detected.
- [ ] State includes all CMS fields.
- [ ] Images can be represented safely in state.
- [ ] No permanent database writes occur from normal editing.
- [ ] Code remains modular and readable.

---

# STEP 8
# Undo / Redo / Cancel / Restore Default

## Technology

**Vanilla JavaScript**

## Purpose

Add browser-side editing history and reset behavior.

## Primary File

```text
js/admin/editor-history.js
```

The editor module and history module may communicate, but history responsibility should remain separated.

---

## Undo Stack

Tracks previous editor states.

Conceptually:

```text
State A
  ↓ edit
State B
  ↓ edit
State C

Undo:
State C → State B

Undo:
State B → State A
```

---

## Redo Stack

Tracks states removed by Undo.

Conceptually:

```text
State C
  ↓ Undo
State B
  ↓ Redo
State C
```

If the user:

1. undoes to State B;
2. makes a new edit to State D;

then State C must no longer be available via Redo.

---

## History Granularity

Decide and document how edits enter history.

Avoid creating one history entry for every single keystroke if that produces poor usability.

Potential strategies include:

- debounce text input;
- capture on field change/blur;
- group rapid edits.

Choose a simple approach appropriate for the demo.

---

## Undo Button

Requirements:

- restores previous editor state;
- does not write to Supabase;
- disabled when undo stack is empty.

---

## Redo Button

Requirements:

- reapplies undone state;
- does not write to Supabase;
- disabled when redo stack is empty.

---

## Cancel

Requirements:

```text
currentState = savedState
```

Cancel should:

- discard current unsaved text;
- discard unsaved image selections;
- restore saved image previews;
- clear/reset editor history appropriately.

Consider confirmation if unsaved changes exist.

---

## Restore Default

Requirements:

```text
currentState = defaultState
```

Restore Default should:

- require confirmation;
- load default text;
- load default image references;
- count as an unsaved editor change;
- not write to Supabase automatically;
- allow Undo if practical.

---

## Save and History Relationship

After a successful Save:

```text
savedState = currentState
```

Then reset or normalize history so Undo does not unexpectedly cross permanent save boundaries unless explicitly designed to do so.

For this demo, clearing the edit history after successful Save is the simplest behavior.

## Step 8 Acceptance Criteria

- [ ] Undo works.
- [ ] Undo button disables correctly.
- [ ] Redo works.
- [ ] Redo button disables correctly.
- [ ] New edits after Undo clear redo history.
- [ ] Cancel restores savedState.
- [ ] Cancel restores saved image previews.
- [ ] Restore Default requires confirmation.
- [ ] Restore Default loads defaultState.
- [ ] Restore Default does not auto-save.
- [ ] No Undo/Redo action writes to Supabase.
- [ ] History remains predictable after Save.

---

# STEP 9
# Content Load / Save

## Technology

**JavaScript + Supabase Database**

## Purpose

Connect the CMS editor to the real `homepage_content` record.

## Primary File

```text
js/services/content-service.js
```

## Service Responsibilities

Conceptually provide:

```text
getHomepageContent()
updateHomepageContent(payload)
```

The service should not manage DOM rendering.

It should focus on database interaction.

---

## CMS Load Flow

```text
CMS route opens
      ↓
Authentication confirmed
      ↓
Fetch homepage_content
      ↓
Validate/normalize response
      ↓
savedState = database content
      ↓
currentState = savedState
      ↓
Populate form
```

---

## Loading State

While loading:

- editor may be disabled;
- show a clear loading message;
- avoid showing stale/editable placeholders as if they are saved data.

---

## Load Failure

If content cannot be loaded:

- show an error;
- do not allow accidental overwrite;
- provide retry behavior if appropriate.

---

## Save Validation

Before writing:

- required fields should contain acceptable values;
- button link should be sane;
- text values should be normalized;
- image upload workflow will be integrated in Step 10.

---

## Save Flow Before Image Integration

For text-only changes:

```text
Save Changes
      ↓
Read currentState
      ↓
Validate
      ↓
Call updateHomepageContent()
      ↓
Success?
  ┌────┴────┐
  NO        YES
  ↓          ↓
error      savedState = currentState
           clear/normalize history
           show success
```

---

## Save Button States

Support:

- idle;
- saving;
- success;
- error.

Prevent duplicate submissions while Save is already in progress.

---

## Update Strategy

Only update the known homepage record.

Do not create new rows on every save.

---

## Error Handling

Database errors should:

- not clear current edits;
- not falsely mark the state as saved;
- keep the user able to retry.

## Step 9 Acceptance Criteria

- [ ] CMS loads the saved homepage record.
- [ ] Form populates correctly.
- [ ] savedState matches database content.
- [ ] Save updates the known row.
- [ ] Duplicate Save clicks are prevented.
- [ ] Successful save updates savedState.
- [ ] Failed save preserves user edits.
- [ ] Errors display clearly.
- [ ] Cancel returns to latest savedState.
- [ ] No extra homepage rows are created.

---

# STEP 10
# Image Replacement / Upload

## Technology

**JavaScript + Supabase Storage**

## Purpose

Allow the CMS user to replace the logo, hero image, and Our Movement image.

## Primary File

```text
js/services/storage-service.js
```

## Editable Images

- site logo;
- hero image;
- Our Movement image.

---

## Selection Flow

```text
Replace Image
      ↓
Browser file picker
      ↓
Validate file
      ↓
Generate local preview
      ↓
Update currentState
```

At this stage:

**Do not upload immediately.**

---

## Recommended Validation

Validate:

- accepted MIME type;
- file size limit;
- file existence.

Allowed demo formats may include:

```text
image/png
image/jpeg
image/webp
```

Document the chosen maximum file size.

---

## Preview

After selection:

- display the local selected image;
- retain existing saved URL separately;
- mark editor as having unsaved changes.

---

## Undo/Redo and Image Selection

Image changes should participate in editor state/history where feasible.

Because browser `File` objects and object URLs require careful handling, implementation should explicitly manage:

- selected file;
- preview URL;
- saved URL.

Revoke obsolete object URLs where appropriate.

---

## Save Upload Flow

```text
Save Changes
      ↓
Detect newly selected files
      ↓
Upload files to Storage
      ↓
Receive storage paths / public URLs
      ↓
Build database payload
      ↓
Update homepage_content
```

---

## Storage Naming

Use predictable but collision-safe file naming.

Possible approach:

```text
hero/<timestamp>-<safe-filename>
movement/<timestamp>-<safe-filename>
logos/<timestamp>-<safe-filename>
```

Do not trust raw user filenames without sanitization.

---

## Failed Upload

If an upload fails:

- do not update the database with an invalid reference;
- show error;
- preserve editor state;
- allow retry.

---

## Orphaned Upload Consideration

If:

1. file upload succeeds;
2. database save fails;

an uploaded file may become unused.

For this demo, document the limitation or add simple cleanup if practical.

Do not overbuild a media-management system.

---

## Old Image Deletion

Automatic deletion of the previous image is optional for the proof of concept.

Safer initial behavior:

- upload new file;
- update database reference;
- leave old file in Storage during demo development.

Cleanup can be done manually.

## Step 10 Acceptance Criteria

- [ ] Logo file picker works.
- [ ] Hero image picker works.
- [ ] Movement image picker works.
- [ ] Invalid file types are rejected.
- [ ] File size limits are enforced.
- [ ] Local preview works.
- [ ] Image does not upload before Save.
- [ ] Save uploads selected files.
- [ ] Database receives new image references.
- [ ] Failed upload does not corrupt CMS state.
- [ ] Public image can load from saved reference.
- [ ] No anonymous user can upload.

---

# STEP 11
# Public Homepage ↔ Supabase

## Technology

**JavaScript + Supabase Database**

## Purpose

Make the public homepage display the content saved through the CMS.

## Primary File

```text
js/public/homepage.js
```

## Supporting Service

Reuse:

```text
js/services/content-service.js
```

Public homepage logic should not duplicate database query code unnecessarily.

---

## Public Load Flow

```text
index.html loads
      ↓
Static fallback HTML already visible
      ↓
Fetch homepage_content
      ↓
Successful?
  ┌────┴─────┐
  NO         YES
  ↓           ↓
Keep        Map content
fallback    into DOM
```

---

## Fallback Requirement

Do not blank CMS-managed elements in the HTML.

Correct:

```html
<h1 data-cms="hero-title">
  VCA Philippines
</h1>
```

Incorrect:

```html
<h1 data-cms="hero-title"></h1>
```

If Supabase fails, the page must still show the static default site.

---

## DOM Mapping

Map database fields only to the intended elements.

Examples:

```text
hero_title              → [data-cms="hero-title"]
hero_description        → [data-cms="hero-description"]
hero_image_url          → [data-cms="hero-image"]
about_title             → [data-cms="about-title"]
announcement_title      → [data-cms="announcement-title"]
footer_text             → [data-cms="footer-text"]
```

---

## Button Mapping

Hero button requires:

- button text;
- button href.

The `data-cms="hero-button"` element may receive both.

---

## Image Mapping

Image fields should update:

- `src`;
- optionally alt text only if CMS alt fields are introduced later.

For this proof of concept, alt text may remain static if it remains accurate.

---

## Safety

Prefer text assignment using:

```text
textContent
```

rather than injecting arbitrary HTML.

The CMS demo does not require rich-text HTML editing.

## Step 11 Acceptance Criteria

- [ ] Public page fetches homepage content.
- [ ] Hero text updates.
- [ ] Hero button text updates.
- [ ] Hero button link updates.
- [ ] Logo updates.
- [ ] Hero image updates.
- [ ] Movement content updates.
- [ ] Movement image updates.
- [ ] Announcement updates.
- [ ] Footer updates.
- [ ] Static fallback content remains.
- [ ] Supabase failure does not blank the page.
- [ ] Public page has no editing capability.

---

# STEP 12
# Security QA

## Purpose

Verify that the system is secure at the backend-policy level rather than only through the UI.

## Test Identities

Test as:

1. anonymous public visitor;
2. authorized authenticated CMS admin.

If possible, optionally test a second unauthorized authenticated account to confirm one-user restriction.

---

## Anonymous Database Tests

Expected:

```text
SELECT homepage_content    PASS
UPDATE homepage_content    BLOCK
INSERT homepage_content    BLOCK
DELETE homepage_content    BLOCK
```

---

## Anonymous Storage Tests

Expected:

```text
READ published images      PASS if bucket is public-read
UPLOAD image               BLOCK
UPDATE image               BLOCK
DELETE image               BLOCK
```

---

## Authorized Admin Tests

Expected:

```text
SELECT homepage_content    PASS
UPDATE homepage_content    PASS
UPLOAD image               PASS
```

---

## Direct Admin Route Tests

Test:

```text
/admin/index.html
```

while logged out.

Expected:

```text
redirect to login
```

---

## Session Tests

Test:

- login;
- refresh;
- new tab;
- logout;
- revisit admin;
- expired/invalid session where practical.

---

## Frontend Secret Review

Search source files for:

- service role key;
- database password;
- accidental credentials;
- hard-coded login password.

Expected:

```text
none
```

---

## RLS Verification

Do not consider the test complete merely because the UI hides Save.

Attempt direct Supabase write calls while anonymous.

They must fail.

## Step 12 Acceptance Criteria

- [ ] Anonymous SELECT works.
- [ ] Anonymous UPDATE fails.
- [ ] Anonymous INSERT fails.
- [ ] Anonymous DELETE fails.
- [ ] Anonymous Storage upload fails.
- [ ] Authorized admin UPDATE works.
- [ ] Authorized admin upload works.
- [ ] Logged-out admin route is protected.
- [ ] Logout invalidates CMS access.
- [ ] No privileged secrets are exposed.
- [ ] Security depends on RLS/policies, not hidden UI.

---

# STEP 13
# End-to-End QA

## Purpose

Validate the CMS proof of concept as a complete user workflow.

## Primary Functional Scenario

```text
Open public homepage
        ↓
Confirm saved/default content
        ↓
Open CMS login
        ↓
Login
        ↓
Open Homepage editor
        ↓
Change Hero Title
        ↓
Undo
        ↓
Verify old title
        ↓
Redo
        ↓
Verify new title
        ↓
Replace Hero Image
        ↓
Verify local preview
        ↓
Save Changes
        ↓
Verify success
        ↓
Open public homepage
        ↓
Verify new title + new image
        ↓
Return to CMS
        ↓
Make new unsaved edit
        ↓
Cancel
        ↓
Verify saved state restored
        ↓
Restore Default
        ↓
Confirm restore
        ↓
Verify default values appear
        ↓
Save Changes
        ↓
Open public homepage
        ↓
Verify defaults restored
        ↓
Logout
        ↓
Attempt admin route
        ↓
Confirm redirect to login
```

---

## Additional Functional Tests

### Login

- correct credentials;
- incorrect password;
- incorrect email;
- blank fields;
- network/backend error.

### Editor

- individual text fields;
- multiline text;
- button text;
- button link;
- logo;
- hero image;
- movement image.

### History

- multiple Undo operations;
- multiple Redo operations;
- Undo then new edit;
- Save then history state;
- Restore Default then Undo if supported.

### Cancel

- text edits;
- image selection;
- combination of both.

### Save

- text-only save;
- image-only save;
- text + image save;
- save failure;
- duplicate save click.

---

## Responsive QA

Test:

```text
1440px
1200px
1024px
800px
650px
390px
```

Verify both:

- public homepage;
- login page;
- admin editor.

---

## Browser QA

At minimum, test the primary development browser.

If feasible, also test another Chromium-based browser or mobile browser.

---

## Console QA

Check browser console for:

- uncaught exceptions;
- failed imports;
- repeated API errors;
- invalid asset paths.

---

## Data QA

After saves, verify directly in Supabase:

- one homepage row remains;
- expected fields changed;
- image URL/path matches;
- timestamps update;
- no accidental duplicate rows.

## Step 13 Acceptance Criteria

- [ ] Complete functional scenario passes.
- [ ] Login is stable.
- [ ] Editor loads.
- [ ] Undo works.
- [ ] Redo works.
- [ ] Cancel works.
- [ ] Restore Default works.
- [ ] Save works.
- [ ] Image replacement works.
- [ ] Public page reflects saved changes.
- [ ] Defaults can be restored.
- [ ] Logout works.
- [ ] Protected route works.
- [ ] Responsive QA passes.
- [ ] No blocking console errors.
- [ ] Database state remains clean.

---

# STEP 14
# GitHub Pages Demo Deployment

## Purpose

Publish the CMS proof of concept so it can be demonstrated online.

## Hosting Responsibilities

GitHub Pages hosts:

```text
index.html
vca_css.css
assets/
admin/
js/
```

Supabase provides:

```text
Auth
Database
Storage
RLS
Storage Policies
```

---

## Repository Setup

Before deployment:

- initialize Git if not already initialized;
- add `.gitignore` if needed;
- commit the approved demo baseline;
- create/connect the GitHub repository;
- push the project.

No secrets should be committed.

---

## Frontend Configuration

Frontend may contain:

```text
Supabase project URL
Supabase anon/publishable key
```

These are expected to be exposed in a browser-based Supabase application.

Security still depends on:

```text
RLS + Storage policies
```

Never expose:

```text
service_role key
database password
private admin secrets
```

---

## Path QA

GitHub Pages may serve the site under a repository subpath.

Verify that:

- CSS paths work;
- JS module paths work;
- image paths work;
- admin navigation paths work;
- View Website works;
- login redirect paths work.

Avoid assumptions that the site always runs at `/`.

---

## Auth Deployment QA

Verify:

- login works from GitHub Pages origin;
- session works;
- redirect works;
- logout works;
- admin page guard works.

If Supabase Auth configuration requires allowed redirect URLs/site URLs, configure the GitHub Pages URL appropriately.

---

## Production-Demo Safety

Keep:

- SAMPLE ONLY watermark;
- CMS DEMO badge;
- no production claims;
- no sensitive real-world content.

---

## Deployment Acceptance Criteria

- [ ] Git repository initialized.
- [ ] Repository pushed to GitHub.
- [ ] GitHub Pages enabled.
- [ ] Public homepage loads online.
- [ ] CSS loads.
- [ ] Images load.
- [ ] CMS login loads.
- [ ] Login works online.
- [ ] Admin session guard works.
- [ ] CMS loads saved data.
- [ ] Save works online.
- [ ] Image upload works online.
- [ ] Public page reflects CMS changes.
- [ ] Logout works online.
- [ ] Restore Default works online.
- [ ] No secrets exposed.
- [ ] SAMPLE ONLY remains visible.

---

# 8. Demo Completion Criteria

The proof of concept is complete when it demonstrates all of the following:

```text
✓ Custom-built public website
✓ Custom-built CMS interface
✓ One authenticated CMS user
✓ Protected admin area
✓ Editable homepage text
✓ Editable logo
✓ Editable hero image
✓ Editable movement image
✓ Undo
✓ Redo
✓ Cancel
✓ Restore Default
✓ Save Changes
✓ Database persistence
✓ Supabase Storage
✓ Supabase Auth
✓ Supabase RLS security
✓ Public homepage updates
✓ Static fallback content
✓ GitHub Pages deployment
```

---

# 9. Out of Scope

The following features are intentionally excluded from this proof of concept:

- multiple CMS users;
- user registration;
- public sign-up;
- forgot-password workflow;
- user-management screen;
- multiple permission roles;
- page builder;
- drag-and-drop blocks;
- rich text editor;
- multiple public website pages controlled by CMS;
- navigation management;
- church directory CRUD;
- events CRUD;
- ministries CRUD;
- resources CRUD;
- announcement archive;
- media library;
- image cropping/editor;
- draft/publish workflow;
- revisions/history database;
- audit logs;
- SEO editor;
- analytics;
- themes;
- multi-church CMS;
- multi-tenant architecture;
- production-grade backup workflows.

These may be evaluated only after the proof of concept is successfully completed.

---

# 10. Current Progress

```text
STEP 1
✓ Public Demo Homepage

STEP 2
→ CMS HTML Shell

STEP 3
CMS CSS

STEP 4
Supabase Schema + Seed

STEP 5
Supabase RLS + Storage Policies

STEP 6
Authentication

STEP 7
CMS Editor State

STEP 8
Undo / Redo / Cancel / Restore Default

STEP 9
Content Load / Save

STEP 10
Image Replacement / Upload

STEP 11
Public Homepage ↔ Supabase

STEP 12
Security QA

STEP 13
End-to-End QA

STEP 14
GitHub Pages Demo Deployment
```

---

# 11. Milestone Change Rule

Before moving to the next step:

1. complete the current step;
2. run its acceptance checks;
3. fix blocking issues;
4. document any intentional limitations;
5. only then mark the step complete.

Do not begin a later step simply because part of its code would be convenient to add early.

The purpose of this roadmap is to preserve clear architectural boundaries and make debugging easier.

---

# 12. Technical Architect Review Points

At each milestone, confirm:

```text
1. What problem is this step solving?
2. Which technical layer owns the responsibility?
3. Are we adding anything outside the approved demo scope?
4. Is the implementation modular?
5. Is security enforced in the correct layer?
6. Can the step be tested independently?
7. Does the acceptance checklist pass?
8. Are we ready to freeze this milestone and move forward?
```

---

# End of Roadmap
