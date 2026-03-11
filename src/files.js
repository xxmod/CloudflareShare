import { json, error, generateUUID, generateToken } from './utils.js';
import { trackUsage, checkLimits, updateStorageUsage } from './usage.js';

const DIRECT_UPLOAD_EXPIRES_SECONDS = 900;

export async function handleDirectUploadInit(request, env) {
  const config = getDirectUploadConfig(env);
  if (!config) return error('Direct upload is not configured', 503);

  const { filename, size, contentType, folderName, relativePath, folderId } = await request.json();
  if (!filename || typeof filename !== 'string') return error('Filename is required');

  const normalizedRelativePath = normalizeRelativePath(relativePath);
  const normalizedFolderName = normalizeFolderName(folderName);
  const normalizedFolderId = normalizeFolderId(folderId);
  const storedName = normalizedRelativePath ? normalizedRelativePath.split('/').pop() : sanitizeFilename(filename);
  const numericSize = Number.parseInt(size, 10);
  const safeSize = Number.isFinite(numericSize) && numericSize >= 0 ? numericSize : 0;
  const safeContentType = typeof contentType === 'string' && contentType.trim() ? contentType.trim() : 'application/octet-stream';

  const id = generateUUID();
  const r2Key = `files/${id}/${normalizedRelativePath || storedName}`;
  const uploadUrl = await createPresignedPutUrl({
    ...config,
    key: r2Key,
    expiresIn: DIRECT_UPLOAD_EXPIRES_SECONDS,
  });

  return json({
    id,
    uploadUrl,
    expiresIn: DIRECT_UPLOAD_EXPIRES_SECONDS,
    r2Key,
    filename: storedName,
    size: safeSize,
    contentType: safeContentType,
    folderName: normalizedFolderName,
    relativePath: normalizedRelativePath,
    folderId: normalizedFolderId,
  });
}

export async function handleDirectUploadComplete(request, env) {
  const { id, r2Key, filename, size, contentType, folderName, relativePath, folderId } = await request.json();
  if (!id || !r2Key || !filename) return error('Incomplete upload metadata');

  const existing = await env.DB.prepare('SELECT id FROM files WHERE id = ?').bind(id).first();
  if (existing) return json({ ok: true, id, filename, size, folderName, relativePath, folderId });

  const object = await env.BUCKET.head(r2Key);
  if (!object) return error('Uploaded object not found', 404);

  const numericSize = Number.parseInt(size, 10);
  const safeSize = Number.isFinite(numericSize) && numericSize >= 0 ? numericSize : object.size;
  if (object.size !== safeSize) return error('Uploaded object size mismatch', 409);

  const safeContentType = typeof contentType === 'string' && contentType.trim()
    ? contentType.trim()
    : object.httpMetadata?.contentType || 'application/octet-stream';
  const normalizedRelativePath = normalizeRelativePath(relativePath);
  const normalizedFolderName = normalizeFolderName(folderName);
  const normalizedFolderId = normalizeFolderId(folderId);
  const storedName = sanitizeFilename(filename);

  await env.DB.prepare(
    'INSERT INTO files (id, filename, size, content_type, r2_key, folder_name, relative_path, folder_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(
    id,
    storedName,
    safeSize,
    safeContentType,
    r2Key,
    normalizedFolderName,
    normalizedRelativePath,
    normalizedFolderId,
  ).run();

  await trackUsage(env, 'r2_class_a');
  await trackUsage(env, 'd1_write');
  await updateStorageUsage(env);

  return json({ ok: true, id, filename: storedName, size: safeSize, folderName: normalizedFolderName, relativePath: normalizedRelativePath, folderId: normalizedFolderId });
}

export async function handleUpload(request, env) {
  const abortSignal = request.signal;
  let requestAborted = abortSignal?.aborted === true;
  const onAbort = () => {
    requestAborted = true;
  };
  abortSignal?.addEventListener('abort', onAbort, { once: true });

  // Check limits
  const r2Check = await checkLimits(env, 'r2_class_a');
  if (!r2Check.allowed) return error(r2Check.reason, 429);
  const d1Check = await checkLimits(env, 'd1_write');
  if (!d1Check.allowed) return error(d1Check.reason, 429);

  const upload = await parseUploadRequest(request);
  if (!upload) return error('No file provided');

  const { body, size, contentType, relativePath, folderName, folderId, storedName } = upload;

  // Check storage limit
  const storageCheck = await checkLimits(env, 'r2_storage');
  if (!storageCheck.allowed) return error(storageCheck.reason, 429);

  const id = generateUUID();
  const r2Key = `files/${id}/${relativePath || storedName}`;

  try {
    if (requestAborted) return error('Upload canceled', 499);

    await env.BUCKET.put(r2Key, body, {
      httpMetadata: { contentType },
      customMetadata: {
        originalName: storedName,
        relativePath: relativePath || storedName,
        folderName: folderName || '',
      },
    });

    if (requestAborted) {
      await env.BUCKET.delete(r2Key);
      return error('Upload canceled', 499);
    }

    await env.DB.prepare(
      'INSERT INTO files (id, filename, size, content_type, r2_key, folder_name, relative_path, folder_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(
      id,
      storedName,
      size,
      contentType,
      r2Key,
      folderName,
      relativePath,
      folderId,
    ).run();

    if (requestAborted) {
      await env.BUCKET.delete(r2Key);
      await env.DB.prepare('DELETE FROM files WHERE id = ?').bind(id).run();
      return error('Upload canceled', 499);
    }

    await trackUsage(env, 'r2_class_a');
    await trackUsage(env, 'd1_write');
    await updateStorageUsage(env);

    return json({ id, filename: storedName, size, folderName, relativePath, folderId });
  } finally {
    abortSignal?.removeEventListener('abort', onAbort);
  }
}

export async function handleListFiles(env) {
  const d1Check = await checkLimits(env, 'd1_read');
  if (!d1Check.allowed) return error(d1Check.reason, 429);

  const result = await env.DB.prepare(
    'SELECT id, filename, size, content_type, folder_name, relative_path, folder_id, folder_share_key, share_key, uploaded_at, expires_at, is_note FROM files ORDER BY uploaded_at DESC'
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

export async function handleShare(fileId, request, env) {
  const file = await env.DB.prepare('SELECT * FROM files WHERE id = ?').bind(fileId).first();
  if (!file) return error('File not found', 404);

  let customKey = null;
  try { customKey = (await request.json()).customKey; } catch {}
  const shareKey = validateCustomKey(customKey) || generateToken().substring(0, 16);

  const conflict = await env.DB.prepare('SELECT id FROM files WHERE share_key = ? AND id != ?').bind(shareKey, fileId).first();
  if (conflict) return error('该密钥已被使用，请更换', 409);
  const folderConflict = await env.DB.prepare('SELECT id FROM files WHERE folder_share_key = ? LIMIT 1').bind(shareKey).first();
  if (folderConflict) return error('该密钥已被使用，请更换', 409);

  await env.DB.prepare('UPDATE files SET share_key = ? WHERE id = ?').bind(shareKey, fileId).run();
  await trackUsage(env, 'd1_write');

  return json({
    shareKey,
    shareUrl: `/s/${fileId}`,
    shareKeyUrl: `/s/${fileId}?key=${shareKey}`,
  });
}

function validateCustomKey(key) {
  if (!key || typeof key !== 'string') return null;
  const trimmed = key.trim();
  if (trimmed.length < 2 || trimmed.length > 64) return null;
  if (!/^[a-zA-Z0-9_\-]+$/.test(trimmed)) return null;
  return trimmed;
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
    if (!file.share_key && !file.folder_share_key) return error('File is not shared', 403);
    if (file.share_key !== key && file.folder_share_key !== key) return error('Invalid share key', 403);
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

// --- Batch operations ---

export async function handleBatchDelete(ids, env) {
  if (!Array.isArray(ids) || ids.length === 0) return error('No files specified');
  let deleted = 0;
  for (const id of ids) {
    const file = await env.DB.prepare('SELECT * FROM files WHERE id = ?').bind(id).first();
    if (!file) continue;
    await env.BUCKET.delete(file.r2_key);
    await env.DB.prepare('DELETE FROM files WHERE id = ?').bind(id).run();
    await trackUsage(env, 'r2_class_a');
    await trackUsage(env, 'd1_write');
    deleted++;
  }
  await updateStorageUsage(env);
  return json({ deleted });
}

export async function handleBatchShare(ids, customKey, env) {
  if (!Array.isArray(ids) || ids.length === 0) return error('No files specified');
  let shared = 0;
  for (const id of ids) {
    const file = await env.DB.prepare('SELECT id FROM files WHERE id = ?').bind(id).first();
    if (!file) continue;
    const shareKey = validateCustomKey(customKey) || generateToken().substring(0, 16);
    await env.DB.prepare('UPDATE files SET share_key = ? WHERE id = ?').bind(shareKey, id).run();
    await trackUsage(env, 'd1_write');
    shared++;
  }
  return json({ shared });
}

export async function handleShareFolder(folder, env) {
  const files = await getFolderFiles(folder, env);
  if (!files.length) return error('Folder not found', 404);

  const shareKey = validateCustomKey(folder.customKey) || generateToken().substring(0, 16);

  const conflict = await env.DB.prepare('SELECT id FROM files WHERE share_key = ? LIMIT 1').bind(shareKey).first();
  if (conflict) return error('该密钥已被使用，请更换', 409);
  const folderConflict = await env.DB.prepare('SELECT id FROM files WHERE folder_share_key = ? AND (folder_id != ? OR folder_id IS NULL) LIMIT 1').bind(shareKey, folder.folderId || '').first();
  if (folderConflict) return error('该密钥已被使用，请更换', 409);

  await updateFolderShareKey(folder, shareKey, env);
  await trackUsage(env, 'd1_write');

  return json({ shareKey, folderName: files[0].folder_name, fileCount: files.length });
}

export async function handleUnshareFolder(folder, env) {
  const files = await getFolderFiles(folder, env);
  if (!files.length) return error('Folder not found', 404);

  await updateFolderShareKey(folder, null, env);
  await trackUsage(env, 'd1_write');
  return json({ ok: true, fileCount: files.length });
}

export async function handleBatchUnshare(ids, env) {
  if (!Array.isArray(ids) || ids.length === 0) return error('No files specified');
  let unshared = 0;
  for (const id of ids) {
    await env.DB.prepare('UPDATE files SET share_key = NULL WHERE id = ?').bind(id).run();
    await trackUsage(env, 'd1_write');
    unshared++;
  }
  return json({ unshared });
}

// --- Public key-based access ---

export async function handleGetByShareKey(key, env) {
  if (!key) return error('Key required');
  const d1Check = await checkLimits(env, 'd1_read');
  if (!d1Check.allowed) return error(d1Check.reason, 429);

  const folderFilesResult = await env.DB.prepare(
    'SELECT id, filename, size, content_type, folder_name, relative_path, folder_id FROM files WHERE folder_share_key = ? ORDER BY relative_path ASC, filename ASC'
  ).bind(key).all();
  if (folderFilesResult.results.length) {
    await trackUsage(env, 'd1_read');
    return json({
      type: 'folder',
      folderName: folderFilesResult.results[0].folder_name,
      folderId: folderFilesResult.results[0].folder_id,
      files: folderFilesResult.results,
    });
  }

  const file = await env.DB.prepare(
    'SELECT id, filename, size, content_type, is_note FROM files WHERE share_key = ?'
  ).bind(key).first();
  if (!file) return error('Invalid key', 404);
  await trackUsage(env, 'd1_read');
  return json({ type: 'file', ...file });
}

export async function handleDownloadByShareKey(key, env, fileId = null) {
  if (!key) return error('Key required');
  const d1Check = await checkLimits(env, 'd1_read');
  if (!d1Check.allowed) return error(d1Check.reason, 429);

  let file;
  if (fileId) {
    file = await env.DB.prepare('SELECT * FROM files WHERE id = ? AND folder_share_key = ?').bind(fileId, key).first();
  } else {
    file = await env.DB.prepare('SELECT * FROM files WHERE share_key = ?').bind(key).first();
  }
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
  const file = await env.DB.prepare('SELECT id, filename, size, content_type, is_note FROM files WHERE id = ? AND share_key = ?').bind(fileId, key).first();
  if (!file) return error('File not found or invalid key', 404);
  await trackUsage(env, 'd1_read');
  return json(file);
}

export async function handleCreateNote(request, env) {
  const { title, content } = await request.json();
  if (!title || typeof title !== 'string' || !title.trim()) return error('标题不能为空');
  if (typeof content !== 'string') return error('笔记内容不能为空');

  const r2Check = await checkLimits(env, 'r2_class_a');
  if (!r2Check.allowed) return error(r2Check.reason, 429);
  const d1Check = await checkLimits(env, 'd1_write');
  if (!d1Check.allowed) return error(d1Check.reason, 429);
  const storageCheck = await checkLimits(env, 'r2_storage');
  if (!storageCheck.allowed) return error(storageCheck.reason, 429);

  const safeTitle = sanitizeFilename(title.trim()) || '未命名笔记';
  const body = new TextEncoder().encode(content);
  const id = generateUUID();
  const r2Key = `notes/${id}/${safeTitle}`;

  await env.BUCKET.put(r2Key, body, {
    httpMetadata: { contentType: 'text/plain; charset=utf-8' },
    customMetadata: {
      originalName: safeTitle,
      isNote: '1',
    },
  });

  await env.DB.prepare(
    'INSERT INTO files (id, filename, size, content_type, r2_key, is_note) VALUES (?, ?, ?, ?, ?, 1)'
  ).bind(id, safeTitle, body.byteLength, 'text/plain; charset=utf-8', r2Key).run();

  await trackUsage(env, 'r2_class_a');
  await trackUsage(env, 'd1_write');
  await updateStorageUsage(env);

  return json({ ok: true, id, filename: safeTitle, size: body.byteLength, is_note: 1 });
}

export async function handleGetNoteContent(fileId, env, isPublic = false, key = null) {
  const d1Check = await checkLimits(env, 'd1_read');
  if (!d1Check.allowed) return error(d1Check.reason, 429);

  const file = await env.DB.prepare('SELECT * FROM files WHERE id = ?').bind(fileId).first();
  if (!file) return error('File not found', 404);
  if (!file.is_note) return error('该文件不是笔记', 400);

  if (isPublic) {
    if (!file.share_key && !file.folder_share_key) return error('File is not shared', 403);
    if (file.share_key !== key && file.folder_share_key !== key) return error('Invalid share key', 403);
  }

  const r2Check = await checkLimits(env, 'r2_class_b');
  if (!r2Check.allowed) return error(r2Check.reason, 429);
  const object = await env.BUCKET.get(file.r2_key);
  if (!object) return error('File not found in storage', 404);

  await trackUsage(env, 'd1_read');
  await trackUsage(env, 'r2_class_b');

  return json({
    id: file.id,
    filename: file.filename,
    content: await object.text(),
    is_note: 1,
  });
}

function normalizeRelativePath(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  return trimmed || null;
}

function normalizeFolderName(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '').split('/')[0];
  return trimmed || null;
}

function normalizeFolderId(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

async function parseUploadRequest(request) {
  const transport = request.headers.get('X-Upload-Transport');
  if (transport === 'raw') {
    const filename = decodeUploadHeader(request.headers.get('X-File-Name'));
    if (!filename || !request.body) return null;

    const relativePath = normalizeRelativePath(decodeUploadHeader(request.headers.get('X-Relative-Path')));
    const folderName = normalizeFolderName(decodeUploadHeader(request.headers.get('X-Folder-Name')));
    const folderId = normalizeFolderId(decodeUploadHeader(request.headers.get('X-Folder-Id')));
    const storedName = relativePath ? relativePath.split('/').pop() : filename;
    const declaredSize = Number.parseInt(request.headers.get('X-File-Size') || '0', 10);

    return {
      body: request.body,
      size: Number.isFinite(declaredSize) && declaredSize >= 0 ? declaredSize : 0,
      contentType: request.headers.get('Content-Type') || 'application/octet-stream',
      relativePath,
      folderName,
      folderId,
      storedName,
    };
  }

  const formData = await request.formData();
  const file = formData.get('file');
  if (!file) return null;

  const relativePath = normalizeRelativePath(formData.get('relativePath'));
  const folderName = normalizeFolderName(formData.get('folderName'));
  const folderId = normalizeFolderId(formData.get('folderId'));
  const storedName = relativePath ? relativePath.split('/').pop() : file.name;

  return {
    body: file.stream(),
    size: file.size,
    contentType: file.type || 'application/octet-stream',
    relativePath,
    folderName,
    folderId,
    storedName,
  };
}

function decodeUploadHeader(value) {
  if (typeof value !== 'string' || !value) return null;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

async function getFolderFiles(folder, env) {
  if (folder?.folderId) {
    const result = await env.DB.prepare(
      'SELECT id, folder_name, folder_id FROM files WHERE folder_id = ? ORDER BY relative_path ASC, filename ASC'
    ).bind(folder.folderId).all();
    return result.results;
  }

  if (folder?.folderName) {
    const result = await env.DB.prepare(
      'SELECT id, folder_name, folder_id FROM files WHERE folder_name = ? AND folder_id IS NULL ORDER BY relative_path ASC, filename ASC'
    ).bind(folder.folderName).all();
    return result.results;
  }

  return [];
}

async function updateFolderShareKey(folder, shareKey, env) {
  if (folder?.folderId) {
    await env.DB.prepare('UPDATE files SET folder_share_key = ? WHERE folder_id = ?').bind(shareKey, folder.folderId).run();
    return;
  }

  if (folder?.folderName) {
    await env.DB.prepare('UPDATE files SET folder_share_key = ? WHERE folder_name = ? AND folder_id IS NULL').bind(shareKey, folder.folderName).run();
  }
}

function getDirectUploadConfig(env) {
  if (!env.R2_ACCOUNT_ID || !env.R2_BUCKET_NAME || !env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY) {
    return null;
  }

  return {
    accountId: env.R2_ACCOUNT_ID,
    bucketName: env.R2_BUCKET_NAME,
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
  };
}

async function createPresignedPutUrl({ accountId, bucketName, accessKeyId, secretAccessKey, key, expiresIn }) {
  const now = new Date();
  const amzDate = toAmzDate(now);
  const shortDate = amzDate.slice(0, 8);
  const host = `${bucketName}.${accountId}.r2.cloudflarestorage.com`;
  const canonicalUri = '/' + encodeR2Key(key);
  const credentialScope = `${shortDate}/auto/s3/aws4_request`;

  const query = new URLSearchParams({
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Content-Sha256': 'UNSIGNED-PAYLOAD',
    'X-Amz-Credential': `${accessKeyId}/${credentialScope}`,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': String(expiresIn),
    'X-Amz-SignedHeaders': 'host',
    'x-id': 'PutObject',
  });

  const canonicalQuery = toCanonicalQuery(query);
  const canonicalRequest = [
    'PUT',
    canonicalUri,
    canonicalQuery,
    `host:${host}`,
    '',
    'host',
    'UNSIGNED-PAYLOAD',
  ].join('\n');

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    await sha256Hex(canonicalRequest),
  ].join('\n');

  const signingKey = await getSignatureKey(secretAccessKey, shortDate, 'auto', 's3');
  const signature = await hmacHex(signingKey, stringToSign);
  query.set('X-Amz-Signature', signature);

  return `https://${host}${canonicalUri}?${toCanonicalQuery(query)}`;
}

function sanitizeFilename(filename) {
  return String(filename || 'file').split('/').pop().split('\\').pop() || 'file';
}

function encodeR2Key(key) {
  return key.split('/').map(segment => encodeURIComponent(segment)).join('/');
}

function toAmzDate(date) {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, '');
}

function toCanonicalQuery(params) {
  return [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
}

async function sha256Hex(value) {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value;
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return toHex(hash);
}

async function hmac(key, value) {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    typeof key === 'string' ? new TextEncoder().encode(key) : key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  return crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(value));
}

async function hmacHex(key, value) {
  return toHex(await hmac(key, value));
}

async function getSignatureKey(secretAccessKey, shortDate, region, service) {
  const kDate = await hmac(`AWS4${secretAccessKey}`, shortDate);
  const kRegion = await hmac(kDate, region);
  const kService = await hmac(kRegion, service);
  return hmac(kService, 'aws4_request');
}

function toHex(buffer) {
  return Array.from(new Uint8Array(buffer), byte => byte.toString(16).padStart(2, '0')).join('');
}

// --- File/folder management ---

export async function handleRenameFile(fileId, request, env) {
  const { newName } = await request.json();
  if (!newName || typeof newName !== 'string' || !newName.trim()) return error('新文件名不能为空');
  const safeName = sanitizeFilename(newName.trim());
  const file = await env.DB.prepare('SELECT * FROM files WHERE id = ?').bind(fileId).first();
  if (!file) return error('File not found', 404);

  let newRelativePath = file.relative_path;
  if (file.relative_path) {
    const parts = file.relative_path.split('/');
    parts[parts.length - 1] = safeName;
    newRelativePath = parts.join('/');
  }

  await env.DB.prepare('UPDATE files SET filename = ?, relative_path = ? WHERE id = ?')
    .bind(safeName, newRelativePath, fileId).run();
  await trackUsage(env, 'd1_write');
  return json({ ok: true, filename: safeName });
}

export async function handleRenameFolder(request, env) {
  const { folderId, folderName, newName } = await request.json();
  if (!newName || typeof newName !== 'string' || !newName.trim()) return error('新文件夹名不能为空');
  const safeName = newName.trim().replace(/[\/]/g, '');
  if (!safeName) return error('文件夹名无效');

  const files = await getFolderFiles({ folderId, folderName }, env);
  if (!files.length) return error('Folder not found', 404);

  const oldName = files[0].folder_name;

  if (folderId) {
    await env.DB.prepare('UPDATE files SET folder_name = ? WHERE folder_id = ?')
      .bind(safeName, folderId).run();
    // Update relative_path: replace old folder prefix with new name
    const allFiles = await env.DB.prepare('SELECT id, relative_path FROM files WHERE folder_id = ?').bind(folderId).all();
    for (const f of allFiles.results) {
      if (f.relative_path && f.relative_path.startsWith(oldName + '/')) {
        const newPath = safeName + f.relative_path.slice(oldName.length);
        await env.DB.prepare('UPDATE files SET relative_path = ? WHERE id = ?').bind(newPath, f.id).run();
      }
    }
  } else if (folderName) {
    await env.DB.prepare('UPDATE files SET folder_name = ? WHERE folder_name = ? AND folder_id IS NULL')
      .bind(safeName, folderName).run();
    const allFiles = await env.DB.prepare('SELECT id, relative_path FROM files WHERE folder_name = ? AND folder_id IS NULL').bind(safeName).all();
    for (const f of allFiles.results) {
      if (f.relative_path && f.relative_path.startsWith(oldName + '/')) {
        const newPath = safeName + f.relative_path.slice(oldName.length);
        await env.DB.prepare('UPDATE files SET relative_path = ? WHERE id = ?').bind(newPath, f.id).run();
      }
    }
  }

  await trackUsage(env, 'd1_write');
  return json({ ok: true, newName: safeName });
}

export async function handleCreateFolder(request, env) {
  const { name } = await request.json();
  if (!name || typeof name !== 'string' || !name.trim()) return error('文件夹名不能为空');
  const safeName = name.trim().replace(/[\/]/g, '');
  if (!safeName) return error('文件夹名无效');
  const folderId = generateUUID();
  // Create a placeholder entry so the folder shows up even if empty
  // We use a special zero-size marker file
  const markerId = generateUUID();
  const r2Key = `folders/${folderId}/.folder`;
  await env.BUCKET.put(r2Key, '', { httpMetadata: { contentType: 'application/x-folder' } });
  await env.DB.prepare(
    'INSERT INTO files (id, filename, size, content_type, r2_key, folder_name, relative_path, folder_id) VALUES (?, ?, 0, ?, ?, ?, ?, ?)'
  ).bind(markerId, '.folder', 'application/x-folder', r2Key, safeName, safeName + '/.folder', folderId).run();
  await trackUsage(env, 'd1_write');
  await trackUsage(env, 'r2_class_a');
  return json({ ok: true, folderId, name: safeName });
}

export async function handleMoveToFolder(request, env) {
  const { fileIds, targetFolderId, targetFolderName } = await request.json();
  if (!Array.isArray(fileIds) || !fileIds.length) return error('未选择文件');

  let folderId = targetFolderId || null;
  let folderName = targetFolderName || null;

  if (folderId) {
    // Verify folder exists
    const folderFile = await env.DB.prepare('SELECT folder_name, folder_id FROM files WHERE folder_id = ? LIMIT 1').bind(folderId).first();
    if (!folderFile) return error('目标文件夹不存在', 404);
    folderName = folderFile.folder_name;
  }

  if (!folderId && !folderName) return error('请指定目标文件夹');

  let moved = 0;
  for (const id of fileIds) {
    const file = await env.DB.prepare('SELECT id, filename FROM files WHERE id = ?').bind(id).first();
    if (!file) continue;
    const newRelativePath = folderName + '/' + file.filename;
    await env.DB.prepare('UPDATE files SET folder_name = ?, folder_id = ?, relative_path = ? WHERE id = ?')
      .bind(folderName, folderId, newRelativePath, id).run();
    moved++;
  }
  await trackUsage(env, 'd1_write');
  return json({ ok: true, moved });
}

export async function handleRemoveFromFolder(request, env) {
  const { fileIds } = await request.json();
  if (!Array.isArray(fileIds) || !fileIds.length) return error('未选择文件');
  let moved = 0;
  for (const id of fileIds) {
    const file = await env.DB.prepare('SELECT id, filename FROM files WHERE id = ?').bind(id).first();
    if (!file) continue;
    await env.DB.prepare('UPDATE files SET folder_name = NULL, folder_id = NULL, relative_path = NULL, folder_share_key = NULL WHERE id = ?')
      .bind(id).run();
    moved++;
  }
  await trackUsage(env, 'd1_write');
  return json({ ok: true, moved });
}
