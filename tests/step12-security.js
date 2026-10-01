// Live demo checks. Tokens remain inside the SDK/browser; reports contain no credentials.
import { getSupabaseClient } from '../admin/js/supabase-client.js';
import { validateImage } from '../admin/js/editor-validation.js';

const checks = [];
const artifacts = [];
const runId = Date.now();
let frame;
const output = document.getElementById('results');
function record(test, expected, pass, detail = {}) {
  checks.push({ test, expected, result: pass ? 'PASS' : 'FAIL', ...detail });
  output.textContent = JSON.stringify({ checks, artifacts }, null, 2);
}
function dbResult(test, expected, result, allowed) {
  const denied = [401, 403].includes(result.status) && result.error?.code === '42501';
  record(test, expected, allowed ? !result.error && result.data?.length > 0 : denied,
    { status: result.status, code: result.error?.code ?? null, returnedRows: Array.isArray(result.data) ? result.data.length : null });
}
async function until(predicate, timeout = 20000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (await predicate()) return;
    await new Promise(resolve => setTimeout(resolve, 150));
  }
  throw new Error('QA_TIMEOUT');
}
async function openFrame(path) {
  frame?.remove();
  frame = document.createElement('iframe');
  frame.style.cssText = 'width:100%;height:650px;border:1px solid #ccc';
  document.getElementById('browser').append(frame);
  await new Promise(resolve => { frame.onload = resolve; frame.src = path; });
  return frame;
}
const atLogin = () => frame?.contentWindow.location.pathname === '/admin/login.html' && !frame.contentDocument.body.hidden;
const atEditor = () => frame?.contentWindow.location.pathname === '/admin/index.html' && !frame.contentDocument.body.hidden && frame.contentDocument.getElementById('hero-title')?.disabled === false;
const canvas = document.createElement('canvas');
canvas.width = canvas.height = 1;
canvas.getContext('2d').fillRect(0, 0, 1, 1);
const png = new Uint8Array(await (await new Promise(resolve => canvas.toBlob(resolve, 'image/png'))).arrayBuffer());
const tiny = new File([png], 'security-qa.png', { type: 'image/png' });
const invalid = new File(['security QA'], 'security-qa.txt', { type: 'text/plain' });
// A valid PNG followed by padding: declared image/png and strictly over 5 MiB.
const oversized = new File([png, new Uint8Array(5 * 1024 * 1024 + 1)], 'security-qa-large.png', { type: 'image/png' });
let client;
let baselineHome;
let baselineRows;
let tempId;
let tempMarker;

async function upload(identity, kind, file, shouldAllow) {
  const path = `hero/security-qa-${runId}-${identity}-${kind}.${file.type === 'text/plain' ? 'txt' : 'png'}`;
  const result = await client.storage.from('cms-demo').upload(path, file, { contentType: file.type, upsert: false });
  if (!result.error) artifacts.push(`cms-demo/${path}`);
  const code = result.error?.statusCode ?? result.error?.status ?? null;
  const message = result.error?.message ?? '';
  // Report fixed categories instead of arbitrary backend error text.
  const reason = /row.level security/i.test(message) ? 'row-level security' : /mime|type.*not.*support/i.test(message) ? 'MIME validation' : /size|large|maximum/i.test(message) ? 'size validation' : result.error ? 'other rejection' : 'accepted';
  const rejectedCorrectly = reason === 'row-level security' && identity === 'Anonymous' || reason === (kind === 'mime' ? 'MIME validation' : kind === 'oversized' ? 'size validation' : 'row-level security');
  record(`${identity} Storage ${kind}`, shouldAllow ? 'ALLOWED' : 'BLOCKED', shouldAllow ? !result.error : !!result.error && rejectedCorrectly,
    { status: code, reason, ...(result.error ? {} : { path: `cms-demo/${path}` }) });
}

async function anonymousChecks() {
  client = await getSupabaseClient();
  const session = await client.auth.getSession();
  if (session.data.session) throw new Error('EXPECTED_FRESH_PROFILE');
  const home = await client.from('homepage_content').select('*').order('id');
  const rows = await client.from('homepage_announcements').select('*').order('id');
  dbResult('Anonymous homepage SELECT', 'ALLOWED', home, true);
  record('Anonymous announcement SELECT', 'ALLOWED', !rows.error, { status: rows.status, returnedRows: rows.data?.length ?? null });
  if (home.error || rows.error || home.data.length !== 1 || home.data[0].id !== 1) throw new Error('BASELINE_UNAVAILABLE');
  baselineHome = home.data;
  baselineRows = rows.data;
  dbResult('Anonymous homepage UPDATE (existing value)', 'BLOCKED', await client.from('homepage_content').update({ hero_title: home.data[0].hero_title }).eq('id', 1).select('id'), false);
  // Existing singleton ID: accidental permission cannot create another homepage.
  // Only a permission error counts; a uniqueness/check violation does not pass.
  dbResult('Anonymous homepage INSERT', 'BLOCKED', await client.from('homepage_content').insert({ id: 1 }).select('id'), false);
  dbResult('Anonymous homepage DELETE (absent id)', 'BLOCKED', await client.from('homepage_content').delete().eq('id', 0).select('id'), false);
  tempMarker = `security-qa-${runId}-anonymous`;
  const inserted = await client.from('homepage_announcements').insert({ homepage_id: 1, announcement_title: 'SECURITY-QA-TEMP', announcement_description: tempMarker, sort_order: 2147483647 }).select('id');
  dbResult('Anonymous announcement INSERT', 'BLOCKED', inserted, false);
  if (!inserted.error) {
    tempId = inserted.data[0]?.id;
    // Only touch the specifically identified QA record if INSERT unexpectedly succeeds.
    await client.from('homepage_announcements').delete().eq('id', tempId).eq('announcement_description', tempMarker);
  }
  const target = baselineRows[0];
  dbResult('Anonymous announcement UPDATE (existing value)', 'BLOCKED', await client.from('homepage_announcements').update({ announcement_title: target?.announcement_title ?? 'SECURITY-QA-TEMP' }).eq('id', target?.id ?? 0).select('id'), false);
  dbResult('Anonymous announcement DELETE (absent id)', 'BLOCKED', await client.from('homepage_announcements').delete().eq('id', 0).select('id'), false);
  const image = await fetch(home.data[0].hero_image_url);
  const decoded = await createImageBitmap(await image.blob());
  record('Anonymous published image read', 'ALLOWED', image.ok && decoded.width > 0, { status: image.status, contentType: image.headers.get('Content-Type') });
  await createImageBitmap(tiny);
  record('QA upload fixture decodes', 'VALID PNG', true, { bytes: tiny.size });
  await upload('Anonymous', 'valid', tiny, false);
  await upload('Anonymous', 'mime', invalid, false);
  await upload('Anonymous', 'oversized', oversized, false);
  record('Frontend invalid MIME validation', 'BLOCKED', !!validateImage(invalid));
  record('Frontend oversized validation', 'BLOCKED', !!validateImage(oversized));
  await openFrame('/admin/index.html');
  await until(atLogin);
  record('Logged-out direct admin route', 'REDIRECTED', true);
  const doc = frame.contentDocument;
  doc.getElementById('login-email').value = `security-qa-${runId}@example.invalid`;
  doc.getElementById('login-password').value = `deliberately-invalid-${runId}`;
  doc.getElementById('login-form').requestSubmit();
  await until(() => doc.getElementById('login-status').classList.contains('is-error'));
  const authStatus = frame.contentWindow.qaAuthResponses.find(entry => entry.operation === 'login')?.status;
  record('Invalid credentials login', 'REJECTED; SAFE ERROR', atLogin() && authStatus === 400 && doc.getElementById('login-status').textContent.startsWith('Unable to sign in.') && doc.getElementById('login-password').value === '', { status: authStatus });
  // Invalid persisted local session, never a real token. The guard must call getUser.
  localStorage.setItem(client.auth.storageKey, JSON.stringify({ access_token: 'invalid-security-qa-token', refresh_token: 'invalid-security-qa-refresh', token_type: 'bearer', expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: '00000000-0000-0000-0000-000000000000' } }));
  await openFrame('/admin/index.html');
  await until(atLogin);
  record('Invalid local session direct admin route', 'REDIRECTED', true);
  localStorage.removeItem(client.auth.storageKey);
  // Backend JWT rejection is checked independently of DOM guarding.
  const response = await fetch(`${client.supabaseUrl}/rest/v1/homepage_content?id=eq.1`, { method: 'PATCH', headers: { apikey: client.supabaseKey, Authorization: 'Bearer invalid-security-qa-token', 'Content-Type': 'application/json' }, body: JSON.stringify({ hero_title: baselineHome[0].hero_title }) });
  record('Invalid token protected database write', 'BLOCKED', response.status === 401, { status: response.status });
  // Omit only the route guard in a test-served copy, then reveal/enable controls.
  // The real editor and persistence modules still run unchanged.
  await openFrame('/admin/security-bypass.html');
  frame.contentDocument.body.hidden = false;
  await until(() => frame.contentDocument.getElementById('hero-title')?.disabled === false);
  const bypassDoc = frame.contentDocument;
  bypassDoc.querySelectorAll('input, textarea, select, button').forEach(control => { control.disabled = false; });
  const title = bypassDoc.getElementById('hero-title');
  title.value += ' SECURITY-QA-TEMP';
  title.dispatchEvent(new frame.contentWindow.Event('input', { bubbles: true }));
  bypassDoc.getElementById('save-button').click();
  await until(() => bypassDoc.getElementById('editor-status').textContent.includes("We couldn't save"));
  record('Logged-out exposed editor Save', 'BLOCKED', true);
  const transfer = new frame.contentWindow.DataTransfer();
  transfer.items.add(new frame.contentWindow.File([png], `security-qa-${runId}.png`, { type: 'image/png' }));
  const input = bypassDoc.getElementById('hero-image-input');
  input.files = transfer.files;
  input.dispatchEvent(new frame.contentWindow.Event('change', { bubbles: true }));
  bypassDoc.getElementById('save-button').click();
  await until(() => bypassDoc.getElementById('editor-status').textContent.includes('upload failed'));
  record('Logged-out exposed editor image upload', 'BLOCKED', true);
  await verifyUnchanged(false);
}

async function verifyUnchanged(admin) {
  const home = await client.from('homepage_content').select('*').order('id');
  const rows = await client.from('homepage_announcements').select('*').order('id');
  const normalize = data => data.map(({ updated_at, ...row }) => row);
  record('Real homepage content unchanged', 'UNCHANGED', !home.error && JSON.stringify(normalize(home.data)) === JSON.stringify(normalize(baselineHome)));
  record('Homepage timestamp', admin ? 'MAY ADVANCE AFTER NO-OP UPDATE' : 'UNCHANGED', !home.error && (admin || home.data[0].updated_at === baselineHome[0].updated_at));
  record('Real announcement rows unchanged', 'UNCHANGED', !rows.error && JSON.stringify(rows.data) === JSON.stringify(baselineRows));
  record('QA announcement cleanup', 'NO QA ROWS', !rows.error && !rows.data.some(row => row.announcement_description?.includes(`security-qa-${runId}`)));
}

async function adminChecks() {
  document.getElementById('status').textContent = 'Sign in below with the CMS admin. QA then runs automatically, including logout. Credentials stay in this browser and Supabase.';
  await openFrame('/admin/login.html');
  await until(atEditor, 12 * 60 * 1000);
  // Same-origin frames share normal SDK auth storage; read the actual editor client.
  client = await frame.contentWindow.eval('import("/admin/js/supabase-client.js").then(m => m.getSupabaseClient())');
  record('Valid admin login and editor access', 'ALLOWED', !!(await client.auth.getUser()).data.user);
  const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.57.4');
  const isolated = createClient(client.supabaseUrl, client.supabaseKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  const badPassword = await isolated.auth.signInWithPassword({ email: (await client.auth.getUser()).data.user.email, password: `deliberately-invalid-${runId}` });
  record('Existing admin invalid password', 'REJECTED', badPassword.error?.status === 400 && !badPassword.data.session, { status: badPassword.error?.status ?? null });
  await openFrame('/admin/index.html');
  await until(atEditor);
  client = await frame.contentWindow.eval('import("/admin/js/supabase-client.js").then(m => m.getSupabaseClient())');
  record('Authenticated browser refresh', 'EDITOR ACCESSIBLE', true);
  const home = await client.from('homepage_content').select('*').eq('id', 1);
  dbResult('Admin homepage SELECT', 'ALLOWED', home, true);
  const rows = await client.from('homepage_announcements').select('*').order('id');
  record('Admin announcement SELECT', 'ALLOWED', !rows.error, { status: rows.status });
  // Read immediately before the no-op to avoid writing a stale title.
  dbResult('Admin homepage UPDATE (existing value)', 'ALLOWED', await client.from('homepage_content').update({ hero_title: home.data[0].hero_title }).eq('id', 1).select('id'), true);
  tempMarker = `security-qa-${runId}-admin`;
  try {
    const inserted = await client.from('homepage_announcements').insert({ homepage_id: 1, announcement_title: 'SECURITY-QA-TEMP', announcement_description: tempMarker, sort_order: 2147483647 }).select('id');
    dbResult('Admin announcement INSERT', 'ALLOWED', inserted, true);
    if (!inserted.error) {
      tempId = inserted.data[0].id;
      dbResult('Admin announcement UPDATE', 'ALLOWED', await client.from('homepage_announcements').update({ announcement_date: 'SECURITY-QA-TEMP updated' }).eq('id', tempId).eq('announcement_description', tempMarker).select('id'), true);
    }
  } finally {
    // Recover a potentially lost INSERT response by its unique QA marker.
    const removed = await client.from('homepage_announcements').delete().eq('announcement_title', 'SECURITY-QA-TEMP').eq('announcement_description', tempMarker).select('id');
    dbResult('Admin announcement DELETE', 'ALLOWED', removed, true);
  }
  const image = await fetch(home.data[0].hero_image_url);
  record('Admin published image read', 'ALLOWED', image.ok, { status: image.status });
  await upload('Admin', 'valid', tiny, true);
  await upload('Admin', 'mime', invalid, false);
  await upload('Admin', 'oversized', oversized, false);
  await verifyUnchanged(true);
  const authResponses = frame.contentWindow.qaAuthResponses;
  frame.contentDocument.getElementById('logout-button').click();
  await until(atLogin);
  const logoutStatus = authResponses.find(entry => entry.operation === 'logout')?.status;
  record('Logout clears session and redirects', 'SIGNED OUT', !localStorage.getItem(client.auth.storageKey) && logoutStatus >= 200 && logoutStatus < 300, { status: logoutStatus ?? null });
  await openFrame('/admin/index.html');
  await until(atLogin);
  record('Logged-out direct route after logout', 'REDIRECTED', true);
}

try {
  await anonymousChecks();
  if (window.adminQA) await adminChecks();
} catch (error) {
  // Never serialize errors that could carry request objects or credentials.
  record('Runner completed', 'COMPLETE', false, { reason: error?.message === 'QA_TIMEOUT' ? 'Timed out waiting for expected page state' : 'Check interrupted; inspect last completed check' });
} finally {
  document.getElementById('status').textContent = 'QA finished. Results below; temporary Storage paths require Dashboard cleanup.';
  await fetch('/security-result', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date: new Date().toISOString(), mode: window.adminQA ? 'admin' : 'anonymous', checks, artifacts }) });
}
