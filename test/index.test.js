import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import worker from '../src/index.js';

async function call(path, options = {}) {
  const req = new Request(`http://localhost${path}`, options);
  const ctx = createExecutionContext();
  const res = await worker.fetch(req, env, ctx);
  await waitOnExecutionContext(ctx);
  return res;
}

async function setupAndLogin() {
  await call('/api/auth/setup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'password123' }),
  });
  const res = await call('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'password123' }),
  });
  return res.headers.get('Set-Cookie').split(';')[0];
}

function authCall(path, cookie, options = {}) {
  const headers = { ...(options.headers || {}), Cookie: cookie };
  return call(path, { ...options, headers });
}

describe('CloudflareShare', () => {
  it('setup flow: check, create user, block duplicate, login', async () => {
    // Check setup needed
    const checkRes = await call('/api/auth/check');
    expect(checkRes.status).toBe(200);
    expect((await checkRes.json()).needsSetup).toBe(true);

    // Reject short password
    const shortRes = await call('/api/auth/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: '123' }),
    });
    expect(shortRes.status).toBe(400);

    // Create user
    const createRes = await call('/api/auth/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'password123' }),
    });
    expect(createRes.status).toBe(200);
    expect((await createRes.json()).ok).toBe(true);

    // Block duplicate
    const dupeRes = await call('/api/auth/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin2', password: 'password456' }),
    });
    expect(dupeRes.status).toBe(409);

    // Setup no longer needed
    const check2 = await call('/api/auth/check');
    expect((await check2.json()).needsSetup).toBe(false);

    // Reject bad login
    const badLogin = await call('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'wrong' }),
    });
    expect(badLogin.status).toBe(401);

    // Successful login
    const loginRes = await call('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'password123' }),
    });
    expect(loginRes.status).toBe(200);
    expect(loginRes.headers.get('Set-Cookie')).toContain('session=');
  });

  it('rejects unauthenticated file access', async () => {
    const res = await call('/api/files');
    expect(res.status).toBe(401);
  });

  it('file lifecycle: upload, list, download, share, unshare, delete', async () => {
    const cookie = await setupAndLogin();

    // Empty list
    const emptyRes = await authCall('/api/files', cookie);
    expect((await emptyRes.json()).length).toBe(0);

    // Upload
    const fd = new FormData();
    fd.append('file', new Blob(['hello world'], { type: 'text/plain' }), 'test.txt');
    const uploadRes = await authCall('/api/files/upload', cookie, { method: 'POST', body: fd });
    const uploadData = await uploadRes.json();
    expect(uploadRes.status).toBe(200);
    expect(uploadData.filename).toBe('test.txt');
    const fileId = uploadData.id;

    // List with file
    const listRes = await authCall('/api/files', cookie);
    const files = await listRes.json();
    expect(files.length).toBe(1);
    expect(files[0].filename).toBe('test.txt');
    expect(files[0].folder_name).toBeNull();

    // Authenticated download
    const dlRes = await authCall(`/api/files/${fileId}/download`, cookie);
    expect(dlRes.status).toBe(200);
    expect(await dlRes.text()).toBe('hello world');

    // Share
    const shareRes = await authCall(`/api/files/${fileId}/share`, cookie, { method: 'POST' });
    const shareData = await shareRes.json();
    expect(shareRes.status).toBe(200);
    const shareKey = shareData.shareKey;
    expect(shareKey).toBeTruthy();

    // Public download with key (via /api/files/:id/download?key=)
    const pubDlRes = await call(`/api/files/${fileId}/download?key=${shareKey}`);
    expect(pubDlRes.status).toBe(200);
    expect(await pubDlRes.text()).toBe('hello world');

    // Reject wrong key via old route
    const badKeyRes = await call(`/api/files/${fileId}/download?key=wrongkey`);
    expect(badKeyRes.status).toBe(403);

    // Key lookup via /api/share?key= (new public route)
    const infoRes = await call(`/api/share?key=${shareKey}`);
    expect(infoRes.status).toBe(200);
    const info = await infoRes.json();
    expect(info.filename).toBe('test.txt');

    // Reject invalid key via /api/share
    const badInfoRes = await call('/api/share?key=badkey');
    expect(badInfoRes.status).toBe(404);

    // Download via /api/share/download?key=
    const keyDlRes = await call(`/api/share/download?key=${shareKey}`);
    expect(keyDlRes.status).toBe(200);
    expect(await keyDlRes.text()).toBe('hello world');

    // Unshare
    const unshareRes = await authCall(`/api/files/${fileId}/unshare`, cookie, { method: 'POST' });
    expect(unshareRes.status).toBe(200);

    // Delete
    const delRes = await authCall(`/api/files/${fileId}`, cookie, { method: 'DELETE' });
    expect(delRes.status).toBe(200);
    const afterDel = await authCall('/api/files', cookie);
    expect((await afterDel.json()).length).toBe(0);
  });

  it('stores uploaded folder metadata and allows password changes', async () => {
    const cookie = await setupAndLogin();

    const fd = new FormData();
    fd.append('file', new Blob(['nested content'], { type: 'text/plain' }), 'note.txt');
    fd.append('folderName', 'docs');
    fd.append('relativePath', 'docs/note.txt');
    fd.append('folderId', 'folder-docs-1');

    const uploadRes = await authCall('/api/files/upload', cookie, { method: 'POST', body: fd });
    expect(uploadRes.status).toBe(200);

    const listRes = await authCall('/api/files', cookie);
    const files = await listRes.json();
    expect(files).toHaveLength(1);
    expect(files[0].folder_name).toBe('docs');
    expect(files[0].relative_path).toBe('docs/note.txt');
    expect(files[0].folder_id).toBe('folder-docs-1');

    const badChange = await authCall('/api/auth/password', cookie, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ currentPassword: 'wrong', newPassword: 'newpass123' }),
    });
    expect(badChange.status).toBe(401);

    const changeRes = await authCall('/api/auth/password', cookie, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ currentPassword: 'password123', newPassword: 'newpass123' }),
    });
    expect(changeRes.status).toBe(200);
    expect(changeRes.headers.get('Set-Cookie')).toContain('Max-Age=0');

    const oldLogin = await call('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'password123' }),
    });
    expect(oldLogin.status).toBe(401);

    const newLogin = await call('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'newpass123' }),
    });
    expect(newLogin.status).toBe(200);
  });

  it('shares a folder with one key and allows per-file public downloads', async () => {
    const cookie = await setupAndLogin();

    const fileA = new FormData();
    fileA.append('file', new Blob(['alpha'], { type: 'text/plain' }), 'a.txt');
    fileA.append('folderName', 'bundle');
    fileA.append('relativePath', 'bundle/a.txt');
    fileA.append('folderId', 'bundle-1');
    await authCall('/api/files/upload', cookie, { method: 'POST', body: fileA });

    const fileB = new FormData();
    fileB.append('file', new Blob(['beta'], { type: 'text/plain' }), 'b.txt');
    fileB.append('folderName', 'bundle');
    fileB.append('relativePath', 'bundle/sub/b.txt');
    fileB.append('folderId', 'bundle-1');
    await authCall('/api/files/upload', cookie, { method: 'POST', body: fileB });

    const shareRes = await authCall('/api/folders/share', cookie, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ folderId: 'bundle-1', folderName: 'bundle' }),
    });
    expect(shareRes.status).toBe(200);
    const shareData = await shareRes.json();
    expect(shareData.shareKey).toBeTruthy();
    expect(shareData.fileCount).toBe(2);

    const lookupRes = await call(`/api/share?key=${shareData.shareKey}`);
    expect(lookupRes.status).toBe(200);
    const lookupData = await lookupRes.json();
    expect(lookupData.type).toBe('folder');
    expect(lookupData.folderName).toBe('bundle');
    expect(lookupData.files).toHaveLength(2);

    const targetFile = lookupData.files.find(file => file.relative_path === 'bundle/sub/b.txt');
    expect(targetFile).toBeTruthy();

    const dlRes = await call(`/api/share/download?key=${shareData.shareKey}&id=${targetFile.id}`);
    expect(dlRes.status).toBe(200);
    expect(await dlRes.text()).toBe('beta');

    const unshareRes = await authCall('/api/folders/unshare', cookie, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ folderId: 'bundle-1', folderName: 'bundle' }),
    });
    expect(unshareRes.status).toBe(200);

    const afterUnshare = await call(`/api/share?key=${shareData.shareKey}`);
    expect(afterUnshare.status).toBe(404);
  });

  it('usage stats and limits management', async () => {
    const cookie = await setupAndLogin();

    const usageRes = await authCall('/api/usage', cookie);
    const usage = await usageRes.json();
    expect(usageRes.status).toBe(200);
    expect(usage.limits).toBeTruthy();
    expect(usage.daily).toBeTruthy();
    expect(usage.monthly).toBeTruthy();

    // Update limits
    const updateRes = await authCall('/api/usage/limits', cookie, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ daily_d1_reads: 50000 }),
    });
    expect((await updateRes.json()).ok).toBe(true);

    // Verify
    const statsRes = await authCall('/api/usage', cookie);
    const stats = await statsRes.json();
    expect(stats.limits.daily_d1_reads).toBe(50000);
  });

  it('serves frontend HTML at root', async () => {
    const res = await call('/');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('CloudflareShare');
  });

  it('logout clears session', async () => {
    const cookie = await setupAndLogin();
    const res = await authCall('/api/auth/logout', cookie, { method: 'POST' });
    expect(res.status).toBe(200);
    expect(res.headers.get('Set-Cookie')).toContain('Max-Age=0');
  });
});
