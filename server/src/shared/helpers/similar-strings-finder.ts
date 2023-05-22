type Score = {
  phrase: string | null;
  score: number | null;
  id: string | null;
};

function stringSimilarity(str1: string, str2: string, substringLength = 3, caseSensitive = false) {
  if (str1.length < substringLength || str2.length < substringLength) {
    return 0;
  }
  if (!caseSensitive) {
    str1 = str1.toLowerCase();
    str2 = str2.toLowerCase();
  }
  const map = new Map();
  for (let i = 0; i < str1.length - substringLength + 1; i++) {
    const substring1 = str1.substr(i, substringLength);
    map.set(substring1, map.has(substring1) ? map.get(substring1) + 1 : 1);
  }
  let match = 0;
  for (let i = 0; i < str2.length - substringLength + 1; i++) {
    const substring2 = str2.substr(i, substringLength);
    const count = map.has(substring2) ? map.get(substring2) : 0;
    if (count > 0) {
      map.set(substring2, count - 1);
      match++;
    }
  }
  return (2.0 * match) / (str1.length - substringLength + 1 + str2.length - substringLength + 1);
}

export function similarStringsFinder(
  targetPhrase: string,
  phraseList: { phrase: string; id: string }[],
  options: {
    substringLength?: number;
    caseSensitive?: boolean;
    minScore?: number;
  },
): { scores: Score[]; bestScore: Score } {
  const fullOptions = {
    substringLength: 2,
    caseSensitive: false,
    minScore: 0,
    ...options,
  };
  const scores: Score[] = [];
  let bestMatch: Score = { phrase: null, score: null, id: null };
  phraseList.forEach(({ phrase, id }) => {
    if (phrase == null || phrase === '' || typeof phrase !== 'string') {
      return;
    }

    const score = stringSimilarity(
      targetPhrase,
      phrase,
      fullOptions.substringLength,
      fullOptions.caseSensitive,
    );

    const currentMatch = { phrase, score, id };

    if (score < fullOptions.minScore) {
      return currentMatch;
    }

    if (bestMatch.score === null || bestMatch.score < currentMatch.score) {
      bestMatch = { ...currentMatch };
    }
    scores.push(currentMatch);
  });

  return { scores, bestScore: bestMatch };
}
