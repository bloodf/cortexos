export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  return Response.json({
    status: 'ok',
    service: 'cortex-dashboard',
    ts: new Date().toISOString(),
  });
}
