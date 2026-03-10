import { json, error, generateUUID, generateToken } from './utils.js';
import { trackUsage, checkLimits, updateStorageUsage } from './usage.js';

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

  const formData = await request.formData();
  const file = formData.get('file');
  if (!file) return error('No file provided');

  const relativePath = normalizeRelativePath(formData.get('relativePath'));
  const folderName = normalizeFolderName(formData.get('folderName'));
  const folderId = normalizeFolderId(formData.get('folderId'));
  const storedName = relativePath ? relativePath.split('/').pop() : file.name;

  // Check storage limit
  const storageCheck = await checkLimits(env, 'r2_storage');
  if (!storageCheck.allowed) return error(storageCheck.reason, 429);

  const id = generateUUID();
  const r2Key = `files/${id}/${relativePath || storedName}`;

  try {
    if (requestAborted) return error('Upload canceled', 499);

    await env.BUCKET.put(r2Key, file.stream(), {
      httpMetadata: { contentType: file.type || 'application/octet-stream' },
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
      file.size,
      file.type || 'application/octet-stream',
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

    return json({ id, filename: storedName, size: file.size, folderName, relativePath, folderId });
  } finally {
    abortSignal?.removeEventListener('abort', onAbort);
  }
}

export async function handleListFiles(env) {
  const d1Check = await checkLimits(env, 'd1_read');
  if (!d1Check.allowed) return error(d1Check.reason, 429);

  const result = await env.DB.prepare(
    'SELECT id, filename, size, content_type, folder_name, relative_path, folder_id, folder_share_key, share_key, uploaded_at, expires_at FROM files ORDER BY uploaded_at DESC'
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

export async function handleBatchShare(ids, env) {
  if (!Array.isArray(ids) || ids.length === 0) return error('No files specified');
  let shared = 0;
  for (const id of ids) {
    const file = await env.DB.prepare('SELECT id FROM files WHERE id = ?').bind(id).first();
    if (!file) continue;
    const shareKey = generateToken().substring(0, 16);
    await env.DB.prepare('UPDATE files SET share_key = ? WHERE id = ?').bind(shareKey, id).run();
    await trackUsage(env, 'd1_write');
    shared++;
  }
  return json({ shared });
}

export async function handleShareFolder(folder, env) {
  const files = await getFolderFiles(folder, env);
  if (!files.length) return error('Folder not found', 404);

  const shareKey = generateToken().substring(0, 16);
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
    'SELECT id, filename, size, content_type FROM files WHERE share_key = ?'
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
  const file = await env.DB.prepare('SELECT id, filename, size, content_type FROM files WHERE id = ? AND share_key = ?').bind(fileId, key).first();
  if (!file) return error('File not found or invalid key', 404);
  await trackUsage(env, 'd1_read');
  return json(file);
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
