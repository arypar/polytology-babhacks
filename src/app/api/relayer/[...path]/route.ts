import { NextRequest, NextResponse } from 'next/server';

const RELAYER_BASE = 'https://relayer-v2.polymarket.com';

async function proxyRelayer(
  request: NextRequest,
  params: { path: string[] }
): Promise<NextResponse> {
  const path = '/' + params.path.join('/');
  const searchParams = request.nextUrl.searchParams.toString();
  const targetUrl = `${RELAYER_BASE}${path}${searchParams ? '?' + searchParams : ''}`;

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
    console.error('[relayer-proxy] upstream fetch failed:', err);
    return NextResponse.json(
      { error: 'relayer unreachable', detail: String(err) },
      { status: 502 }
    );
  }

  const responseText = await upstreamResponse.text();

  if (!upstreamResponse.ok) {
    console.error(
      `[relayer-proxy] upstream ${request.method} ${path} → ${upstreamResponse.status}: ${responseText}`
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
  return proxyRelayer(request, await params);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return proxyRelayer(request, await params);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return proxyRelayer(request, await params);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return proxyRelayer(request, await params);
}
