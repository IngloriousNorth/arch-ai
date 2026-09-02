/**
 * Set of articles, prepositions, and stop words to strip from the final output
 */
const STOP_WORDS = new Set([
  // Articles & Pronouns
  'a', 'an', 'the', 'that', 'there', 'what', 'who', 'where', 'why', 'when', 'how', 'is','and','or','not', 'it',
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
 * Helper to safely call Porter Stemmer whether defined as a function or object/class
 */
function getStem(word) {
  if (typeof stemmer === 'function') {
    return stemmer(word);
  }
  if (typeof PorterStemmer !== 'undefined' && typeof PorterStemmer.stem === 'function') {
    return PorterStemmer.stem(word);
  }
  if (typeof PorterStemmer1980 !== 'undefined' && typeof PorterStemmer1980.stem === 'function') {
    return PorterStemmer1980.stem(word);
  }
  return word;
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
    if (score < threshold && word.length > 4) {
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
 * Fetches quantum entropy number from your Val.town endpoint
 */
async function fetchModNumber() {
  try {
    const response = await fetch('https://selapian--2f58e6388fb311f1b0781607ee4eb77e.web.val.run/');
    const data = await response.json();
    return typeof data.number === 'number' ? data.number : Math.floor(Math.random() * 10000);
  } catch (err) {
    console.warn('Endpoint fetch failed, defaulting to random number:', err);
    return Math.floor(Math.random() * 10000);
  }
}

/**
 * pickle_surprise
 * Uses Math.random to decide whether to insert a QRNG word from the 
 * top_english_words list before the English translation.
 * 
 * @param {string} translatedToken The translated PIE/Latin word
 * @param {number} chance Probability threshold between 0 and 1 (default 0.5)
 * @returns {Promise<string>} The original or prepended translated token
 */
async function pickle_surprise(translatedToken, chance = 0.5) {
  if (!translatedToken || Math.random() > chance) {
    return translatedToken;
  }

  const wordList = typeof TOP_SHARED_ENGLISH_WORDS !== 'undefined' ? TOP_SHARED_ENGLISH_WORDS : [];
  if (wordList.length === 0) {
    return translatedToken;
  }

  const num = await fetchModNumber();
  const qrngIndex = Math.abs(num) % wordList.length;
  const qrngWord = wordList[qrngIndex];

  return `${qrngWord} ${translatedToken}`;
}

/**
 * Interleaves 1 top English cognate word from top_english_words.js between each word
 */
async function interleaveCognateWords(wordsArray) {
  if (!wordsArray || wordsArray.length <= 1) return wordsArray;

  const wordList = typeof TOP_SHARED_ENGLISH_WORDS !== 'undefined' ? TOP_SHARED_ENGLISH_WORDS : [];
  if (wordList.length === 0) return wordsArray;

  const result = [];
  for (let i = 0; i < wordsArray.length; i++) {
    result.push(wordsArray[i]);

    // Insert 1 word between consecutive words
    if (i < wordsArray.length - 1) {
      const rawNum = await fetchModNumber();
      const randomIndex = Math.abs(rawNum) % wordList.length;
      const cognateWord = wordList[randomIndex];
      result.push(cognateWord);
    }
  }

  return result;
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

    // Preserve formatting, whitespace, and punctuation
    const tokens = rawText.split(/(\s+|[^\w\s]+)/);

    // Map each token asynchronously
    const translatedTokens = await Promise.all(
      tokens.map(async (token) => {
        if (!token || /^\s+$/.test(token) || /^[^\w\s]+$/.test(token)) {
          return token;
        }

        const cleanWord = token.toLowerCase();

        // Strip articles and prepositions
        if (STOP_WORDS.has(cleanWord)) {
          return '';
        }

        const stem = getStem(cleanWord);
        let resultToken = token;

        // Mode 1: PIE only
        if (selectedMode === 'pie') {
          const res = findBestMatch(cleanWord, stem, PIE_DICTIONARY, threshold);
          if (res.bestValue) resultToken = res.bestValue;
        }

        // Mode 2: Latin only
        else if (selectedMode === 'latin') {
          const res = findBestMatch(cleanWord, stem, LATIN_DICTIONARY, threshold);
          if (res.bestValue) resultToken = res.bestValue;
        }

        // Mode 3: Both
        else if (selectedMode === 'both') {
          const pieRes = hasPIE ? findBestMatch(cleanWord, stem, PIE_DICTIONARY, threshold) : { bestValue: null };
          const latinRes = hasLatin ? findBestMatch(cleanWord, stem, LATIN_DICTIONARY, threshold) : { bestValue: null };

          if (pieRes.bestValue && latinRes.bestValue) {
            const num = await fetchModNumber();
            const wordMod = Math.abs(num) % 2; // 1 = PIE, 0 = Latin
            resultToken = wordMod === 1 ? pieRes.bestValue : latinRes.bestValue;
          } else if (pieRes.bestValue) {
            resultToken = pieRes.bestValue;
          } else if (latinRes.bestValue) {
            resultToken = latinRes.bestValue;
          }
        }

        // If a word match occurred, evaluate pickle_surprise before returning
        if (resultToken !== token) {
          return await pickle_surprise(resultToken, 0.5);
        }

        return resultToken;
      })
    );

    // Filter down to valid words/tokens
    let wordList = translatedTokens
      .filter(t => t && t.trim().length > 0);

    // Interleave 1 random English cognate from top_english_words between each word
    wordList = await interleaveCognateWords(wordList);

    const translatedSentence = wordList
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();

    resultsDiv.innerHTML = `<p style="font-size: 1.1rem; line-height: 1.6;">${translatedSentence}</p>`;
  });
});