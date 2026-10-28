// PromptOS Privacy-Preserving DLP Audit Logging and Persistence Store
// Stores metadata only. Never persists raw sensitive data, card numbers, Aadhaar, passwords, or extracted text.
// Supports dual storage: attempts Supabase table 'dlp_audit_logs', with automatic fallback to persistent local store.

import fs from 'fs';
import path from 'path';
import { createClient as createSupabaseServerClient } from '@/lib/supabase/server';
import type { AuditLogEntry, ScanResult } from '@/src/lib/dlp/types';

const LOCAL_AUDIT_FILE = path.join(process.cwd(), '.dlp_audit_logs.json');

// In-memory cache for fast lookups and resilient serverless execution
let memoryAuditLogs: AuditLogEntry[] = [];

// Initialize memory cache from local file if present
function loadLocalAuditLogs(): AuditLogEntry[] {
  try {
    if (fs.existsSync(LOCAL_AUDIT_FILE)) {
      const data = fs.readFileSync(LOCAL_AUDIT_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('[DLP Audit Store] Could not read local audit logs file:', err);
  }
  return [];
}

function saveLocalAuditLogs(logs: AuditLogEntry[]) {
  try {
    fs.writeFileSync(LOCAL_AUDIT_FILE, JSON.stringify(logs.slice(-500), null, 2), 'utf-8');
  } catch (err) {
    console.warn('[DLP Audit Store] Could not write to local audit logs file:', err);
  }
}

// Load on first import
memoryAuditLogs = loadLocalAuditLogs();

/**
 * Persists a privacy-preserving audit entry for a completed DLP scan.
 */
export async function recordAuditLog(
  scan: ScanResult,
  user?: { id?: string; email?: string }
): Promise<AuditLogEntry> {
  const categoryCounts: Record<string, number> = {};
  for (const s of scan.summary) {
    categoryCounts[s.type] = s.count;
  }

  const entry: AuditLogEntry = {
    id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    scanId: scan.scanId,
    userId: user?.id,
    userEmail: user?.email ? user.email.replace(/(?<=^.).+(?=@)/, '***') : undefined, // mask email prefix for privacy
    timestamp: scan.timestamp || new Date().toISOString(),
    sourceType: scan.sourceType,
    filename: scan.filename,
    fileType: scan.fileType,
    fileSize: scan.fileSize,
    textLength: scan.textLength,
    totalFindings: scan.findings.length,
    findingCategories: categoryCounts,
    riskScore: scan.risk.score,
    riskLevel: scan.risk.level,
    classification: scan.risk.classification,
    policyDecision: scan.policy.decision,
    policyName: scan.policy.policyName,
    reasons: scan.policy.reasons,
  };

  // 1. Always record in memory cache and local persistent store
  memoryAuditLogs.unshift(entry);
  if (memoryAuditLogs.length > 500) {
    memoryAuditLogs = memoryAuditLogs.slice(0, 500);
  }
  saveLocalAuditLogs(memoryAuditLogs);

  // 2. Best-effort write to Supabase if configured and table exists
  try {
    const supabase = await createSupabaseServerClient();
    await supabase.from('dlp_audit_logs').insert({
      id: entry.id,
      scan_id: entry.scanId,
      user_id: entry.userId || null,
      user_email: entry.userEmail || null,
      source_type: entry.sourceType,
      file_name: entry.filename || null,
      file_type: entry.fileType || null,
      file_size: entry.fileSize || null,
      text_length: entry.textLength,
      total_findings: entry.totalFindings,
      finding_categories: entry.findingCategories,
      risk_score: entry.riskScore,
      risk_level: entry.riskLevel,
      classification: entry.classification,
      policy_decision: entry.policyDecision,
      policy_name: entry.policyName,
      reasons: entry.reasons,
      created_at: entry.timestamp,
    });
  } catch (supabaseErr: any) {
    // Graceful fallback: table might not exist yet before migration.
    // Memory and local file ensure zero disruption.
  }

  return entry;
}

/**
 * Retrieves audit logs with optional filtering, search, and pagination.
 */
export async function getAuditLogs(options?: {
  query?: string;
  decision?: string;
  severity?: string;
  limit?: number;
  offset?: number;
}): Promise<{ logs: AuditLogEntry[]; total: number }> {
  // Reload local file to get multi-process updates
  const allLogs = loadLocalAuditLogs();
  if (allLogs.length > 0) {
    memoryAuditLogs = allLogs;
  }

  let filtered = [...memoryAuditLogs];

  if (options?.query && options.query.trim()) {
    const q = options.query.toLowerCase().trim();
    filtered = filtered.filter(
      (l) =>
        (l.filename && l.filename.toLowerCase().includes(q)) ||
        (l.scanId && l.scanId.toLowerCase().includes(q)) ||
        (l.policyName && l.policyName.toLowerCase().includes(q))
    );
  }

  if (options?.decision && options.decision !== 'ALL') {
    filtered = filtered.filter((l) => l.policyDecision === options.decision);
  }

  if (options?.severity && options.severity !== 'ALL') {
    filtered = filtered.filter((l) => l.riskLevel === options.severity);
  }

  const total = filtered.length;
  const limit = options?.limit || 20;
  const offset = options?.offset || 0;
  const paginated = filtered.slice(offset, offset + limit);

  return { logs: paginated, total };
}

/**
 * Calculates aggregate audit statistics for dashboard metrics cards.
 */
export async function getAuditStats(): Promise<{
  totalScans: number;
  blockedCount: number;
  warnCount: number;
  allowCount: number;
  criticalHighCount: number;
  categoryDistribution: Record<string, number>;
  averageRiskScore: number;
}> {
  const allLogs = loadLocalAuditLogs();
  const logs = allLogs.length > 0 ? allLogs : memoryAuditLogs;

  let blockedCount = 0;
  let warnCount = 0;
  let allowCount = 0;
  let criticalHighCount = 0;
  let totalScore = 0;
  const categoryDistribution: Record<string, number> = {};

  for (const log of logs) {
    if (log.policyDecision === 'BLOCK') blockedCount++;
    else if (log.policyDecision === 'WARN') warnCount++;
    else allowCount++;

    if (log.riskLevel === 'CRITICAL' || log.riskLevel === 'HIGH') {
      criticalHighCount++;
    }

    totalScore += log.riskScore || 0;

    if (log.findingCategories) {
      for (const [cat, count] of Object.entries(log.findingCategories)) {
        categoryDistribution[cat] = (categoryDistribution[cat] || 0) + (count || 0);
      }
    }
  }

  const totalScans = logs.length;
  const averageRiskScore = totalScans > 0 ? Math.round(totalScore / totalScans) : 0;

  return {
    totalScans,
    blockedCount,
    warnCount,
    allowCount,
    criticalHighCount,
    categoryDistribution,
    averageRiskScore,
  };
}
