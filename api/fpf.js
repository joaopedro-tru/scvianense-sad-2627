// api/fpf.js — Vercel serverless proxy para resultados.fpf.pt
// Suporta: ?matchId=XXX | ?fixtureId=XXX | ?competitionId=X&seasonId=Y

// Headers que imitam um browser real (Chrome 124 no Windows).
// Sem Origin nem X-Requested-With — esses headers delatam pedidos programáticos.
const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'pt-PT,pt;q=0.9,en-GB;q=0.8,en;q=0.7',
  'Accept-Encoding': 'gzip, deflate, br',
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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { matchId, fixtureId, competitionId, seasonId } = req.query;

  let url;
  if (matchId) {
    if (!/^\d{1,10}$/.test(matchId)) return res.status(400).json({ error: 'matchId inválido' });
    url = `https://resultados.fpf.pt/Match/GetMatchInformation?matchId=${matchId}`;
  } else if (fixtureId) {
    if (!/^\d{1,10}$/.test(fixtureId)) return res.status(400).json({ error: 'fixtureId inválido' });
    url = `https://resultados.fpf.pt/Competition/GetClassificationAndMatchesByFixture?fixtureId=${fixtureId}`;
  } else if (competitionId && seasonId) {
    if (!/^\d{1,10}$/.test(competitionId) || !/^\d{1,10}$/.test(seasonId))
      return res.status(400).json({ error: 'competitionId/seasonId inválido' });
    url = `https://resultados.fpf.pt/Competition/Details?competitionId=${competitionId}&seasonId=${seasonId}`;
  } else {
    return res.status(400).json({ error: 'Parâmetro em falta: matchId, fixtureId, ou competitionId+seasonId' });
  }

  try {
    const response = await fetch(url, {
      headers: BROWSER_HEADERS,
      redirect: 'follow',
    });

    if (!response.ok) {
      // Inclui o URL no erro para facilitar diagnóstico
      return res.status(response.status).json({
        error: `FPF devolveu ${response.status}`,
        url,
        hint: response.status === 403
          ? 'Cloudflare bloqueou o pedido. O IP do Vercel pode estar na lista negra. Tenta numa instância diferente ou num runtime edge.'
          : undefined,
      });
    }

    const body = await response.text();

    res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=1800');
    res.setHeader('Content-Type', response.headers.get('content-type') || 'text/html; charset=utf-8');
    res.send(body);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
