import { NextResponse } from 'next/server';
import { getAuditLogs, getAuditStats } from '@/lib/dlp/audit-store';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';
    const decision = searchParams.get('decision') || 'ALL';
    const severity = searchParams.get('severity') || 'ALL';
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const statsOnly = searchParams.get('statsOnly') === 'true';

    const stats = await getAuditStats();

    if (statsOnly) {
      return NextResponse.json({ stats });
    }

    const { logs, total } = await getAuditLogs({
      query,
      decision,
      severity,
      limit,
      offset,
    });

    return NextResponse.json({
      logs,
      total,
      stats,
    });
  } catch (err: any) {
    console.error('[API /api/dlp/audit Error]', err);
    return NextResponse.json(
      { error: err.message || 'Failed to retrieve DLP audit logs.' },
      { status: 500 }
    );
  }
}
