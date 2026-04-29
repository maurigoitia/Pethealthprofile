const normalizeText = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const levenshteinDistance = (a: string, b: string) => {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const matrix: number[][] = Array.from({ length: a.length + 1 }, () =>
    Array(b.length + 1).fill(0)
  );

  for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[a.length][b.length];
};

const hasNearWordMatch = (query: string, candidate: string) => {
  if (query.length < 4) return false;
  const queryWords = query.split(" ");
  const candidateWords = candidate.split(" ");

  return queryWords.some((qWord) =>
    candidateWords.some((cWord) => {
      const distance = levenshteinDistance(qWord, cWord);
      return distance <= 1 || cWord.includes(qWord) || qWord.includes(cWord);
    })
  );
};

export const searchBreeds = (breeds: string[], rawQuery: string, limit = 8) => {
  const query = normalizeText(rawQuery);
  if (!query) return [];

  const withScore = breeds.map((breed) => {
    const normalizedBreed = normalizeText(breed);

    let score = 0;
    if (normalizedBreed.startsWith(query)) score = 3;
    else if (normalizedBreed.includes(query)) score = 2;
    else if (hasNearWordMatch(query, normalizedBreed)) score = 1;

    return { breed, score };
  });

  return withScore
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.breed.localeCompare(b.breed))
    .slice(0, limit)
    .map((item) => item.breed);
};

