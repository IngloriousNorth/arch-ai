/**
 * Set of articles, prepositions, and stop words to strip from the final output
 */
const STOP_WORDS = new Set([
  // Articles & Pronouns
  'a', 'an', 'the', 'that', 'there', 'what', 'who', 'where', 'why', 'when', 'how', 'is','and','or','not','it'
  // Prepositions
  'about', 'above', 'across', 'after', 'at', 'before', 'behind', 'below', 'beside', 
  'between', 'by', 'concerning', 'considering', 'despite', 'down', 'during', 'except', 
  'for', 'from', 'in', 'inside', 'into', 'like', 'near', 'of', 'off', 'on', 'onto', 
  'out', 'over', 'past', 'through', 'throughout', 'to', 'toward', 'towards', 'under', 
  'until', 'unto', 'up', 'upon', 'with', 'without'
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

/**
 * Searches a target dictionary object for the best similarity match using Porter Stemmer fallback
 */
function findBestMatch(word, stem, dictionary, threshold) {
  if (!dictionary) return { bestValue: null, highestScore: 0 };

  const keys = Object.keys(dictionary);
  let bestValue = null;
  let highestScore = 0;

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];

    // 1. Check exact raw word match score
    let score = jaroWinkler(word, key);

    // 2. Fall back to Porter Stemmer for words longer than 4 chars if below threshold
    if (score < threshold && word.length > 4 && typeof stemmer !== 'undefined') {
      const stemScore = jaroWinkler(stem, key);
      score = Math.max(score, stemScore);
    }

    if (score >= threshold && score > highestScore) {
      highestScore = score;
      bestValue = dictionary[key];
    }
  }

  return { bestValue, highestScore };
}

/**
 * Fetches data.number from the endpoint
 */
async function fetchModNumber() {
  try {
    const response = await fetch('https://selapian--2f58e6388fb311f1b0781607ee4eb77e.web.val.run/');
    const data = await response.json();
    return typeof data.number === 'number' ? data.number : 0;
  } catch (err) {
    console.warn('Endpoint fetch failed, defaulting modulo to 1 (PIE):', err);
    return 1;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const scanBtn = document.getElementById('scanBtn');
  const inputText = document.getElementById('inputText');
  const thresholdInput = document.getElementById('threshold');
  const resultsDiv = document.getElementById('results');

  scanBtn.addEventListener('click', async () => {
    const rawText = inputText.value;
    const threshold = parseFloat(thresholdInput.value) || 0.8;
    
    // Get currently selected database mode (pie | latin | both)
    const modeRadio = document.querySelector('input[name="dbMode"]:checked');
    const selectedMode = modeRadio ? modeRadio.value : 'both';

    if (!rawText.trim()) {
      resultsDiv.innerHTML = '<em>Please enter text above.</em>';
      return;
    }

    const hasPIE = typeof PIE_DICTIONARY !== 'undefined';
    const hasLatin = typeof LATIN_DICTIONARY !== 'undefined';

    // Validate that selected dictionary files are loaded
    if (selectedMode === 'pie' && !hasPIE) {
      resultsDiv.innerHTML = '<strong style="color:red;">Error: PIE_DICTIONARY is not loaded.</strong>';
      return;
    }
    if (selectedMode === 'latin' && !hasLatin) {
      resultsDiv.innerHTML = '<strong style="color:red;">Error: LATIN_DICTIONARY is not loaded.</strong>';
      return;
    }
    if (selectedMode === 'both' && !hasPIE && !hasLatin) {
      resultsDiv.innerHTML = '<strong style="color:red;">Error: Neither PIE_DICTIONARY nor LATIN_DICTIONARY is loaded.</strong>';
      return;
    }

    // Retrieve endpoint number for modulo logic if mode is 'both'
    let targetMod = 1;
    if (selectedMode === 'both') {
      const num = await fetchModNumber();
      targetMod = Math.abs(num) % 2; // 1 = PIE, 0 = Latin
    }

    // Preserve formatting, whitespace, and punctuation
    const tokens = rawText.split(/(\s+|[^\w\s]+)/);

    const translatedSentence = tokens
      .map(token => {
        if (!token || /^\s+$/.test(token) || /^[^\w\s]+$/.test(token)) {
          return token;
        }

        const cleanWord = token.toLowerCase();

        // Strip articles and prepositions
        if (STOP_WORDS.has(cleanWord)) {
          return '';
        }

        const stem = typeof stemmer !== 'undefined' ? stemmer(cleanWord) : cleanWord;

        // --- MODE EXECUTION LOGIC ---
        
        // Mode 1: PIE only
        if (selectedMode === 'pie') {
          const res = findBestMatch(cleanWord, stem, PIE_DICTIONARY, threshold);
          if (res.bestValue) return res.bestValue;
        }

        // Mode 2: Latin only
        if (selectedMode === 'latin') {
          const res = findBestMatch(cleanWord, stem, LATIN_DICTIONARY, threshold);
          if (res.bestValue) return res.bestValue;
        }

        // Mode 3: Both (Modulo tie-breaker when both match)
        if (selectedMode === 'both') {
          const pieRes = hasPIE ? findBestMatch(cleanWord, stem, PIE_DICTIONARY, threshold) : { bestValue: null };
          const latinRes = hasLatin ? findBestMatch(cleanWord, stem, LATIN_DICTIONARY, threshold) : { bestValue: null };

          if (pieRes.bestValue && latinRes.bestValue) {
            // Modulo 2 tiebreaker: 1 selects PIE, 0 selects Latin
            return targetMod === 1 ? pieRes.bestValue : latinRes.bestValue;
          }
          if (pieRes.bestValue) return pieRes.bestValue;
          if (latinRes.bestValue) return latinRes.bestValue;
        }

        return token;
      })
      .join('')
      .replace(/\s+/g, ' ')
      .trim();

    resultsDiv.innerHTML = `<p style="font-size: 1.1rem; line-height: 1.6;">${translatedSentence}</p>`;
  });
});