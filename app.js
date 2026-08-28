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

    const pieKeys = Object.keys(PIE_DICTIONARY);

    // Split input while preserving spaces and punctuation
    const tokens = rawText.split(/(\s+|[^\w\s]+)/);

    const translatedSentence = tokens.map(token => {
      // Preserve whitespace and punctuation intact
      if (!token || /^\s+$/.test(token) || /^[^\w\s]+$/.test(token)) {
        return token;
      }

      const cleanWord = token.toLowerCase();
      let bestKey = null;
      let highestScore = 0;

      for (let i = 0; i < pieKeys.length; i++) {
        const pieKey = pieKeys[i];
        const score = jaroWinkler(cleanWord, pieKey);

        if (score >= threshold && score > highestScore) {
          highestScore = score;
          bestKey = pieKey;
        }
      }

      // Output ONLY the English definition if a match passes the threshold
      if (bestKey) {
        return PIE_DICTIONARY[bestKey];
      }

      // Keep original word as fallback if below threshold
      return token;
    }).join('');

    resultsDiv.innerHTML = `<p style="font-size: 1.1rem; line-height: 1.6;">${translatedSentence}</p>`;
  });
});