// api/fpf.js — Vercel Edge Function proxy para resultados.fpf.pt
// Edge runtime: corre na rede Cloudflare, menos bloqueado que IPs de data center.
// Suporta: ?matchId=XXX | ?fixtureId=XXX | ?competitionId=X&seasonId=Y

export const config = { runtime: 'edge' };

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'pt-PT,pt;q=0.9,en-GB;q=0.8,en;q=0.7',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache',
  'Referer': 'https://resultados.fpf.pt/',
  'sec-ch-ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"Windows"',
  'sec-fetch-dest': 'document',
  'sec-fetch-mode': 'navigate',
  'sec-fetch-site': 'same-origin',
  'sec-fetch-user': '?1',
  'Upgrade-Insecure-Requests': '1',
};

export default async function handler(req) {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS' },
    });
  }

  const { searchParams } = new URL(req.url);
  const matchId       = searchParams.get('matchId');
  const fixtureId     = searchParams.get('fixtureId');
  const competitionId = searchParams.get('competitionId');
  const seasonId      = searchParams.get('seasonId');

  const CORS = { 'Access-Control-Allow-Origin': '*' };

  let url;
  if (matchId) {
    if (!/^\d{1,10}$/.test(matchId))
      return new Response(JSON.stringify({ error: 'matchId inválido' }), { status: 400, headers: CORS });
    url = `https://resultados.fpf.pt/Match/GetMatchInformation?matchId=${matchId}`;
  } else if (fixtureId) {
    if (!/^\d{1,10}$/.test(fixtureId))
      return new Response(JSON.stringify({ error: 'fixtureId inválido' }), { status: 400, headers: CORS });
    url = `https://resultados.fpf.pt/Competition/GetClassificationAndMatchesByFixture?fixtureId=${fixtureId}`;
  } else if (competitionId && seasonId) {
    if (!/^\d{1,10}$/.test(competitionId) || !/^\d{1,10}$/.test(seasonId))
      return new Response(JSON.stringify({ error: 'competitionId/seasonId inválido' }), { status: 400, headers: CORS });
    url = `https://resultados.fpf.pt/Competition/Details?competitionId=${competitionId}&seasonId=${seasonId}`;
  } else {
    return new Response(
      JSON.stringify({ error: 'Parâmetro em falta: matchId, fixtureId, ou competitionId+seasonId' }),
      { status: 400, headers: CORS }
    );
  }

  try {
    const response = await fetch(url, { headers: BROWSER_HEADERS, redirect: 'follow' });

    if (!response.ok) {
      return new Response(
        JSON.stringify({
          error: `FPF devolveu ${response.status}`,
          url,
          hint: response.status === 403 ? 'Edge runtime ainda bloqueado — experimenta Cloudflare Workers.' : undefined,
        }),
        { status: response.status, headers: { ...CORS, 'Content-Type': 'application/json' } }
      );
    }

    const body = await response.text();
    const contentType = response.headers.get('content-type') || 'text/html; charset=utf-8';

    return new Response(body, {
      status: 200,
      headers: {
        ...CORS,
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=1800',
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
}
