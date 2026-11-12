// api/fpf.js — Vercel serverless proxy para resultados.fpf.pt
// Suporta: ?matchId=XXX | ?fixtureId=XXX | ?competitionId=X&seasonId=Y

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
    if (!/^\d{1,10}$/.test(competitionId) || !/^\d{1,10}$/.test(seasonId)) return res.status(400).json({ error: 'competitionId/seasonId inválido' });
    url = `https://resultados.fpf.pt/Competition/Details?competitionId=${competitionId}&seasonId=${seasonId}`;
  } else {
    return res.status(400).json({ error: 'Parâmetro em falta: matchId, fixtureId, ou competitionId+seasonId' });
  }

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'pt-PT,pt;q=0.9',
      },
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: `FPF devolveu ${response.status}` });
    }

    const html = await response.text();

    res.setHeader('Cache-Control', 'public, max-age=600, stale-while-revalidate=3600');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
