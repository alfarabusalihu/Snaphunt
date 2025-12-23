export function rankPdfsFromChunks(results: any[]) {
  const pdfMap: Record<
    string,
    { source: string; score: number; matchedChunks: number }
  > = {};

  for (const r of results) {
    const source = r.payload.source;

    if (!pdfMap[source]) {
      pdfMap[source] = {
        source: source,
        score: 0,
        matchedChunks: 0,
      };
    }

    pdfMap[source].score += r.score;
    pdfMap[source].matchedChunks += 1;
  }

  return Object.values(pdfMap)
    .map(item => ({
      fileName: item.source.split(/[\\\/]/).pop() || item.source,
      location: item.source,
      averageScore: item.score / item.matchedChunks,
      matchedChunks: item.matchedChunks,
      totalScore: item.score
    }))
    .sort((a, b) => b.averageScore - a.averageScore);
}
