// Real UI and live Supabase. Never collect login inputs, tokens, cookies, or headers.
import { getSupabaseClient } from '../admin/js/supabase-client.js';
import { fieldMap, imageMap } from '../admin/js/editor-view.js';
import { homepageFields } from '../admin/js/editor-data.js';
import { defaultContent } from '../admin/js/editor-defaults.js';

const runId = Date.now();
const widths = [1440, 1200, 1024, 800, 650, 390];
const state = { date: new Date().toISOString(), runId, mode: window.publicOnly ? 'public-only' : 'full',
  phase: 'baseline', checks: [], artifacts: [], screenshots: [], writesStarted: false, restored: false };
const status = document.getElementById('status');
let frame;
let client;
let snapshot;
let checkpointQueue = Promise.resolve();
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const normalized = rows => [...rows].sort((a, b) => a.id - b.id).map(({ updated_at, ...row }) => row);
const sameContent = (a, b) => equal(normalized(a.homepage), normalized(b.homepage)) && equal(normalized(a.announcements), normalized(b.announcements));
const doc = () => frame.contentDocument;
const win = () => frame.contentWindow;
const byId = id => doc().getElementById(id);
const entries = () => [...doc().querySelectorAll('.announcement-entry')];
const clean = () => byId('save-button').disabled && byId('cancel-button').disabled && !byId('editor-status').textContent.includes('Unsaved');
const writes = () => win().qa.requests.filter(r => ['database', 'storage'].includes(r.area) && !['GET', 'HEAD'].includes(r.method));

async function checkpoint() {
  const body = JSON.stringify(state);
  checkpointQueue = checkpointQueue.then(async () => {
    const response = await fetch('/qa-state', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
    if (!response.ok) throw new Error('Checkpoint failed');
  });
  await checkpointQueue;
}
window.qaArtifact = async path => {
  if (!state.artifacts.some(a => a.path === path)) state.artifacts.push({ path, state: 'PRESENT' });
  await checkpoint();
};
async function check(area, test, passed, detail = {}, required = true) {
  state.checks.push({ area, test, result: passed ? 'PASS' : 'FAIL', detail });
  document.getElementById('results').textContent = `${state.checks.filter(c => c.result === 'PASS').length} checks passed; ${state.checks.filter(c => c.result === 'FAIL').length} failed.`;
  await checkpoint();
  if (!passed && required) throw new Error('CHECK_FAILED');
}
async function until(predicate, label, timeout = 25000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (await predicate()) return;
    await pause(100);
  }
  await check('ENVIRONMENT', label, false, { reason: 'Timed out waiting for expected browser state' });
}
async function open(path) {
  if (frame?.contentWindow.qa?.errors) await check('BROWSER', 'No uncaught errors before navigation', false, { count: win().qa.errors }, false);
  frame?.remove();
  frame = document.createElement('iframe');
  frame.style.cssText = 'width:1440px;height:900px';
  document.getElementById('browser').append(frame);
  await new Promise(resolve => { frame.onload = resolve; frame.src = path; });
}
async function readDatabase() {
  const [home, rows] = await Promise.all([
    client.from('homepage_content').select('*').order('id'),
    client.from('homepage_announcements').select('*').order('sort_order').order('id'),
  ]);
  if (home.error || rows.error) throw new Error('DATABASE_READ_FAILED');
  return { homepage: home.data, announcements: rows.data };
}
async function loadEditor() {
  await until(() => win().location.pathname.endsWith('/admin/index.html') && !doc().body.hidden && byId('hero-title')?.disabled === false, 'Editor ready');
  await loadImages();
}
async function loadImages() {
  for (const img of doc().images) {
    img.loading = 'eager';
    await img.decode();
  }
}
function edit(input, value) {
  input.value = value;
  input.dispatchEvent(new (win().Event)('input', { bubbles: true }));
}
function editorMatches(data) {
  return Object.entries(fieldMap).every(([id, field]) => byId(id).value === data.homepage[0][field]) &&
    entries().length === data.announcements.length && entries().every((entry, i) =>
      [...entry.querySelectorAll('[data-field]')].every(input => input.value === data.announcements[i][input.dataset.field])) &&
    Object.entries(imageMap).every(([prefix, field]) => byId(`${prefix}-preview`).src === new URL(data.homepage[0][field], new URL('../', doc().baseURI)).href);
}
async function noDatabaseChange(test) {
  await check('EDITOR', test, equal(await readDatabase(), snapshot) && writes().length === 0, { writes: writes().length });
}
async function publicMatches(data, label, path = '/index.html') {
  await open(path);
  const module = await win().eval(`import("${path.startsWith('/repo/') ? '/repo' : ''}/js/homepage-hydration.js")`);
  await check('PUBLIC', `${label}: hydration`, await module.hydrationComplete);
  await loadImages();
  const target = name => doc().querySelector(`[data-cms="${name}"]`);
  const text = ['hero_eyebrow', 'hero_title', 'hero_description', 'about_label', 'about_title', 'about_description', 'footer_text'];
  await check('PUBLIC', `${label}: content mapping`, text.every(field => target(field.replaceAll('_', '-')).textContent === data.homepage[0][field]) &&
    [...target('announcements').children].length === data.announcements.length && [...target('announcements').children].every((card, i) =>
      ['announcement_date', 'announcement_title', 'announcement_description'].every(field => card.querySelector(`[data-cms="${field.replaceAll('_', '-')}"]`).textContent === data.announcements[i][field])));
  await check('PUBLIC', `${label}: all three images render`, Object.entries(imageMap).every(([prefix, field]) => {
    const img = target(prefix);
    return img.naturalWidth > 0 && img.src === new URL(data.homepage[0][field], doc().baseURI).href;
  }));
  const home = data.homepage[0];
  const colors = { theme_primary_color: '--vca-blue', theme_secondary_color: '--vca-sky', theme_background_color: '--background', theme_text_color: '--text' };
  await check('PUBLIC', `${label}: theme and button`, Object.entries(colors).every(([field, variable]) => doc().documentElement.style.getPropertyValue(variable) === home[field]) &&
    (home.hero_button_text ? target('hero-button').textContent === home.hero_button_text && target('hero-button').href === new URL(home.hero_button_link, doc().baseURI).href : target('hero-button').hidden));
  await check('PUBLIC', `${label}: read-only page`, !doc().querySelector('input,textarea,select,[contenteditable="true"],#save-button') && writes().length === 0 && win().qa.errors === 0);
}

async function responsive(kind) {
  status.textContent = `Measuring ${kind} at six viewport widths...`;
  for (const width of widths) {
    frame.style.width = `${width}px`;
    frame.style.height = '900px';
    await pause(120);
    const d = doc();
    const w = win();
    const root = d.documentElement;
    const visible = element => element.getClientRects().length > 0 && w.getComputedStyle(element).visibility !== 'hidden';
    const controls = [...d.querySelectorAll('input,textarea,select,button,nav a,.admin-header a,.hero-actions a')].filter(visible);
    const badControls = controls.filter(el => { const r = el.getBoundingClientRect(); return r.left < -1 || r.right > root.clientWidth + 1 || r.width < 20 || r.height < 20 || parseFloat(w.getComputedStyle(el).fontSize) < 12; });
    const images = [...d.images].filter(visible);
    const imageFit = images.every(img => { const css = w.getComputedStyle(img); const r = img.getBoundingClientRect(); return img.naturalWidth > 0 && r.width > 0 && r.right <= root.clientWidth + 1 && (['cover', 'contain', 'scale-down'].includes(css.objectFit) || Math.abs(r.width / r.height - img.naturalWidth / img.naturalHeight) < 0.04); });
    const sections = [...d.querySelectorAll('.editor-section')];
    const noOverlap = sections.every((section, i) => i === 0 || section.getBoundingClientRect().top >= sections[i - 1].getBoundingClientRect().bottom - 1);
    const region = d.querySelector('#editor-status,#login-status');
    const statusVisible = !region || !region.textContent || visible(region) && region.getBoundingClientRect().width > 30 && region.getBoundingClientRect().right <= root.clientWidth + 1;
    const navigation = [...d.querySelectorAll('header,nav')].filter(visible).every(el => el.getBoundingClientRect().right <= root.clientWidth + 1);
    const detail = { viewport: w.innerWidth, contentWidth: root.scrollWidth, noOverflow: root.scrollWidth <= w.innerWidth + 1, usableControls: badControls.length === 0, imageFit, noOverlap, statusVisible, navigation };
    await check('RESPONSIVE', `${kind} ${width}px`, Object.entries(detail).filter(([key]) => !['viewport', 'contentWidth'].includes(key)).every(([, value]) => value), detail, false);
    if ([1440, 800, 390].includes(width)) {
      // Empty login inputs before any screenshot; no password or email is captured.
      if (kind === 'login' && (d.getElementById('login-email').value || d.getElementById('login-password').value)) continue;
      document.body.classList.add('capture');
      window.scrollTo(0, 0);
      const height = Math.max(d.body.scrollHeight, root.scrollHeight);
      frame.style.height = `${height}px`;
      await pause(100);
      const captured = await (await fetch('/qa-capture', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, width, height }) })).json();
      if (captured.captured) state.screenshots.push({ kind, width, file: captured.file });
      document.body.classList.remove('capture');
    }
  }
  frame.style.cssText = 'width:1440px;height:900px';
  await checkpoint();
}

async function baseline() {
  client = await getSupabaseClient();
  snapshot = await readDatabase();
  state.snapshot = snapshot;
  await checkpoint(); // Durable public snapshot before any possible live write.
  await check('CLEANUP', 'Baseline singleton and no preexisting E2E QA rows', snapshot.homepage.length === 1 && snapshot.homepage[0].id === 1 && !snapshot.announcements.some(row => row.announcement_title === 'E2E-QA-TEMP'));
  const authored = new DOMParser().parseFromString(await (await fetch('/index.html')).text(), 'text/html');
  await check('PUBLIC', 'Authored static fallback retained', ['hero-title', 'about-title', 'footer-text', 'announcements'].every(name => authored.querySelector(`[data-cms="${name}"]`)?.textContent.trim()) && authored.querySelectorAll('img').length >= 3);
  await publicMatches(snapshot, 'Initial homepage');
  await responsive('public');
  await publicMatches(snapshot, 'Repository subpath', '/repo/index.html');
  await open('/index.html?e2e-fallback');
  const fallback = await win().eval('import("/js/homepage-hydration.js")');
  await check('PUBLIC', 'Network failure keeps authored fallback', !(await fallback.hydrationComplete) && ['hero-title', 'about-title', 'footer-text', 'announcements'].every(name => doc().querySelector(`[data-cms="${name}"]`).textContent === authored.querySelector(`[data-cms="${name}"]`).textContent) && win().qa.errors === 0);
  await open('/admin/login.html');
  await until(() => !doc().body.hidden && byId('login-submit')?.disabled === false, 'Login ready');
  edit(byId('login-email'), `e2e-qa-${runId}@example.invalid`);
  edit(byId('login-password'), `deliberately-invalid-${runId}`);
  byId('login-form').requestSubmit();
  await until(() => byId('login-status').classList.contains('is-error'), 'Invalid login response');
  await check('AUTH', 'Invalid login rejected with safe error', win().qa.requests.some(r => r.resource === 'login' && r.status === 400) && byId('login-status').textContent.startsWith('Unable to sign in.') && byId('login-password').value === '');
  byId('login-email').value = '';
  await loadImages();
  await responsive('login');
  if (window.publicOnly) {
    await check('CLEANUP', 'Read-only preliminary run left database unchanged', equal(await readDatabase(), snapshot));
    state.restored = true;
    return;
  }
  state.phase = 'awaiting-manual-login';
  status.textContent = 'Sign in below with the CMS admin. After login, QA runs automatically, restores the original content, and logs out. Do not edit the site elsewhere during this run.';
  await checkpoint();
  await until(() => win().location.pathname === '/admin/index.html' && !doc().body.hidden && byId('hero-title')?.disabled === false, 'Manual admin login', 20 * 60 * 1000);
  await check('AUTH', 'Valid manual login and session recognized', !!(await client.auth.getUser()).data.user);
}

function addAnnouncement() {
  byId('add-announcement-button').click();
  const entry = entries().at(-1);
  edit(entry.querySelector('[data-field="announcement_title"]'), 'E2E-QA-TEMP');
  edit(entry.querySelector('[data-field="announcement_date"]'), 'E2E QA');
  edit(entry.querySelector('[data-field="announcement_description"]'), `e2e-qa-${runId}`);
  return entry;
}
async function chooseImage() {
  const canvas = doc().createElement('canvas');
  canvas.width = 16; canvas.height = 9;
  canvas.getContext('2d').fillStyle = '#233b82';
  canvas.getContext('2d').fillRect(0, 0, 16, 9);
  const png = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  const transfer = new (win().DataTransfer)();
  transfer.items.add(new (win().File)([await png.arrayBuffer()], `e2e-qa-${runId}.png`, { type: 'image/png' }));
  byId('hero-image-input').files = transfer.files;
  byId('hero-image-input').dispatchEvent(new (win().Event)('change', { bubbles: true }));
  await byId('hero-image-preview').decode();
}
async function editorChecks() {
  state.phase = 'editor-state';
  status.textContent = 'Testing unsaved editor changes and history...';
  await loadEditor();
  await check('EDITOR', 'Initial fields, announcement records and previews match snapshot', editorMatches(snapshot));
  await check('EDITOR', 'Initial saved state has no false dirty indication', clean() && byId('undo-button').disabled && byId('redo-button').disabled);
  await responsive('editor');
  edit(byId('hero-title'), 'E2E QA Hero Title');
  await check('EDITOR', 'Hero edit updates form and dirty state', byId('hero-title').value === 'E2E QA Hero Title' && !byId('save-button').disabled && byId('editor-status').textContent.includes('Unsaved changes'));
  byId('undo-button').click();
  await check('EDITOR', 'Undo restores saved hero title', byId('hero-title').value === snapshot.homepage[0].hero_title && clean());
  byId('redo-button').click();
  await check('EDITOR', 'Redo restores QA title', byId('hero-title').value === 'E2E QA Hero Title' && !byId('save-button').disabled);
  await noDatabaseChange('Edit Undo Redo never write database');
  const confirmations = win().qa.confirmations;
  byId('cancel-button').click();
  await check('EDITOR', 'Cancel confirms and restores complete saved state', win().qa.confirmations === confirmations + 1 && editorMatches(snapshot) && clean());
  await noDatabaseChange('Cancel never writes database');
  win().qa.answer = false;
  const before = win().qa.confirmations;
  byId('restore-default-button').click();
  await check('EDITOR', 'Restore Default requires confirmation', win().qa.confirmations === before + 1 && editorMatches(snapshot) && clean());
  win().qa.answer = true;
  byId('restore-default-button').click();
  await check('EDITOR', 'Restore Default loads defaults and becomes dirty', Object.entries(fieldMap).every(([id, field]) => byId(id).value === defaultContent[field]) && !byId('save-button').disabled);
  await noDatabaseChange('Restore Default is unsaved until Save');
  byId('cancel-button').click();
  await check('EDITOR', 'Cancel defaults returns to exact pre-QA values', editorMatches(snapshot) && clean());
  const entry = addAnnouncement();
  await check('ANNOUNCEMENTS', 'Add and edit temporary announcement', entries().length === snapshot.announcements.length + 1 && entry.querySelector('[data-field="announcement_title"]').value === 'E2E-QA-TEMP');
  entry.querySelector('[data-edit-announcement]').click();
  await check('ANNOUNCEMENTS', 'Done Editing locks temporary fields', [...entry.querySelectorAll('input,textarea')].every(input => input.readOnly));
  entry.querySelector('[data-edit-announcement]').click();
  await check('ANNOUNCEMENTS', 'Edit reopens only temporary card', [...entry.querySelectorAll('input,textarea')].every(input => !input.readOnly) && entries().slice(0, -1).every(card => [...card.querySelectorAll('input,textarea')].every(input => input.readOnly)));
  win().qa.answer = false;
  const priorConfirm = win().qa.confirmations;
  entry.querySelector('[data-delete-announcement]').click();
  await check('ANNOUNCEMENTS', 'Rejected Delete confirmation preserves temporary card', win().qa.confirmations === priorConfirm + 1 && entries().length === snapshot.announcements.length + 1);
  win().qa.answer = true;
  entry.querySelector('[data-delete-announcement]').click();
  await check('ANNOUNCEMENTS', 'Confirmed Delete removes temporary card locally', entries().length === snapshot.announcements.length);
  await noDatabaseChange('Announcement editing leaves real rows unchanged');
  // Add/delete may leave history but clean content. Reset it through Undo + Cancel.
  byId('undo-button').click();
  byId('cancel-button').click();
  await chooseImage();
  await check('IMAGES', 'Hero selection produces valid local preview and dirty state', byId('hero-image-preview').src.startsWith('blob:') && byId('hero-image-preview').naturalWidth === 16 && !byId('save-button').disabled);
  await noDatabaseChange('Image selection does not upload or save');
  await check('IMAGES', 'Logo and movement controls remain available', ['site-logo', 'about-image'].every(prefix => byId(`${prefix}-input`).type === 'file' && !byId(`${prefix}-input`).disabled && byId(`${prefix}-preview`).naturalWidth > 0));
  byId('undo-button').click();
  await loadImages();
  await check('IMAGES', 'Undo restores saved image reference and clean state', editorMatches(snapshot) && clean());
}

async function save(label) {
  const startWrites = writes().length;
  byId('homepage-editor-form').dispatchEvent(new (win().Event)('submit', { bubbles: true, cancelable: true }));
  const loading = byId('homepage-editor-form').getAttribute('aria-busy') === 'true' && byId('save-button').disabled && byId('editor-status').textContent === 'Saving changes...';
  byId('homepage-editor-form').dispatchEvent(new (win().Event)('submit', { bubbles: true, cancelable: true }));
  await check('PERSISTENCE', `${label}: loading and controls lock`, loading);
  await until(() => byId('homepage-editor-form').getAttribute('aria-busy') === 'false', `${label}: completes`, 45000);
  await check('PERSISTENCE', `${label}: success and normalized history`, byId('editor-status').textContent === 'Changes saved successfully.' && clean() && byId('undo-button').disabled && byId('redo-button').disabled);
  const requests = writes().slice(startWrites);
  await check('PERSISTENCE', `${label}: duplicate submit prevented`, requests.filter(r => r.resource === 'homepage_content' && r.method === 'PATCH').length === 1, { homepageUpdates: requests.filter(r => r.resource === 'homepage_content' && r.method === 'PATCH').length });
}
async function persistenceChecks() {
  status.textContent = 'Saving controlled QA title, announcement and image; original content will be restored next...';
  state.phase = 'live-save';
  edit(byId('hero-title'), 'E2E QA Hero Title');
  addAnnouncement().querySelector('[data-edit-announcement]').click();
  await chooseImage();
  // Verify no concurrent edit occurred before accepting responsibility for writes.
  await check('CLEANUP', 'Pre-write snapshot still current', equal(await readDatabase(), snapshot));
  state.writesStarted = true;
  await checkpoint();
  await save('Controlled full Save');
  const saved = await readDatabase();
  await check('PERSISTENCE', 'Database holds QA title and exactly one QA announcement', saved.homepage[0].hero_title === 'E2E QA Hero Title' && saved.announcements.filter(row => row.announcement_title === 'E2E-QA-TEMP' && row.announcement_description === `e2e-qa-${runId}`).length === 1);
  await check('PERSISTENCE', 'Real announcement content unchanged by Save', equal(normalized(saved.announcements.filter(row => snapshot.announcements.some(original => original.id === row.id))), normalized(snapshot.announcements)));
  const uploaded = new URL(saved.homepage[0].hero_image_url).pathname.split('/storage/v1/object/public/')[1];
  await check('IMAGES', 'Hero image uploaded once and persisted as public reference', saved.homepage[0].hero_image_url !== snapshot.homepage[0].hero_image_url && state.artifacts.length === 1 && state.artifacts[0].path === uploaded && writes().filter(r => r.area === 'storage' && r.method === 'POST').length === 1, { path: uploaded });
  await publicMatches(saved, 'Saved QA changes');
  await open('/admin/index.html');
  await loadEditor();
  await check('AUTH', 'Authenticated reload recognizes session', !doc().body.hidden && !!(await client.auth.getUser()).data.user);
  await check('PERSISTENCE', 'Reload loads persisted fields and image into clean editor', editorMatches(saved) && clean());
  // Restore through real UI: delete only the QA row and restore its changed title.
  edit(byId('hero-title'), snapshot.homepage[0].hero_title);
  const temporary = entries().find(entry => entry.querySelector('[data-field="announcement_title"]').value === 'E2E-QA-TEMP' && entry.querySelector('[data-field="announcement_description"]').value === `e2e-qa-${runId}`);
  temporary.querySelector('[data-delete-announcement]').click();
  await save('Restore title and delete QA announcement');
  await check('ANNOUNCEMENTS', 'Saved Delete removes temporary row', !(await readDatabase()).announcements.some(row => row.announcement_title === 'E2E-QA-TEMP'));
}

async function restoreSnapshot() {
  if (!state.writesStarted) {
    state.restored = !snapshot || equal(await readDatabase(), snapshot);
    return;
  }
  status.textContent = 'Restoring and verifying the original database snapshot...';
  state.phase = 'restoring';
  await checkpoint();
  let current = await readDatabase();
  if (!equal(normalized(current.homepage), normalized(snapshot.homepage))) {
    const payload = Object.fromEntries(homepageFields.map(field => [field, snapshot.homepage[0][field]]));
    const result = await client.from('homepage_content').update(payload).eq('id', 1).select('id');
    if (result.error || result.data.length !== 1) throw new Error('RESTORE_HOME_FAILED');
  }
  // Only delete this run's uniquely tagged temporary row, never real rows.
  const removed = await client.from('homepage_announcements').delete().eq('announcement_title', 'E2E-QA-TEMP').eq('announcement_description', `e2e-qa-${runId}`).select('id');
  if (removed.error) throw new Error('RESTORE_TEMP_FAILED');
  current = await readDatabase();
  for (const original of snapshot.announcements) {
    const live = current.announcements.find(row => row.id === original.id);
    if (!live) throw new Error('ORIGINAL_ROW_MISSING'); // Never silently replace original identity.
    if (!equal(normalized([live]), normalized([original]))) {
      const { id, created_at, updated_at, ...payload } = original;
      const result = await client.from('homepage_announcements').update(payload).eq('id', id).eq('homepage_id', 1).select('id');
      if (result.error || result.data.length !== 1) throw new Error('RESTORE_ROW_FAILED');
    }
  }
  current = await readDatabase();
  state.restored = sameContent(current, snapshot);
  state.finalIntegrity = { singletonRows: current.homepage.length,
    homepageContentMatches: equal(normalized(current.homepage), normalized(snapshot.homepage)),
    announcementsMatch: equal(normalized(current.announcements), normalized(snapshot.announcements)),
    qaRows: current.announcements.filter(row => row.announcement_title === 'E2E-QA-TEMP').length,
    homepageUpdatedAtChanged: current.homepage[0].updated_at !== snapshot.homepage[0].updated_at,
    announcementUpdatedAtChanged: current.announcements.filter(row => row.updated_at !== snapshot.announcements.find(original => original.id === row.id)?.updated_at).map(row => row.id) };
  await checkpoint();
  await check('CLEANUP', 'Exact original homepage content and image references restored', state.finalIntegrity.homepageContentMatches && current.homepage.length === 1);
  await check('CLEANUP', 'Original announcements and IDs restored; QA rows removed', state.finalIntegrity.announcementsMatch && state.finalIntegrity.qaRows === 0);
}
async function finalChecks() {
  await publicMatches(snapshot, 'Restored public homepage');
  await open('/admin/index.html');
  await loadEditor();
  await check('CLEANUP', 'Restored editor loads original values cleanly', editorMatches(snapshot) && clean());
  const requests = win().qa.requests;
  byId('logout-button').click();
  await until(() => win().location.pathname === '/admin/login.html' && !doc().body.hidden, 'Logout redirects');
  await check('AUTH', 'Logout clears session and redirects', requests.some(r => r.resource === 'logout' && r.status === 204) && !(await client.auth.getSession()).data.session);
  await open('/admin/index.html');
  await until(() => win().location.pathname === '/admin/login.html' && !doc().body.hidden, 'Logged-out direct route redirects');
  await check('AUTH', 'Logged-out direct admin route redirects', true);
  for (const artifact of state.artifacts) {
    const response = await fetch(`${client.supabaseUrl}/storage/v1/object/public/${artifact.path}?e2e_cleanup=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) {
      const body = await response.json();
      if (String(body.statusCode) === '404' && body.code === 'NoSuchKey') artifact.state = 'REMOVED';
    }
  }
  state.checks.push({ area: 'CLEANUP', test: 'Temporary Storage artifacts removed', result: state.artifacts.every(a => a.state === 'REMOVED') ? 'PASS' : 'PENDING', detail: { manualDashboardCleanup: state.artifacts.filter(a => a.state !== 'REMOVED').map(a => a.path) } });
}

try {
  await baseline();
  if (!window.publicOnly) {
    await editorChecks();
    try { await persistenceChecks(); }
    finally { await restoreSnapshot(); }
    await finalChecks();
  }
} catch (error) {
  if (error?.message !== 'CHECK_FAILED') await check('ENVIRONMENT', 'Runner completed expected workflow', false, { reason: 'Unexpected interruption; last recorded check identifies the stage', errorType: error?.name ?? 'Unknown' }, false);
  if (snapshot && !state.restored) {
    try { await restoreSnapshot(); }
    catch { await check('CLEANUP', 'Recovery completed', false, { reason: 'Restore not confirmed; retain browser session and JSON snapshot for recovery' }, false); }
  }
} finally {
  state.phase = 'finished';
  status.textContent = state.artifacts.some(a => a.state !== 'REMOVED') ? 'Database restored. Remove the reported temporary Storage image in Supabase Dashboard, then run --verify-cleanup.' : 'QA finished; see generated results and report.';
  await checkpoint();
}
