/**
 * Set of articles and prepositions to strip from the final output
 */
const STOP_WORDS = new Set([
  // Articles
  'a', 'an', 'the',

  // Prepositions
  'about', 'above', 'across', 'after', 'against', 'along', 'amid', 'among',
  'around', 'at', 'before', 'behind', 'below', 'beneath', 'beside', 'between',
  'beyond', 'by', 'concerning', 'considering', 'despite', 'down', 'during',
  'except', 'for', 'from', 'in', 'inside', 'into', 'like', 'near', 'of',
  'off', 'on', 'onto', 'out', 'outside', 'over', 'past', 'regarding',
  'since', 'through', 'throughout', 'to', 'toward', 'towards', 'under',
  'underneath', 'until', 'unto', 'up', 'upon', 'with', 'within', 'without'
]);

/**
 * Calculates Jaro Similarity between two strings
 */
function jaroDistance(s1, s2) {
  if (s1 === s2) return 1.0;

  const len1 = s1.length;
  const len2 = s2.length;
  if (len1 === 0 || len2 === 0) return 0.0;

  const matchDistance = Math.floor(Math.max(len1, len2) / 2) - 1;
  const s1Matches = new Array(len1).fill(false);
  const s2Matches = new Array(len2).fill(false);

  let matches = 0;
  let transpositions = 0;

  for (let i = 0; i < len1; i++) {
    const start = Math.max(0, i - matchDistance);
    const end = Math.min(i + matchDistance + 1, len2);

    for (let j = start; j < end; j++) {
      if (s2Matches[j] || s1[i] !== s2[j]) continue;
      s1Matches[i] = true;
      s2Matches[j] = true;
      matches++;
      break;
    }
  }

  if (matches === 0) return 0.0;

  let k = 0;
  for (let i = 0; i < len1; i++) {
    if (!s1Matches[i]) continue;
    while (!s2Matches[k]) k++;
    if (s1[i] !== s2[k]) transpositions++;
    k++;
  }

  return ((matches / len1) + (matches / len2) + ((matches - (transpositions / 2)) / matches)) / 3.0;
}

/**
 * Calculates Jaro-Winkler Similarity
 */
function jaroWinkler(s1, s2, p = 0.1) {
  const jaroScore = jaroDistance(s1, s2);
  if (jaroScore < 0.7) return jaroScore;

  let prefixLength = 0;
  const maxPrefix = 4;

  for (let i = 0; i < Math.min(s1.length, s2.length, maxPrefix); i++) {
    if (s1[i] === s2[i]) {
      prefixLength++;
    } else {
      break;
    }
  }

  return jaroScore + (prefixLength * p * (1 - jaroScore));
}

document.addEventListener('DOMContentLoaded', () => {
  const scanBtn = document.getElementById('scanBtn');
  const inputText = document.getElementById('inputText');
  const thresholdInput = document.getElementById('threshold');
  const resultsDiv = document.getElementById('results');

  scanBtn.addEventListener('click', () => {
    const rawText = inputText.value;
    const threshold = parseFloat(thresholdInput.value) || 0.85;

    if (!rawText.trim()) {
      resultsDiv.innerHTML = '<em>Please enter text above.</em>';
      return;
    }

    if (typeof PIE_DICTIONARY === 'undefined') {
      resultsDiv.innerHTML = '<strong style="color:red;">Error: PIE_DICTIONARY not loaded from pie.js</strong>';
      return;
    }

    const entries = Object.entries(PIE_DICTIONARY);

    // Split text by tokens (words, punctuation, whitespace)
    const tokens = rawText.split(/(\s+|[^\w\s]+)/);

    const translatedSentence = tokens
      .map(token => {
        // Skip whitespace/punctuation formatting checks initially
        if (!token || /^\s+$/.test(token) || /^[^\w\s]+$/.test(token)) {
          return token;
        }

        const cleanWord = token.toLowerCase();

        // Check if the word is an article or preposition; if so, return empty string to delete it
        if (STOP_WORDS.has(cleanWord)) {
          return '';
        }

        cleanWord = stemmer(cleanWord);

        let bestMatchValue = null;
        let highestScore = 0;

        for (let i = 0; i < entries.length; i++) {
          const [key, value] = entries[i];

          const cleanKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
          const cleanValue = String(value).toLowerCase().replace(/[^a-z0-9]/g, '');

          const keyScore = jaroWinkler(cleanWord, cleanKey);
          const valueScore = jaroWinkler(cleanWord, cleanValue);
          const maxScore = Math.max(keyScore, valueScore);

          if (maxScore >= threshold && maxScore > highestScore) {
            highestScore = maxScore;
            bestMatchValue = value;
          }
        }

        return bestMatchValue ? bestMatchValue : token;
      })
      .join('')
      // Clean up any double spaces left behind by deleted stop words
      .replace(/\s+/g, ' ')
      .trim();

    resultsDiv.innerHTML = `<p style="font-size: 1.1rem; line-height: 1.6;">${translatedSentence}</p>`;
  });
});