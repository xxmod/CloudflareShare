import { today, currentMonth } from './utils.js';

export async function trackUsage(env, type, amount = 1) {
  const d = today();
  // Ensure row exists
  await env.DB.prepare(
    'INSERT OR IGNORE INTO usage_log (date) VALUES (?)'
  ).bind(d).run();

  const colMap = {
    d1_read: 'd1_reads',
    d1_write: 'd1_writes',
    r2_class_a: 'r2_class_a',
    r2_class_b: 'r2_class_b',
    r2_storage: 'r2_storage_bytes',
  };

  const col = colMap[type];
  if (!col) return;

  if (type === 'r2_storage') {
    // Storage is set absolutely, not incremented
    await env.DB.prepare(
      `UPDATE usage_log SET ${col} = ? WHERE date = ?`
    ).bind(amount, d).run();
  } else {
    await env.DB.prepare(
      `UPDATE usage_log SET ${col} = ${col} + ? WHERE date = ?`
    ).bind(amount, d).run();
  }
}

export async function checkLimits(env, type) {
  const d = today();
  const month = currentMonth();
  const limits = await env.DB.prepare('SELECT * FROM usage_limits WHERE id = 1').first();
  if (!limits) return { allowed: true };

  const dailyUsage = await env.DB.prepare('SELECT * FROM usage_log WHERE date = ?').bind(d).first();
  const monthlyResult = await env.DB.prepare(
    `SELECT SUM(d1_reads) as d1_reads, SUM(d1_writes) as d1_writes,
            SUM(r2_class_a) as r2_class_a, SUM(r2_class_b) as r2_class_b,
            MAX(r2_storage_bytes) as r2_storage_bytes
     FROM usage_log WHERE date LIKE ? || '%'`
  ).bind(month).first();

  const checks = {
    d1_read: {
      daily: (dailyUsage?.d1_reads || 0) < limits.daily_d1_reads,
      monthly: (monthlyResult?.d1_reads || 0) < limits.monthly_d1_reads,
    },
    d1_write: {
      daily: (dailyUsage?.d1_writes || 0) < limits.daily_d1_writes,
      monthly: (monthlyResult?.d1_writes || 0) < limits.monthly_d1_writes,
    },
    r2_class_a: {
      daily: (dailyUsage?.r2_class_a || 0) < limits.daily_r2_class_a,
      monthly: (monthlyResult?.r2_class_a || 0) < limits.monthly_r2_class_a,
    },
    r2_class_b: {
      daily: (dailyUsage?.r2_class_b || 0) < limits.daily_r2_class_b,
      monthly: (monthlyResult?.r2_class_b || 0) < limits.monthly_r2_class_b,
    },
    r2_storage: {
      daily: true,
      monthly: (monthlyResult?.r2_storage_bytes || 0) < limits.r2_storage_limit_bytes,
    },
  };

  const check = checks[type];
  if (!check) return { allowed: true };

  if (!check.daily) return { allowed: false, reason: `Daily ${type} limit reached` };
  if (!check.monthly) return { allowed: false, reason: `Monthly ${type} limit reached` };
  return { allowed: true };
}

export async function getUsageStats(env) {
  const d = today();
  const month = currentMonth();

  const limits = await env.DB.prepare('SELECT * FROM usage_limits WHERE id = 1').first();
  const dailyUsage = await env.DB.prepare('SELECT * FROM usage_log WHERE date = ?').bind(d).first();
  const monthlyResult = await env.DB.prepare(
    `SELECT SUM(d1_reads) as d1_reads, SUM(d1_writes) as d1_writes,
            SUM(r2_class_a) as r2_class_a, SUM(r2_class_b) as r2_class_b,
            MAX(r2_storage_bytes) as r2_storage_bytes
     FROM usage_log WHERE date LIKE ? || '%'`
  ).bind(month).first();

  return {
    limits,
    daily: {
      date: d,
      d1_reads: dailyUsage?.d1_reads || 0,
      d1_writes: dailyUsage?.d1_writes || 0,
      r2_class_a: dailyUsage?.r2_class_a || 0,
      r2_class_b: dailyUsage?.r2_class_b || 0,
      r2_storage_bytes: dailyUsage?.r2_storage_bytes || 0,
    },
    monthly: {
      month,
      d1_reads: monthlyResult?.d1_reads || 0,
      d1_writes: monthlyResult?.d1_writes || 0,
      r2_class_a: monthlyResult?.r2_class_a || 0,
      r2_class_b: monthlyResult?.r2_class_b || 0,
      r2_storage_bytes: monthlyResult?.r2_storage_bytes || 0,
    },
  };
}

export async function updateLimits(env, newLimits) {
  const fields = [
    'daily_d1_reads', 'daily_d1_writes', 'monthly_d1_reads', 'monthly_d1_writes',
    'daily_r2_class_a', 'daily_r2_class_b', 'monthly_r2_class_a', 'monthly_r2_class_b',
    'r2_storage_limit_bytes',
  ];
  const sets = [];
  const values = [];
  for (const f of fields) {
    if (newLimits[f] !== undefined) {
      sets.push(`${f} = ?`);
      values.push(Number(newLimits[f]));
    }
  }
  if (sets.length === 0) return;
  values.push(1);
  await env.DB.prepare(`UPDATE usage_limits SET ${sets.join(', ')} WHERE id = ?`).bind(...values).run();
}

export async function updateStorageUsage(env) {
  // Calculate total R2 storage from files table
  const result = await env.DB.prepare('SELECT COALESCE(SUM(size), 0) as total FROM files').first();
  await trackUsage(env, 'r2_storage', result.total);
}
