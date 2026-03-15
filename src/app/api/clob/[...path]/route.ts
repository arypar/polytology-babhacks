import { NextRequest, NextResponse } from 'next/server';

const CLOB_BASE = 'https://clob.polymarket.com';

async function proxyClob(
  request: NextRequest,
  params: { path: string[] }
): Promise<NextResponse> {
  const path = '/' + params.path.join('/');
  const searchParams = request.nextUrl.searchParams.toString();
  const targetUrl = `${CLOB_BASE}${path}${searchParams ? '?' + searchParams : ''}`;

  const forwardHeaders: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (lower !== 'host' && lower !== 'connection') {
      forwardHeaders[key] = value;
    }
  });

  const body =
    request.method !== 'GET' && request.method !== 'HEAD'
      ? await request.text()
      : undefined;

  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetch(targetUrl, {
      method: request.method,
      headers: forwardHeaders,
      body,
    });
  } catch (err) {
    console.error('[clob-proxy] upstream fetch failed:', err);
    return NextResponse.json(
      { error: 'clob unreachable', detail: String(err) },
      { status: 502 }
    );
  }

  const responseText = await upstreamResponse.text();

  if (!upstreamResponse.ok) {
    console.error(
      `[clob-proxy] upstream ${request.method} ${path} → ${upstreamResponse.status}: ${responseText}`
    );
  }

  return new NextResponse(responseText, {
    status: upstreamResponse.status,
    headers: {
      'Content-Type':
        upstreamResponse.headers.get('Content-Type') ?? 'application/json',
    },
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return proxyClob(request, await params);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return proxyClob(request, await params);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return proxyClob(request, await params);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return proxyClob(request, await params);
}
