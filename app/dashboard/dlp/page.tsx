'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  FileText,
  UploadCloud,
  FileCheck,
  AlertTriangle,
  RefreshCw,
  Search,
  Sliders,
  Copy,
  Check,
  Download,
  Eye,
  X,
  ArrowLeft,
  ChevronRight,
  Info,
} from 'lucide-react';
import { extractTextFromImage } from '@/lib/ocr/tesseract-client';
import { extractTextFromPdf } from '@/lib/ocr/pdf-parser';
import type { ScanResult, AuditLogEntry, Finding } from '@/src/lib/dlp/types';

export default function DlpDashboardPage() {
  const [activeTab, setActiveTab] = useState<'scan' | 'audit' | 'policies'>('scan');

  // Scanner state
  const [inputText, setInputText] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState<string>('');
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [copiedMasked, setCopiedMasked] = useState(false);

  // Audit state
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [auditStats, setAuditStats] = useState<any>(null);
  const [isLoadingAudit, setIsLoadingAudit] = useState(false);
  const [auditFilterDecision, setAuditFilterDecision] = useState('ALL');
  const [auditFilterSeverity, setAuditFilterSeverity] = useState('ALL');
  const [auditSearchQuery, setAuditSearchQuery] = useState('');
  const [selectedAuditLog, setSelectedAuditLog] = useState<AuditLogEntry | null>(null);

  // Policies state
  const [policies, setPolicies] = useState<any[]>([]);
  const [policyConfig, setPolicyConfig] = useState<any>({
    blockThreshold: 85,
    warnThreshold: 35,
    blockOnCritical: true,
    blockOnUnmaskedCards: true,
    blockOnPrivateKeys: true,
    enforceGovtPiiWarn: true,
  });
  const [policySavedNotice, setPolicySavedNotice] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load audit data when switching to audit tab
  useEffect(() => {
    if (activeTab === 'audit') {
      fetchAuditData();
    } else if (activeTab === 'policies') {
      fetchPolicyData();
    }
  }, [activeTab, auditFilterDecision, auditFilterSeverity]);

  const fetchAuditData = async () => {
    setIsLoadingAudit(true);
    try {
      const params = new URLSearchParams();
      if (auditSearchQuery) params.set('q', auditSearchQuery);
      if (auditFilterDecision !== 'ALL') params.set('decision', auditFilterDecision);
      if (auditFilterSeverity !== 'ALL') params.set('severity', auditFilterSeverity);

      const res = await fetch(`/api/dlp/audit?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setAuditLogs(data.logs || []);
        setAuditStats(data.stats || null);
      }
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setIsLoadingAudit(false);
    }
  };

  const fetchPolicyData = async () => {
    try {
      const res = await fetch('/api/dlp/policies');
      if (res.ok) {
        const data = await res.json();
        setPolicies(data.policies || []);
        if (data.config) setPolicyConfig(data.config);
      }
    } catch (err) {
      console.error('Failed to load policies:', err);
    }
  };

  const handleSavePolicies = async () => {
    try {
      const res = await fetch('/api/dlp/policies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(policyConfig),
      });
      if (res.ok) {
        setPolicySavedNotice(true);
        setTimeout(() => setPolicySavedNotice(false), 2500);
      }
    } catch (err) {
      console.error('Failed to save policies:', err);
    }
  };

  // Preset synthetic sample data buttons
  const loadPreset = (type: string) => {
    setSelectedFile(null);
    if (type === 'indian_pii') {
      setInputText(
        'Customer KYC Submission:\nName: John Doe\nContact: +91 98765 43210\nAadhaar: 2345 6789 0124\nPAN: ABCPE1234F\nBank A/C: 1234567890123\nIFSC: SBIN0001234'
      );
    } else if (type === 'credential_leak') {
      setInputText(
        'Deployment config for prod worker:\nOPENAI_API_KEY=sk-proj-abcde12345ABCDE12345ABCDE12345abcde12345\nAWS_KEY=AKIAIOSFODNN7EXAMPLE\nDATABASE_URL=postgres://app_user:SuperSecretP@ssw0rd!@10.0.1.15:5432/db\nPrivate Key:\n-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA0Y1m9...\n-----END RSA PRIVATE KEY-----'
      );
    } else if (type === 'cards') {
      setInputText(
        'Billing info: Customer card 4532 0150 1234 5671 (Visa), exp 12/28. Backup card 5500 0000 0000 0004.'
      );
    } else if (type === 'clean') {
      setInputText(
        'This prompt summarizes the quarterly system architecture updates. We improved API latency by 35% and added automated unit test coverage across all microservices.'
      );
    }
  };

  // Run Scan Workflow
  const handleRunScan = async () => {
    setIsScanning(true);
    setScanError(null);
    setScanResult(null);
    setScanProgress('Initializing DLP inspection...');

    try {
      let textToScan = inputText;
      let filename = selectedFile?.name;
      let fileSize = selectedFile?.size;
      let fileType = selectedFile ? selectedFile.name.split('.').pop()?.toLowerCase() : 'text';

      // If a file is selected, process it
      if (selectedFile) {
        const ext = fileType || '';

        if (['png', 'jpg', 'jpeg', 'webp'].includes(ext)) {
          setScanProgress('Running optical character recognition (OCR)...');
          textToScan = await extractTextFromImage(selectedFile, 'eng', (p) => {
            setScanProgress(p.status);
          });
        } else if (ext === 'pdf') {
          setScanProgress('Extracting digital text and scanning PDF pages...');
          const pdfRes = await extractTextFromPdf(selectedFile, 'eng', (p) => {
            setScanProgress(p.status);
          });
          textToScan = pdfRes.text;
        } else {
          setScanProgress('Reading text document...');
          textToScan = await selectedFile.text();
        }
      }

      if (!textToScan || textToScan.trim().length === 0) {
        throw new Error('No readable text extracted or entered to scan.');
      }

      setScanProgress('Analyzing sensitive data patterns and evaluating policies...');

      // Call DLP Scan API
      const res = await fetch('/api/dlp/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: textToScan,
          filename,
          fileType,
          fileSize,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to complete DLP scan.');
      }

      setScanResult(data);
    } catch (err: any) {
      setScanError(err.message || 'An error occurred during scanning.');
    } finally {
      setIsScanning(false);
      setScanProgress('');
    }
  };

  const handleCopyMasked = () => {
    if (scanResult?.maskedText) {
      navigator.clipboard.writeText(scanResult.maskedText);
      setCopiedMasked(true);
      setTimeout(() => setCopiedMasked(false), 2000);
    }
  };

  const handleDownloadReport = () => {
    if (!scanResult) return;
    const reportData = {
      ...scanResult,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dlp-report-${scanResult.scanId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-[#171717] text-[#ececec] font-sans">
      {/* Top Header */}
      <header className="h-14 border-b border-[#2a2a2a] px-4 sm:px-6 flex items-center justify-between bg-[#1f1f1f]">
        <div className="flex items-center space-x-3">
          <Link
            href="/chat"
            className="flex items-center space-x-1.5 text-xs text-[#9b9b9b] hover:text-[#ececec] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Chat</span>
          </Link>
          <span className="text-[#383838]">|</span>
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 rounded-md bg-emerald-600/20 text-emerald-400 flex items-center justify-center font-bold text-xs">
              <Shield className="w-3.5 h-3.5" />
            </div>
            <h1 className="text-sm font-semibold text-[#ececec]">DLP Shield &amp; Audit Engine</h1>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Active Guard
            </span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center space-x-1 bg-[#171717] p-1 rounded-lg border border-[#2a2a2a]">
          <button
            type="button"
            onClick={() => setActiveTab('scan')}
            className={`px-3 py-1 text-xs rounded-md font-medium transition-colors cursor-pointer ${
              activeTab === 'scan' ? 'bg-[#2a2a2a] text-[#ececec]' : 'text-[#9b9b9b] hover:text-[#ececec]'
            }`}
          >
            Scanner
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('audit')}
            className={`px-3 py-1 text-xs rounded-md font-medium transition-colors cursor-pointer ${
              activeTab === 'audit' ? 'bg-[#2a2a2a] text-[#ececec]' : 'text-[#9b9b9b] hover:text-[#ececec]'
            }`}
          >
            Audit Logs
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('policies')}
            className={`px-3 py-1 text-xs rounded-md font-medium transition-colors cursor-pointer ${
              activeTab === 'policies' ? 'bg-[#2a2a2a] text-[#ececec]' : 'text-[#9b9b9b] hover:text-[#ececec]'
            }`}
          >
            Policies
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* ==================================================================== */}
        {/* TAB 1: SCANNER                                                       */}
        {/* ==================================================================== */}
        {activeTab === 'scan' && (
          <div className="space-y-6">
            {/* Header info */}
            <div>
              <h2 className="text-xl font-semibold text-[#ececec]">Inspect Content &amp; Files for Data Loss</h2>
              <p className="text-xs text-[#9b9b9b] mt-1">
                Scan plain text, documents (PDF, TXT, CSV, JSON), or images (PNG, JPG) for Indian IDs, payment cards, passwords, and private keys.
              </p>
            </div>

            {/* Presets Row */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-[#9b9b9b]">Load synthetic test:</span>
              <button
                type="button"
                onClick={() => loadPreset('indian_pii')}
                className="px-2.5 py-1 rounded-md bg-[#252525] hover:bg-[#2f2f2f] border border-[#383838] text-[#c4c4c4] transition-colors cursor-pointer"
              >
                Aadhaar + PAN + Bank A/C
              </button>
              <button
                type="button"
                onClick={() => loadPreset('credential_leak')}
                className="px-2.5 py-1 rounded-md bg-[#252525] hover:bg-[#2f2f2f] border border-[#383838] text-[#c4c4c4] transition-colors cursor-pointer"
              >
                Private Key + API Tokens
              </button>
              <button
                type="button"
                onClick={() => loadPreset('cards')}
                className="px-2.5 py-1 rounded-md bg-[#252525] hover:bg-[#2f2f2f] border border-[#383838] text-[#c4c4c4] transition-colors cursor-pointer"
              >
                Payment Cards (Luhn)
              </button>
              <button
                type="button"
                onClick={() => loadPreset('clean')}
                className="px-2.5 py-1 rounded-md bg-[#252525] hover:bg-[#2f2f2f] border border-[#383838] text-[#c4c4c4] transition-colors cursor-pointer"
              >
                Clean Prompt
              </button>
            </div>

            {/* Upload & Input Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Text Area */}
              <div className="flex flex-col rounded-xl bg-[#212121] border border-[#333333] p-4">
                <label className="text-xs font-medium text-[#c4c4c4] mb-2 flex items-center justify-between">
                  <span>Input Text</span>
                  <span className="text-[#777777] font-normal">{inputText.length.toLocaleString()} characters</span>
                </label>
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Paste confidential data, logs, API keys, or prompt text here..."
                  rows={8}
                  className="flex-1 w-full bg-[#1a1a1a] border border-[#333333] rounded-lg p-3 text-xs text-[#ececec] outline-none focus:border-[#555] font-mono resize-none placeholder:text-[#666]"
                />
              </div>

              {/* File Dropzone */}
              <div className="flex flex-col rounded-xl bg-[#212121] border border-[#333333] p-4">
                <label className="text-xs font-medium text-[#c4c4c4] mb-2">Upload Document or Image</label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 border-2 border-dashed border-[#383838] hover:border-[#555555] rounded-lg flex flex-col items-center justify-center p-6 text-center cursor-pointer transition-colors bg-[#1a1a1a]/40"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".txt,.csv,.json,.md,.pdf,.png,.jpg,.jpeg,.webp"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setSelectedFile(e.target.files[0]);
                      }
                    }}
                  />
                  {selectedFile ? (
                    <div className="space-y-1.5">
                      <FileCheck className="w-8 h-8 text-emerald-400 mx-auto" />
                      <p className="text-xs font-medium text-[#ececec]">{selectedFile.name}</p>
                      <p className="text-[11px] text-[#9b9b9b]">
                        {(selectedFile.size / 1024).toFixed(1)} KB · Click to change file
                      </p>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedFile(null);
                        }}
                        className="text-[10px] text-red-400 hover:text-red-300 underline pt-1"
                      >
                        Remove file
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <UploadCloud className="w-8 h-8 text-[#9b9b9b] mx-auto" />
                      <div>
                        <p className="text-xs font-medium text-[#ececec]">Click to select a file or drag &amp; drop</p>
                        <p className="text-[11px] text-[#777777] mt-0.5">PDF, PNG, JPG, TXT, CSV, JSON (Up to 10 MB)</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Scan Action Row */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#9b9b9b]">
                {scanProgress || 'All scans execute privacy-preserving contextual checks.'}
              </span>
              <button
                type="button"
                disabled={isScanning || (!inputText.trim() && !selectedFile)}
                onClick={handleRunScan}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                {isScanning ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Analyzing...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Run DLP Inspection</span>
                  </>
                )}
              </button>
            </div>

            {/* Scan Error Message */}
            {scanError && (
              <div className="rounded-lg bg-red-950/20 border border-red-500/30 p-3.5 text-xs text-red-400 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{scanError}</span>
              </div>
            )}

            {/* Scan Result Section */}
            {scanResult && (
              <div className="space-y-5 rounded-xl bg-[#212121] border border-[#333333] p-5 animate-in fade-in">
                {/* Decision Banner */}
                <div
                  className={`rounded-lg p-4 border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    scanResult.policy.decision === 'BLOCK'
                      ? 'bg-red-950/20 border-red-500/40 text-red-200'
                      : scanResult.policy.decision === 'WARN'
                      ? 'bg-amber-950/20 border-amber-500/40 text-amber-200'
                      : 'bg-emerald-950/20 border-emerald-500/40 text-emerald-200'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {scanResult.policy.decision === 'BLOCK' && <ShieldX className="w-6 h-6 text-red-400 shrink-0 mt-0.5" />}
                    {scanResult.policy.decision === 'WARN' && <ShieldAlert className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />}
                    {scanResult.policy.decision === 'ALLOW' && <ShieldCheck className="w-6 h-6 text-emerald-400 shrink-0 mt-0.5" />}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm tracking-wide uppercase">
                          Policy Decision: {scanResult.policy.decision}
                        </span>
                        <span className="text-[11px] opacity-75 font-mono">({scanResult.policy.policyName})</span>
                      </div>
                      <p className="text-xs mt-1 leading-relaxed opacity-90">{scanResult.policy.recommendedAction}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={handleDownloadReport}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#252525] hover:bg-[#2f2f2f] border border-[#383838] text-xs font-medium text-[#ececec] transition-colors cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download JSON</span>
                    </button>
                  </div>
                </div>

                {/* Score & Classification Row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3.5 rounded-lg bg-[#262626] border border-[#383838]">
                    <div className="text-[11px] text-[#9b9b9b]">Risk Score</div>
                    <div className="text-2xl font-bold mt-1 text-[#ececec]">
                      {scanResult.risk.score}
                      <span className="text-xs text-[#9b9b9b] font-normal"> / 100</span>
                    </div>
                  </div>
                  <div className="p-3.5 rounded-lg bg-[#262626] border border-[#383838]">
                    <div className="text-[11px] text-[#9b9b9b]">Severity Level</div>
                    <div
                      className={`text-lg font-bold mt-1.5 ${
                        scanResult.risk.level === 'CRITICAL'
                          ? 'text-red-400'
                          : scanResult.risk.level === 'HIGH'
                          ? 'text-amber-400'
                          : scanResult.risk.level === 'MEDIUM'
                          ? 'text-yellow-400'
                          : 'text-emerald-400'
                      }`}
                    >
                      {scanResult.risk.level}
                    </div>
                  </div>
                  <div className="p-3.5 rounded-lg bg-[#262626] border border-[#383838]">
                    <div className="text-[11px] text-[#9b9b9b]">Document Classification</div>
                    <div className="text-lg font-bold mt-1.5 text-blue-400">{scanResult.risk.classification}</div>
                  </div>
                  <div className="p-3.5 rounded-lg bg-[#262626] border border-[#383838]">
                    <div className="text-[11px] text-[#9b9b9b]">Total Findings</div>
                    <div className="text-2xl font-bold mt-1 text-[#ececec]">{scanResult.findings.length}</div>
                  </div>
                </div>

                {/* Findings Table */}
                <div>
                  <h3 className="text-xs font-semibold text-[#ececec] uppercase tracking-wider mb-2.5">
                    Detected Sensitive Entities ({scanResult.findings.length})
                  </h3>
                  {scanResult.findings.length === 0 ? (
                    <div className="p-4 rounded-lg bg-[#1a1a1a] text-center text-xs text-[#9b9b9b]">
                      No sensitive data detected in this content. Clean!
                    </div>
                  ) : (
                    <div className="border border-[#383838] rounded-lg overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-[#2a2a2a] text-[#9b9b9b] border-b border-[#383838]">
                          <tr>
                            <th className="px-3.5 py-2.5 font-medium">Category</th>
                            <th className="px-3.5 py-2.5 font-medium">Masked Value</th>
                            <th className="px-3.5 py-2.5 font-medium">Severity</th>
                            <th className="px-3.5 py-2.5 font-medium">Confidence</th>
                            <th className="px-3.5 py-2.5 font-medium">Detection Method</th>
                            <th className="px-3.5 py-2.5 font-medium">Explanation</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#333333]">
                          {scanResult.findings.map((f, i) => (
                            <tr key={i} className="hover:bg-[#252525]/60 transition-colors">
                              <td className="px-3.5 py-2.5 font-medium text-[#ececec] whitespace-nowrap">
                                {f.label || f.type}
                              </td>
                              <td className="px-3.5 py-2.5 font-mono text-[11px] text-[#c4c4c4] whitespace-nowrap">
                                {f.maskedValue || f.placeholder || '****'}
                              </td>
                              <td className="px-3.5 py-2.5 whitespace-nowrap">
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                    f.severity === 'CRITICAL'
                                      ? 'bg-red-500/20 text-red-400'
                                      : f.severity === 'HIGH'
                                      ? 'bg-amber-500/20 text-amber-400'
                                      : f.severity === 'MEDIUM'
                                      ? 'bg-yellow-500/20 text-yellow-400'
                                      : 'bg-emerald-500/20 text-emerald-400'
                                  }`}
                                >
                                  {f.severity || 'MEDIUM'}
                                </span>
                              </td>
                              <td className="px-3.5 py-2.5 text-[#9b9b9b] capitalize whitespace-nowrap">{f.confidence}</td>
                              <td className="px-3.5 py-2.5 font-mono text-[10px] text-[#888888] whitespace-nowrap">
                                {f.detectionMethod || 'pattern'}
                              </td>
                              <td className="px-3.5 py-2.5 text-[#c4c4c4] text-[11px]">{f.explanation}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Masked Output Preview */}
                {scanResult.maskedText && (
                  <div className="space-y-2 pt-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-[#ececec]">Masked Safe Output</span>
                      <button
                        type="button"
                        onClick={handleCopyMasked}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#2a2a2a] hover:bg-[#333] text-xs text-[#c4c4c4] transition-colors cursor-pointer"
                      >
                        {copiedMasked ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedMasked ? 'Copied' : 'Copy Masked Text'}</span>
                      </button>
                    </div>
                    <pre className="p-3.5 rounded-lg bg-[#191919] border border-[#333333] text-xs font-mono text-[#c4c4c4] whitespace-pre-wrap break-words max-h-48 overflow-y-auto">
                      {scanResult.maskedText}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ==================================================================== */}
        {/* TAB 2: AUDIT LOGS & INCIDENT HISTORY                                 */}
        {/* ==================================================================== */}
        {activeTab === 'audit' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-[#ececec]">Privacy-Preserving Audit Trail</h2>
                <p className="text-xs text-[#9b9b9b] mt-1">
                  Metadata of past inspections. Never persists full identifiers, card numbers, or document text.
                </p>
              </div>
              <button
                type="button"
                onClick={fetchAuditData}
                disabled={isLoadingAudit}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#252525] hover:bg-[#2f2f2f] border border-[#383838] text-xs font-medium text-[#ececec] transition-colors cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingAudit ? 'animate-spin' : ''}`} />
                <span>Refresh Logs</span>
              </button>
            </div>

            {/* Aggregate Stats */}
            {auditStats && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-lg bg-[#212121] border border-[#333333]">
                  <div className="text-[11px] text-[#9b9b9b]">Total Scans Run</div>
                  <div className="text-2xl font-bold mt-1 text-[#ececec]">{auditStats.totalScans}</div>
                </div>
                <div className="p-3.5 rounded-lg bg-[#212121] border border-[#333333]">
                  <div className="text-[11px] text-[#9b9b9b]">Blocked Incidents</div>
                  <div className="text-2xl font-bold mt-1 text-red-400">{auditStats.blockedCount}</div>
                </div>
                <div className="p-3.5 rounded-lg bg-[#212121] border border-[#333333]">
                  <div className="text-[11px] text-[#9b9b9b]">Warnings Issued</div>
                  <div className="text-2xl font-bold mt-1 text-amber-400">{auditStats.warnCount}</div>
                </div>
                <div className="p-3.5 rounded-lg bg-[#212121] border border-[#333333]">
                  <div className="text-[11px] text-[#9b9b9b]">Average Risk Score</div>
                  <div className="text-2xl font-bold mt-1 text-blue-400">{auditStats.averageRiskScore} / 100</div>
                </div>
              </div>
            )}

            {/* Filter and Search Bar */}
            <div className="flex flex-col sm:flex-row gap-2.5">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-[#9b9b9b] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={auditSearchQuery}
                  onChange={(e) => setAuditSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && fetchAuditData()}
                  placeholder="Search by filename or scan ID..."
                  className="w-full bg-[#212121] border border-[#333333] rounded-lg pl-8 pr-3 py-2 text-xs text-[#ececec] outline-none focus:border-[#555]"
                />
              </div>

              <select
                value={auditFilterDecision}
                onChange={(e) => setAuditFilterDecision(e.target.value)}
                className="bg-[#212121] border border-[#333333] rounded-lg px-3 py-2 text-xs text-[#ececec] outline-none"
              >
                <option value="ALL">All Decisions</option>
                <option value="ALLOW">ALLOW Only</option>
                <option value="WARN">WARN Only</option>
                <option value="BLOCK">BLOCK Only</option>
              </select>

              <select
                value={auditFilterSeverity}
                onChange={(e) => setAuditFilterSeverity(e.target.value)}
                className="bg-[#212121] border border-[#333333] rounded-lg px-3 py-2 text-xs text-[#ececec] outline-none"
              >
                <option value="ALL">All Severities</option>
                <option value="CRITICAL">CRITICAL</option>
                <option value="HIGH">HIGH</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="LOW">LOW</option>
              </select>
            </div>

            {/* Audit Logs Table */}
            <div className="border border-[#383838] rounded-xl overflow-x-auto bg-[#212121]">
              {auditLogs.length === 0 ? (
                <div className="p-8 text-center text-xs text-[#9b9b9b]">
                  No audit logs found matching criteria. Run a scan from the Scanner tab to log events.
                </div>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#2a2a2a] text-[#9b9b9b] border-b border-[#383838]">
                    <tr>
                      <th className="px-3.5 py-2.5 font-medium">Timestamp</th>
                      <th className="px-3.5 py-2.5 font-medium">Source / File</th>
                      <th className="px-3.5 py-2.5 font-medium">Decision</th>
                      <th className="px-3.5 py-2.5 font-medium">Risk</th>
                      <th className="px-3.5 py-2.5 font-medium">Findings</th>
                      <th className="px-3.5 py-2.5 font-medium">Classification</th>
                      <th className="px-3.5 py-2.5 font-medium text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#333333]">
                    {auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-[#252525]/60 transition-colors">
                        <td className="px-3.5 py-2.5 text-[#9b9b9b] whitespace-nowrap font-mono text-[11px]">
                          {new Date(log.timestamp).toLocaleString()}
                        </td>
                        <td className="px-3.5 py-2.5 text-[#ececec] font-medium whitespace-nowrap">
                          {log.filename || `${log.sourceType.toUpperCase()} (Prompt)`}
                        </td>
                        <td className="px-3.5 py-2.5 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              log.policyDecision === 'BLOCK'
                                ? 'bg-red-500/20 text-red-400'
                                : log.policyDecision === 'WARN'
                                ? 'bg-amber-500/20 text-amber-400'
                                : 'bg-emerald-500/20 text-emerald-400'
                            }`}
                          >
                            {log.policyDecision}
                          </span>
                        </td>
                        <td className="px-3.5 py-2.5 whitespace-nowrap font-mono">
                          {log.riskScore} <span className="text-[10px] text-[#9b9b9b]">({log.riskLevel})</span>
                        </td>
                        <td className="px-3.5 py-2.5 text-[#c4c4c4] whitespace-nowrap">{log.totalFindings}</td>
                        <td className="px-3.5 py-2.5 text-blue-400 text-[11px] font-medium whitespace-nowrap">
                          {log.classification}
                        </td>
                        <td className="px-3.5 py-2.5 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setSelectedAuditLog(log)}
                            className="inline-flex items-center gap-1 text-[11px] text-emerald-400 hover:text-emerald-300 font-medium cursor-pointer"
                          >
                            <Eye className="w-3 h-3" />
                            <span>Details</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Audit Detail Modal */}
            {selectedAuditLog && (
              <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
                <div className="bg-[#212121] border border-[#383838] rounded-xl max-w-lg w-full p-5 space-y-4 shadow-2xl">
                  <div className="flex items-center justify-between border-b border-[#333333] pb-3">
                    <h3 className="text-sm font-semibold text-[#ececec]">Audit Log Details</h3>
                    <button
                      type="button"
                      onClick={() => setSelectedAuditLog(null)}
                      className="p-1 rounded text-[#9b9b9b] hover:text-[#ececec]"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="space-y-2 text-xs">
                    <div>
                      <span className="text-[#9b9b9b]">Scan ID:</span>{' '}
                      <span className="font-mono text-[#ececec]">{selectedAuditLog.scanId}</span>
                    </div>
                    <div>
                      <span className="text-[#9b9b9b]">Timestamp:</span>{' '}
                      <span className="text-[#ececec]">{new Date(selectedAuditLog.timestamp).toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-[#9b9b9b]">Policy Triggered:</span>{' '}
                      <span className="text-[#ececec]">{selectedAuditLog.policyName}</span>
                    </div>
                    <div>
                      <span className="text-[#9b9b9b]">Reasons:</span>
                      <ul className="list-disc pl-4 mt-1 space-y-0.5 text-[#c4c4c4]">
                        {selectedAuditLog.reasons.map((r, i) => (
                          <li key={i}>{r}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="pt-2">
                      <span className="text-[#9b9b9b]">Finding Categories:</span>
                      <pre className="mt-1 p-2 rounded bg-[#191919] font-mono text-[11px] text-[#c4c4c4]">
                        {JSON.stringify(selectedAuditLog.findingCategories, null, 2)}
                      </pre>
                    </div>
                  </div>
                  <div className="flex justify-end pt-2">
                    <button
                      type="button"
                      onClick={() => setSelectedAuditLog(null)}
                      className="px-3 py-1.5 rounded-md bg-[#2a2a2a] hover:bg-[#333] text-xs font-medium text-[#ececec]"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ==================================================================== */}
        {/* TAB 3: POLICIES & GOVERNANCE                                         */}
        {/* ==================================================================== */}
        {activeTab === 'policies' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-[#ececec]">DLP Policy Configuration</h2>
                <p className="text-xs text-[#9b9b9b] mt-1">
                  Adjust organizational data governance rules, risk thresholds, and automated action triggers.
                </p>
              </div>
              <button
                type="button"
                onClick={handleSavePolicies}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs transition-colors cursor-pointer"
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Save Changes</span>
              </button>
            </div>

            {policySavedNotice && (
              <div className="rounded-lg bg-emerald-950/20 border border-emerald-500/30 p-3 text-xs text-emerald-400 flex items-center gap-2">
                <Check className="w-4 h-4" />
                <span>Policy configuration updated successfully.</span>
              </div>
            )}

            {/* Threshold Sliders */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-[#212121] border border-[#333333] space-y-2">
                <div className="flex justify-between text-xs font-medium text-[#ececec]">
                  <span>Hard Block Threshold</span>
                  <span className="font-mono text-red-400">{policyConfig.blockThreshold} / 100</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="100"
                  value={policyConfig.blockThreshold}
                  onChange={(e) => setPolicyConfig({ ...policyConfig, blockThreshold: parseInt(e.target.value, 10) })}
                  className="w-full accent-red-500"
                />
                <p className="text-[11px] text-[#9b9b9b]">
                  Scans scoring at or above this value trigger a BLOCK decision immediately.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-[#212121] border border-[#333333] space-y-2">
                <div className="flex justify-between text-xs font-medium text-[#ececec]">
                  <span>Warning / Review Threshold</span>
                  <span className="font-mono text-amber-400">{policyConfig.warnThreshold} / 100</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="70"
                  value={policyConfig.warnThreshold}
                  onChange={(e) => setPolicyConfig({ ...policyConfig, warnThreshold: parseInt(e.target.value, 10) })}
                  className="w-full accent-amber-500"
                />
                <p className="text-[11px] text-[#9b9b9b]">
                  Scans scoring at or above this value trigger a WARN / REQUIRE MASKING prompt.
                </p>
              </div>
            </div>

            {/* Active Rule Cards */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-[#ececec] uppercase tracking-wider">Configured Policy Rules</h3>
              {policies.map((p) => (
                <div key={p.id} className="p-4 rounded-xl bg-[#212121] border border-[#333333] flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] text-[#888888]">{p.id}</span>
                      <span className="text-xs font-semibold text-[#ececec]">{p.name}</span>
                      <span
                        className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                          p.severity === 'CRITICAL'
                            ? 'bg-red-500/20 text-red-400'
                            : 'bg-amber-500/20 text-amber-400'
                        }`}
                      >
                        {p.severity}
                      </span>
                    </div>
                    <p className="text-xs text-[#9b9b9b]">{p.description}</p>
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded text-xs font-bold shrink-0 ${
                      p.action.includes('BLOCK') ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    }`}
                  >
                    {p.action}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
