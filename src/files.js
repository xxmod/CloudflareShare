import { json, error, generateUUID, generateToken } from './utils.js';
import { trackUsage, checkLimits, updateStorageUsage } from './usage.js';

export async function handleUpload(request, env) {
  // Check limits
  const r2Check = await checkLimits(env, 'r2_class_a');
  if (!r2Check.allowed) return error(r2Check.reason, 429);
  const d1Check = await checkLimits(env, 'd1_write');
  if (!d1Check.allowed) return error(d1Check.reason, 429);

  const formData = await request.formData();
  const file = formData.get('file');
  if (!file) return error('No file provided');

  // Check storage limit
  const storageCheck = await checkLimits(env, 'r2_storage');
  if (!storageCheck.allowed) return error(storageCheck.reason, 429);

  const id = generateUUID();
  const r2Key = `files/${id}/${file.name}`;

  // Upload to R2
  await env.BUCKET.put(r2Key, file.stream(), {
    httpMetadata: { contentType: file.type || 'application/octet-stream' },
    customMetadata: { originalName: file.name },
  });

  // Save metadata to D1
  await env.DB.prepare(
    'INSERT INTO files (id, filename, size, content_type, r2_key) VALUES (?, ?, ?, ?, ?)'
  ).bind(id, file.name, file.size, file.type || 'application/octet-stream', r2Key).run();

  // Track usage
  await trackUsage(env, 'r2_class_a');
  await trackUsage(env, 'd1_write');
  await updateStorageUsage(env);

  return json({ id, filename: file.name, size: file.size });
}

export async function handleListFiles(env) {
  const d1Check = await checkLimits(env, 'd1_read');
  if (!d1Check.allowed) return error(d1Check.reason, 429);

  const result = await env.DB.prepare(
    'SELECT id, filename, size, content_type, share_key, uploaded_at, expires_at FROM files ORDER BY uploaded_at DESC'
  ).all();

  await trackUsage(env, 'd1_read');
  return json(result.results);
}

export async function handleDeleteFile(fileId, env) {
  const file = await env.DB.prepare('SELECT * FROM files WHERE id = ?').bind(fileId).first();
  if (!file) return error('File not found', 404);

  await env.BUCKET.delete(file.r2_key);
  await env.DB.prepare('DELETE FROM files WHERE id = ?').bind(fileId).run();

  await trackUsage(env, 'r2_class_a');
  await trackUsage(env, 'd1_write');
  await updateStorageUsage(env);

  return json({ ok: true });
}

export async function handleShare(fileId, env) {
  const file = await env.DB.prepare('SELECT * FROM files WHERE id = ?').bind(fileId).first();
  if (!file) return error('File not found', 404);

  const shareKey = generateToken().substring(0, 16);
  await env.DB.prepare('UPDATE files SET share_key = ? WHERE id = ?').bind(shareKey, fileId).run();
  await trackUsage(env, 'd1_write');

  return json({
    shareKey,
    shareUrl: `/s/${fileId}`,
    shareKeyUrl: `/s/${fileId}?key=${shareKey}`,
  });
}

export async function handleUnshare(fileId, env) {
  await env.DB.prepare('UPDATE files SET share_key = NULL WHERE id = ?').bind(fileId).run();
  await trackUsage(env, 'd1_write');
  return json({ ok: true });
}

export async function handleDownload(fileId, env, isPublic = false, key = null) {
  const d1Check = await checkLimits(env, 'd1_read');
  if (!d1Check.allowed) return error(d1Check.reason, 429);

  const file = await env.DB.prepare('SELECT * FROM files WHERE id = ?').bind(fileId).first();
  if (!file) return error('File not found', 404);

  if (isPublic) {
    if (!file.share_key) return error('File is not shared', 403);
    if (file.share_key !== key) return error('Invalid share key', 403);
  }

  const r2Check = await checkLimits(env, 'r2_class_b');
  if (!r2Check.allowed) return error(r2Check.reason, 429);

  const object = await env.BUCKET.get(file.r2_key);
  if (!object) return error('File not found in storage', 404);

  await trackUsage(env, 'd1_read');
  await trackUsage(env, 'r2_class_b');

  const headers = new Headers();
  headers.set('Content-Type', file.content_type);
  headers.set('Content-Disposition', `attachment; filename="${encodeURIComponent(file.filename)}"`);
  headers.set('Content-Length', file.size.toString());

  return new Response(object.body, { headers });
}

// --- Public key-based access ---

export async function handleGetByShareKey(key, env) {
  if (!key) return error('Key required');
  const d1Check = await checkLimits(env, 'd1_read');
  if (!d1Check.allowed) return error(d1Check.reason, 429);
  const file = await env.DB.prepare(
    'SELECT id, filename, size, content_type FROM files WHERE share_key = ?'
  ).bind(key).first();
  if (!file) return error('Invalid key', 404);
  await trackUsage(env, 'd1_read');
  return json(file);
}

export async function handleDownloadByShareKey(key, env) {
  if (!key) return error('Key required');
  const d1Check = await checkLimits(env, 'd1_read');
  if (!d1Check.allowed) return error(d1Check.reason, 429);
  const file = await env.DB.prepare('SELECT * FROM files WHERE share_key = ?').bind(key).first();
  if (!file) return error('Invalid key', 404);
  const r2Check = await checkLimits(env, 'r2_class_b');
  if (!r2Check.allowed) return error(r2Check.reason, 429);
  const object = await env.BUCKET.get(file.r2_key);
  if (!object) return error('File not found in storage', 404);
  await trackUsage(env, 'd1_read');
  await trackUsage(env, 'r2_class_b');
  const headers = new Headers();
  headers.set('Content-Type', file.content_type);
  headers.set('Content-Disposition', `attachment; filename="${encodeURIComponent(file.filename)}"`);
  headers.set('Content-Length', file.size.toString());
  return new Response(object.body, { headers });
}

export async function handlePublicView(fileId, env, key) {
  const file = await env.DB.prepare('SELECT id, filename, size, content_type FROM files WHERE id = ? AND share_key = ?').bind(fileId, key).first();
  if (!file) return error('File not found or invalid key', 404);
  await trackUsage(env, 'd1_read');
  return json(file);
}
