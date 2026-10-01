# Step 13 End-to-End QA

**Overall: PASS**

Checks: 98 passed; 0 failed; 0 pending. Mode: full; phase: finished.

## Acceptance matrix

| Area | Check | Result | Evidence |
|---|---|---|---|
| CLEANUP | Baseline singleton and no preexisting E2E QA rows | PASS |  |
| PUBLIC | Authored static fallback retained | PASS |  |
| PUBLIC | Initial homepage: hydration | PASS |  |
| PUBLIC | Initial homepage: content mapping | PASS |  |
| PUBLIC | Initial homepage: all three images render | PASS |  |
| PUBLIC | Initial homepage: theme and button | PASS |  |
| PUBLIC | Initial homepage: read-only page | PASS |  |
| RESPONSIVE | public 1440px | PASS | {"viewport": 1440, "contentWidth": 1425, "noOverflow": true, "usableControls": true, "imageFit": true, "noOverlap": true, "statusVisible": true, "navigation": true} |
| RESPONSIVE | public 1200px | PASS | {"viewport": 1200, "contentWidth": 1185, "noOverflow": true, "usableControls": true, "imageFit": true, "noOverlap": true, "statusVisible": true, "navigation": true} |
| RESPONSIVE | public 1024px | PASS | {"viewport": 1024, "contentWidth": 1009, "noOverflow": true, "usableControls": true, "imageFit": true, "noOverlap": true, "statusVisible": true, "navigation": true} |
| RESPONSIVE | public 800px | PASS | {"viewport": 800, "contentWidth": 785, "noOverflow": true, "usableControls": true, "imageFit": true, "noOverlap": true, "statusVisible": true, "navigation": true} |
| RESPONSIVE | public 650px | PASS | {"viewport": 650, "contentWidth": 635, "noOverflow": true, "usableControls": true, "imageFit": true, "noOverlap": true, "statusVisible": true, "navigation": true} |
| RESPONSIVE | public 390px | PASS | {"viewport": 390, "contentWidth": 375, "noOverflow": true, "usableControls": true, "imageFit": true, "noOverlap": true, "statusVisible": true, "navigation": true} |
| PUBLIC | Repository subpath: hydration | PASS |  |
| PUBLIC | Repository subpath: content mapping | PASS |  |
| PUBLIC | Repository subpath: all three images render | PASS |  |
| PUBLIC | Repository subpath: theme and button | PASS |  |
| PUBLIC | Repository subpath: read-only page | PASS |  |
| PUBLIC | Network failure keeps authored fallback | PASS |  |
| AUTH | Invalid login rejected with safe error | PASS |  |
| RESPONSIVE | login 1440px | PASS | {"viewport": 1440, "contentWidth": 1440, "noOverflow": true, "usableControls": true, "imageFit": true, "noOverlap": true, "statusVisible": true, "navigation": true} |
| RESPONSIVE | login 1200px | PASS | {"viewport": 1200, "contentWidth": 1200, "noOverflow": true, "usableControls": true, "imageFit": true, "noOverlap": true, "statusVisible": true, "navigation": true} |
| RESPONSIVE | login 1024px | PASS | {"viewport": 1024, "contentWidth": 1024, "noOverflow": true, "usableControls": true, "imageFit": true, "noOverlap": true, "statusVisible": true, "navigation": true} |
| RESPONSIVE | login 800px | PASS | {"viewport": 800, "contentWidth": 800, "noOverflow": true, "usableControls": true, "imageFit": true, "noOverlap": true, "statusVisible": true, "navigation": true} |
| RESPONSIVE | login 650px | PASS | {"viewport": 650, "contentWidth": 650, "noOverflow": true, "usableControls": true, "imageFit": true, "noOverlap": true, "statusVisible": true, "navigation": true} |
| RESPONSIVE | login 390px | PASS | {"viewport": 390, "contentWidth": 390, "noOverflow": true, "usableControls": true, "imageFit": true, "noOverlap": true, "statusVisible": true, "navigation": true} |
| AUTH | Valid manual login and session recognized | PASS |  |
| EDITOR | Initial fields, announcement records and previews match snapshot | PASS |  |
| EDITOR | Initial saved state has no false dirty indication | PASS |  |
| RESPONSIVE | editor 1440px | PASS | {"viewport": 1440, "contentWidth": 1425, "noOverflow": true, "usableControls": true, "imageFit": true, "noOverlap": true, "statusVisible": true, "navigation": true} |
| RESPONSIVE | editor 1200px | PASS | {"viewport": 1200, "contentWidth": 1185, "noOverflow": true, "usableControls": true, "imageFit": true, "noOverlap": true, "statusVisible": true, "navigation": true} |
| RESPONSIVE | editor 1024px | PASS | {"viewport": 1024, "contentWidth": 1009, "noOverflow": true, "usableControls": true, "imageFit": true, "noOverlap": true, "statusVisible": true, "navigation": true} |
| RESPONSIVE | editor 800px | PASS | {"viewport": 800, "contentWidth": 785, "noOverflow": true, "usableControls": true, "imageFit": true, "noOverlap": true, "statusVisible": true, "navigation": true} |
| RESPONSIVE | editor 650px | PASS | {"viewport": 650, "contentWidth": 635, "noOverflow": true, "usableControls": true, "imageFit": true, "noOverlap": true, "statusVisible": true, "navigation": true} |
| RESPONSIVE | editor 390px | PASS | {"viewport": 390, "contentWidth": 375, "noOverflow": true, "usableControls": true, "imageFit": true, "noOverlap": true, "statusVisible": true, "navigation": true} |
| EDITOR | Hero edit updates form and dirty state | PASS |  |
| EDITOR | Undo restores saved hero title | PASS |  |
| EDITOR | Redo restores QA title | PASS |  |
| EDITOR | Edit Undo Redo never write database | PASS | {"writes": 0} |
| EDITOR | Cancel confirms and restores complete saved state | PASS |  |
| EDITOR | Cancel never writes database | PASS | {"writes": 0} |
| EDITOR | Restore Default requires confirmation | PASS |  |
| EDITOR | Restore Default loads defaults and becomes dirty | PASS |  |
| EDITOR | Restore Default is unsaved until Save | PASS | {"writes": 0} |
| EDITOR | Cancel defaults returns to exact pre-QA values | PASS |  |
| ANNOUNCEMENTS | Add and edit temporary announcement | PASS |  |
| ANNOUNCEMENTS | Done Editing locks temporary fields | PASS |  |
| ANNOUNCEMENTS | Edit reopens only temporary card | PASS |  |
| ANNOUNCEMENTS | Rejected Delete confirmation preserves temporary card | PASS |  |
| ANNOUNCEMENTS | Confirmed Delete removes temporary card locally | PASS |  |
| EDITOR | Announcement editing leaves real rows unchanged | PASS | {"writes": 0} |
| IMAGES | Hero selection produces valid local preview and dirty state | PASS |  |
| EDITOR | Image selection does not upload or save | PASS | {"writes": 0} |
| IMAGES | Logo and movement controls remain available | PASS |  |
| IMAGES | Undo restores saved image reference and clean state | PASS |  |
| CLEANUP | Pre-write snapshot still current | PASS |  |
| PERSISTENCE | Controlled full Save: loading and controls lock | PASS |  |
| PERSISTENCE | Controlled full Save: success and normalized history | PASS |  |
| PERSISTENCE | Controlled full Save: duplicate submit prevented | PASS | {"homepageUpdates": 1} |
| PERSISTENCE | Database holds QA title and exactly one QA announcement | PASS |  |
| PERSISTENCE | Real announcement content unchanged by Save | PASS |  |
| IMAGES | Hero image uploaded once and persisted as public reference | PASS | {"path": "cms-demo/hero/1c11f493-4116-4d7d-90c9-94dbc3340eb8.png"} |
| PUBLIC | Saved QA changes: hydration | PASS |  |
| PUBLIC | Saved QA changes: content mapping | PASS |  |
| PUBLIC | Saved QA changes: all three images render | PASS |  |
| PUBLIC | Saved QA changes: theme and button | PASS |  |
| PUBLIC | Saved QA changes: read-only page | PASS |  |
| AUTH | Authenticated reload recognizes session | PASS |  |
| PERSISTENCE | Reload loads persisted fields and image into clean editor | PASS |  |
| PERSISTENCE | Restore title and delete QA announcement: loading and controls lock | PASS |  |
| PERSISTENCE | Restore title and delete QA announcement: success and normalized history | PASS |  |
| PERSISTENCE | Restore title and delete QA announcement: duplicate submit prevented | PASS | {"homepageUpdates": 1} |
| ANNOUNCEMENTS | Saved Delete removes temporary row | PASS |  |
| CLEANUP | Exact original homepage content and image references restored | PASS |  |
| CLEANUP | Original announcements and IDs restored; QA rows removed | PASS |  |
| PUBLIC | Restored public homepage: hydration | PASS |  |
| PUBLIC | Restored public homepage: content mapping | PASS |  |
| PUBLIC | Restored public homepage: all three images render | PASS |  |
| PUBLIC | Restored public homepage: theme and button | PASS |  |
| PUBLIC | Restored public homepage: read-only page | PASS |  |
| CLEANUP | Restored editor loads original values cleanly | PASS |  |
| AUTH | Logout clears session and redirects | PASS |  |
| AUTH | Logged-out direct admin route redirects | PASS |  |
| CLEANUP | Temporary Storage artifacts removed | PASS | {"verification": "Cache-busted public GET; Storage 404 / NoSuchKey required", "objects": 1} |
| PUBLISHED | Published live hydration | PASS | {"url": "https://yzcreativetech.github.io/cms-demo/"} |
| PUBLISHED | Published content mapping | PASS | {"url": "https://yzcreativetech.github.io/cms-demo/"} |
| PUBLISHED | Published images render | PASS | {"url": "https://yzcreativetech.github.io/cms-demo/"} |
| PUBLISHED | Published announcements match | PASS | {"url": "https://yzcreativetech.github.io/cms-demo/"} |
| PUBLISHED | Published page has no editing controls | PASS | {"url": "https://yzcreativetech.github.io/cms-demo/"} |
| PUBLISHED | Published demo labeling | PASS | {"url": "https://yzcreativetech.github.io/cms-demo/"} |
| PUBLISHED | Published fresh browser is logged out | PASS | {"url": "https://yzcreativetech.github.io/cms-demo/"} |
| PUBLISHED | Published source matches local: index.html | PASS | {"status": 200, "comparison": "Bytes compared with CRLF/LF normalized"} |
| PUBLISHED | Published source matches local: admin/login.html | PASS | {"status": 200, "comparison": "Bytes compared with CRLF/LF normalized"} |
| PUBLISHED | Published source matches local: admin/index.html | PASS | {"status": 200, "comparison": "Bytes compared with CRLF/LF normalized"} |
| PUBLISHED | Published source matches local: admin/js/supabase-client.js | PASS | {"status": 200, "comparison": "Bytes compared with CRLF/LF normalized"} |
| VISUAL | public desktop/tablet/mobile screenshot review | PASS | {"widths": [1440, 800, 390]} |
| VISUAL | login desktop/tablet/mobile screenshot review | PASS | {"widths": [1440, 800, 390]} |
| VISUAL | editor desktop/tablet/mobile screenshot review | PASS | {"widths": [1440, 800, 390]} |

## Snapshot, restoration, and artifacts

- The JSON result contains the public pre-QA database snapshot, IDs, ordering, timestamps, and all three original image references. No credentials or auth payloads are collected.
- Restoration compares every original content field, image reference, record ID, created_at, and announcement order. The automatic updated_at triggers advance on actual writes; that metadata is reported separately and is not reset by weakening database behavior.
- The run uses the real UI and live Supabase for saves; instrumentation records method/table/status only. Expected network failure is injected only for the static fallback check.
- Responsive checks measure overflow, form/button bounds, text size, image fitting, navigation bounds, section overlap, and status visibility at 1440/1200/1024/800/650/390 CSS pixels. Screenshots are temporary review artifacts, outside the repository.
- A UI save is restored through the UI when possible; a finally block independently reconciles the snapshot through the authorized client if needed.

- Storage `cms-demo/hero/1c11f493-4116-4d7d-90c9-94dbc3340eb8.png`: REMOVED.

Final integrity: {"singletonRows": 1, "homepageContentMatches": true, "announcementsMatch": true, "qaRows": 0, "homepageUpdatedAtChanged": true, "announcementUpdatedAtChanged": [4]}


## Published demo

- Verified existing deployment: https://yzcreativetech.github.io/cms-demo/
- The public, login, and editor HTML and frontend configuration matched local files. A fresh logged-out Chrome browser verified live content, images, announcements, demo labeling, and absence of editing controls.
- Authenticated editing was exercised against live Supabase through the local QA origin. No new deployment or published-origin admin login was performed.


## Visual review

- Reviewed public, login, and editor screenshots at desktop, tablet, and mobile widths. No overlapping sections, clipped navigation/actions, distorted images, or obscured status messages were observed.


## Final milestone

**STEP 13: COMPLETE. VCA Philippines CMS Demo: COMPLETE.** There is no Step 14. Prior milestone history is preserved.
No application code or security-policy correction was needed. The only tracked-file change is `milestone.md`; the four Step 13 QA files are new. Nothing was staged, committed, or pushed.


## Scope and handoff

- Local browser workflow and repository-subpath asset resolution are covered. Published-demo acceptance is recorded separately when a published URL is supplied/confirmed.
- Do not mark the milestone COMPLETE until the full workflow passes, content is restored, and every recorded Storage object is confirmed absent.
- Run `python tests/step13-e2e.py --verify-cleanup` after manual Dashboard removal. No Storage DELETE policy is added.
- No staging, commit, push, or deployment is performed by this runner.
