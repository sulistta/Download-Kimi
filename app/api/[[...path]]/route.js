import { NextResponse } from 'next/server';

const GITHUB_API = 'https://api.github.com/repos/sulistta/kimitv-updates/releases';

let cachedData = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

async function fetchReleases() {
  const now = Date.now();
  if (cachedData && (now - cacheTimestamp) < CACHE_DURATION) {
    return { data: cachedData, fromCache: true };
  }

  try {
    const res = await fetch(GITHUB_API, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'KimiTV-Download-Page'
      },
      next: { revalidate: 300 }
    });

    if (res.status === 403) {
      if (cachedData) {
        return { data: cachedData, fromCache: true, rateLimited: true };
      }
      return { error: 'rate_limited', status: 403 };
    }

    if (!res.ok) {
      if (cachedData) {
        return { data: cachedData, fromCache: true };
      }
      return { error: 'fetch_failed', status: res.status };
    }

    const data = await res.json();
    cachedData = data;
    cacheTimestamp = now;
    return { data, fromCache: false };
  } catch (err) {
    if (cachedData) {
      return { data: cachedData, fromCache: true };
    }
    return { error: 'network_error', message: err.message };
  }
}

export async function GET(request) {
  const url = new URL(request.url);
  const pathSegments = url.pathname.replace('/api/', '').split('/').filter(Boolean);

  if (pathSegments[0] === 'releases' || pathSegments.length === 0) {
    const result = await fetchReleases();

    if (result.error) {
      return NextResponse.json(
        { error: result.error, message: result.message || 'Failed to fetch releases' },
        { status: result.status || 500 }
      );
    }

    return NextResponse.json({
      releases: result.data,
      fromCache: result.fromCache,
      rateLimited: result.rateLimited || false
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600'
      }
    });
  }

  if (pathSegments[0] === 'health') {
    return NextResponse.json({ status: 'ok', timestamp: new Date().toISOString() });
  }

  return NextResponse.json({ error: 'not_found' }, { status: 404 });
}
