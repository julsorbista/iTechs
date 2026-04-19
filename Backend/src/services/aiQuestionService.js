const DEFAULT_REQUEST_TIMEOUT_MS = 60000;
const MIN_REQUEST_TIMEOUT_MS = 10000;
const MAX_REQUEST_TIMEOUT_MS = 180000;
const MIN_OUTPUT_TOKENS = 1200;
const MAX_OUTPUT_TOKENS = 7000;
const OUTPUT_TEXT_PREVIEW_LIMIT = 220;
const DEFAULT_AI_PROVIDER = 'gemini';
const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';
const DEFAULT_DEEPSEEK_MODEL = 'deepseek-chat';
const SUPPORTED_AI_PROVIDERS = new Set(['gemini', 'deepseek']);
const MAX_QUESTION_TEXT_LENGTH = 180;
const MAX_FORMATTED_QUESTION_LENGTH = 260;
const MAX_QUESTION_LEAD_LENGTH = 120;
const MAX_QUESTION_ASK_LENGTH = 140;
const MAX_QUESTION_CONTEXT_LINES = 4;
const MAX_QUESTION_CONTEXT_LINE_LENGTH = 84;
const MAX_CHOICE_TEXT_LENGTH = 90;
const MAX_HINT_TEXT_LENGTH = 120;
const MAX_EXPLANATION_TEXT_LENGTH = 220;

const SINGLE_QUESTION_SCHEMA = {
  type: 'OBJECT',
  properties: {
    question: { type: 'STRING' },
    questionLead: { type: 'STRING' },
    questionContextLines: {
      type: 'ARRAY',
      items: { type: 'STRING' },
    },
    questionAsk: { type: 'STRING' },
    choices: {
      type: 'ARRAY',
      items: { type: 'STRING' },
    },
    answerIndex: { type: 'INTEGER' },
    explanation: { type: 'STRING' },
    hints: {
      type: 'ARRAY',
      items: { type: 'STRING' },
    },
    difficulty: { type: 'STRING' },
  },
  required: ['question', 'choices', 'answerIndex', 'explanation', 'hints'],
};

const QUESTION_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    questions: {
      type: 'ARRAY',
      items: SINGLE_QUESTION_SCHEMA,
    },
  },
  required: ['questions'],
};

const STATUE_BATCH_QUESTION_SCHEMA = {
  type: 'OBJECT',
  properties: {
    questionId: { type: 'STRING' },
    question: { type: 'STRING' },
    questionLead: { type: 'STRING' },
    questionContextLines: {
      type: 'ARRAY',
      items: { type: 'STRING' },
    },
    questionAsk: { type: 'STRING' },
    choices: {
      type: 'ARRAY',
      items: { type: 'STRING' },
    },
    answerIndex: { type: 'INTEGER' },
    explanation: { type: 'STRING' },
    hints: {
      type: 'ARRAY',
      items: { type: 'STRING' },
    },
    difficulty: { type: 'STRING' },
  },
  required: ['questionId', 'question', 'choices', 'answerIndex', 'explanation', 'hints'],
};

const STATUE_BATCH_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    questions: {
      type: 'ARRAY',
      items: STATUE_BATCH_QUESTION_SCHEMA,
    },
  },
  required: ['questions'],
};

const safeJsonParse = (value) => {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const clampNumber = (value, min, max) => Math.min(max, Math.max(min, value));

const normalizeAIProvider = (value = '') => {
  const normalized = String(value || '').trim().toLowerCase();
  if (SUPPORTED_AI_PROVIDERS.has(normalized)) {
    return normalized;
  }

  return DEFAULT_AI_PROVIDER;
};

const resolveAIProvider = () => normalizeAIProvider(
  process.env.AI_PROVIDER
  || process.env.LLM_PROVIDER
  || DEFAULT_AI_PROVIDER,
);

const resolveGeminiModel = () => (process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL).trim();

const resolveDeepSeekModel = () => (process.env.DEEPSEEK_MODEL || DEFAULT_DEEPSEEK_MODEL).trim();

const resolveDeepSeekUrl = () => {
  const rawUrl = String(process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/v1').trim();
  const normalizedBase = rawUrl.replace(/\/$/, '');

  if (normalizedBase.endsWith('/chat/completions')) {
    return normalizedBase;
  }

  return `${normalizedBase}/chat/completions`;
};

const resolveAIClientConfig = () => {
  const provider = resolveAIProvider();

  if (provider === 'deepseek') {
    const apiKey = String(
      process.env.DEEPSEEK_API_KEY
      || process.env.OPENAI_API_KEY
      || process.env.API_KEY
      || '',
    ).trim();

    if (!apiKey) {
      throw new Error('Missing DEEPSEEK_API_KEY (or API_KEY). Add it to Backend/.env.');
    }

    return {
      provider,
      providerLabel: 'DeepSeek',
      apiKey,
      model: resolveDeepSeekModel(),
      url: resolveDeepSeekUrl(),
    };
  }

  const apiKey = String(process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) {
    throw new Error('Missing GEMINI_API_KEY. Add it to Backend/.env.');
  }

  const configuredModel = resolveGeminiModel();
  const normalizedModel = configuredModel.startsWith('models/')
    ? configuredModel.slice('models/'.length)
    : configuredModel;

  const endpointRoot = (process.env.GEMINI_API_URL || 'https://generativelanguage.googleapis.com/v1beta/models').replace(/\/$/, '');

  return {
    provider,
    providerLabel: 'Gemini',
    apiKey,
    model: configuredModel,
    url: `${endpointRoot}/${encodeURIComponent(normalizedModel)}:generateContent?key=${encodeURIComponent(apiKey)}`,
  };
};

const resolveRequestTimeoutMs = () => {
  const parsed = Number.parseInt(process.env.GEMINI_REQUEST_TIMEOUT_MS || '', 10);
  if (!Number.isInteger(parsed)) {
    return DEFAULT_REQUEST_TIMEOUT_MS;
  }

  return clampNumber(parsed, MIN_REQUEST_TIMEOUT_MS, MAX_REQUEST_TIMEOUT_MS);
};

const resolveMaxOutputTokens = (questionCount) => {
  const explicit = Number.parseInt(process.env.GEMINI_MAX_OUTPUT_TOKENS || '', 10);
  if (Number.isInteger(explicit)) {
    return clampNumber(explicit, MIN_OUTPUT_TOKENS, MAX_OUTPUT_TOKENS);
  }

  const parsedCount = Number.parseInt(questionCount || 5, 10);
  const normalizedCount = Number.isInteger(parsedCount) ? parsedCount : 5;
  return clampNumber((normalizedCount * 420) + 1200, MIN_OUTPUT_TOKENS, MAX_OUTPUT_TOKENS);
};

const escapeControlCharsInStrings = (rawText = '') => {
  let output = '';
  let inString = false;
  let isEscaped = false;

  for (let index = 0; index < rawText.length; index += 1) {
    const char = rawText[index];

    if (inString) {
      if (isEscaped) {
        output += char;
        isEscaped = false;
        continue;
      }

      if (char === '\\') {
        output += char;
        isEscaped = true;
        continue;
      }

      if (char === '"') {
        output += char;
        inString = false;
        continue;
      }

      if (char === '\n') {
        output += '\\n';
        continue;
      }

      if (char === '\r') {
        output += '\\r';
        continue;
      }

      if (char === '\t') {
        output += '\\t';
        continue;
      }

      output += char;
      continue;
    }

    if (char === '"') {
      inString = true;
    }

    output += char;
  }

  return output;
};

const parseJsonCandidate = (candidate = '') => {
  const rawCandidate = String(candidate || '').trim();
  if (!rawCandidate) {
    return null;
  }

  // Gemini sometimes adds trailing commas and literal control characters inside strings.
  const withoutTrailingCommas = rawCandidate.replace(/,\s*([}\]])/g, '$1');
  const escapedControlChars = escapeControlCharsInStrings(withoutTrailingCommas);

  const candidates = [rawCandidate, withoutTrailingCommas, escapedControlChars];

  for (const entry of candidates) {
    const parsed = safeJsonParse(entry);
    if (parsed !== null) {
      return parsed;
    }
  }

  return null;
};

const extractBalancedObjectSlice = (text = '') => {
  let startIndex = -1;
  let depth = 0;
  let inString = false;
  let isEscaped = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (startIndex < 0) {
      if (char === '{') {
        startIndex = index;
        depth = 1;
      }
      continue;
    }

    if (inString) {
      if (isEscaped) {
        isEscaped = false;
        continue;
      }

      if (char === '\\') {
        isEscaped = true;
        continue;
      }

      if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === '{') {
      depth += 1;
      continue;
    }

    if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return text.slice(startIndex, index + 1);
      }
    }
  }

  return '';
};

const extractAllBalancedObjectSlices = (text = '') => {
  const slices = [];
  const stack = [];
  let inString = false;
  let isEscaped = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (inString) {
      if (isEscaped) {
        isEscaped = false;
        continue;
      }

      if (char === '\\') {
        isEscaped = true;
        continue;
      }

      if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === '{') {
      stack.push(index);
      continue;
    }

    if (char === '}' && stack.length > 0) {
      const startIndex = stack.pop();
      slices.push(text.slice(startIndex, index + 1));
    }
  }

  return slices;
};

const extractQuestionCandidatesFromText = (text = '') => {
  const candidates = [];

  extractAllBalancedObjectSlices(text).forEach((slice) => {
    const parsed = parseJsonCandidate(slice);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return;
    }

    if (Array.isArray(parsed.questions)) {
      parsed.questions.forEach((entry) => {
        candidates.push(entry);
      });
      return;
    }

    if (Object.prototype.hasOwnProperty.call(parsed, 'question') && Object.prototype.hasOwnProperty.call(parsed, 'choices')) {
      candidates.push(parsed);
    }
  });

  return candidates;
};

const extractJsonObject = (text = '') => {
  const fencedMatch = text.match(/```json\s*([\s\S]*?)\s*```/i) || text.match(/```\s*([\s\S]*?)\s*```/);
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  const balancedSlice = extractBalancedObjectSlice(text);

  const candidates = [
    text,
    fencedMatch?.[1] || '',
    balancedSlice,
    start >= 0 && end > start ? text.slice(start, end + 1) : '',
  ].filter(Boolean);

  for (const candidate of candidates) {
    const parsed = parseJsonCandidate(candidate);

    if (Array.isArray(parsed)) {
      return parsed;
    }

    if (parsed && typeof parsed === 'object') {
      return parsed;
    }

    // Some responses are JSON strings containing an object payload.
    if (typeof parsed === 'string') {
      const parsedNested = parseJsonCandidate(parsed);
      if (Array.isArray(parsedNested)) {
        return parsedNested;
      }

      if (parsedNested && typeof parsedNested === 'object') {
        return parsedNested;
      }
    }
  }

  return null;
};

const normalizeDifficulty = (value = '') => {
  const parsed = String(value).trim().toLowerCase();
  if (parsed === 'easy' || parsed === 'medium' || parsed === 'hard') {
    return parsed;
  }

  return 'medium';
};

const toLineArray = (value) => {
  if (Array.isArray(value)) {
    return value
      .map((line) => (typeof line === 'string' ? line.trim() : ''))
      .filter(Boolean);
  }

  if (typeof value === 'string' && value.trim()) {
    return value
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  }

  return [];
};

const cleanSentence = (value = '') => String(value || '').replace(/\s+/g, ' ').trim();

const truncateText = (value = '', maxLength = 180) => {
  const source = String(value || '').trim();
  if (!source || source.length <= maxLength) {
    return source;
  }

  const safeLength = Math.max(1, maxLength - 3);
  return `${source.slice(0, safeLength).trimEnd()}...`;
};

const truncateLineArray = (value = [], maxLines = 4, maxLineLength = 84) => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .slice(0, maxLines)
    .map((line) => truncateText(line, maxLineLength))
    .filter(Boolean);
};

const autoFormatQuestionText = (value = '') => {
  const source = cleanSentence(value);
  if (!source) {
    return '';
  }

  const hasCodeLikeTokens = /\b(FOR|IF|ELSE|WHILE|RETURN|FUNCTION|THEN)\b/.test(source) || source.includes('=');
  if (!hasCodeLikeTokens) {
    return source;
  }

  let formatted = source;

  formatted = formatted.replace(/\s+(FOR|IF|ELSE IF|ELSE|WHILE|RETURN|FUNCTION|THEN)\b/g, '\n$1');
  formatted = formatted.replace(/:\s+(?=[A-Za-z0-9])/g, ':\n');
  formatted = formatted.replace(/\n{3,}/g, '\n\n');

  return formatted.trim();
};

const buildFormattedQuestion = ({
  question,
  questionLead,
  questionContextLines,
  questionAsk,
}) => {
  const lead = truncateText(cleanSentence(questionLead), MAX_QUESTION_LEAD_LENGTH);
  const askRaw = truncateText(cleanSentence(questionAsk), MAX_QUESTION_ASK_LENGTH);
  const ask = askRaw && !askRaw.endsWith('?') ? `${askRaw}?` : askRaw;
  const contextLines = truncateLineArray(
    toLineArray(questionContextLines),
    MAX_QUESTION_CONTEXT_LINES,
    MAX_QUESTION_CONTEXT_LINE_LENGTH,
  );

  if (lead || contextLines.length > 0 || ask) {
    const segments = [];
    if (lead) {
      segments.push(lead);
    }

    if (contextLines.length > 0) {
      segments.push(contextLines.join('\n'));
    }

    if (ask) {
      segments.push(ask);
    }

    return {
      formattedQuestion: truncateText(segments.join('\n\n').trim(), MAX_FORMATTED_QUESTION_LENGTH),
      questionDisplay: {
        lead,
        contextLines,
        ask,
      },
    };
  }

  return {
    formattedQuestion: truncateText(autoFormatQuestionText(question), MAX_FORMATTED_QUESTION_LENGTH),
    questionDisplay: {
      lead: '',
      contextLines: [],
      ask: '',
    },
  };
};

const normalizeHints = (candidateHints, questionText) => {
  const providedHints = Array.isArray(candidateHints)
    ? candidateHints
      .map((hint) => (typeof hint === 'string' ? hint.trim() : ''))
      .filter(Boolean)
      .slice(0, 2)
    : [];

  const hasCodeLikeContext = /\b(FOR|IF|ELSE|WHILE|RETURN|FUNCTION|THEN)\b/.test(questionText || '') || String(questionText || '').includes('=');
  const fallbackHints = hasCodeLikeContext
    ? [
      'Track the variable value after each step.',
      'Check the condition result for each loop iteration.',
    ]
    : [
      'Focus on the key concept asked in the question.',
      'Eliminate clearly incorrect choices first.',
    ];

  const merged = [...providedHints];
  for (const hint of fallbackHints) {
    if (merged.length >= 2) {
      break;
    }

    if (!merged.includes(hint)) {
      merged.push(hint);
    }
  }

  return merged
    .slice(0, 2)
    .map((hint) => truncateText(hint, MAX_HINT_TEXT_LENGTH))
    .filter(Boolean);
};

const sanitizeQuestionPayload = (payload, fallback) => {
  const questionRaw = typeof payload?.question === 'string' ? payload.question.trim() : '';
  const question = truncateText(questionRaw, MAX_QUESTION_TEXT_LENGTH);
  const choices = Array.isArray(payload?.choices)
    ? payload.choices
      .map((choice) => truncateText(typeof choice === 'string' ? choice.trim() : '', MAX_CHOICE_TEXT_LENGTH))
      .filter(Boolean)
    : [];

  let answerIndex = Number.isInteger(payload?.answerIndex) ? payload.answerIndex : -1;

  if (answerIndex < 0 || answerIndex >= choices.length) {
    const answer = typeof payload?.answer === 'string' ? payload.answer.trim() : '';
    if (answer) {
      const matchedIndex = choices.findIndex((choice) => choice.toLowerCase() === answer.toLowerCase());
      answerIndex = matchedIndex;
    }
  }

  const explanation = truncateText(
    typeof payload?.explanation === 'string' ? payload.explanation.trim() : '',
    MAX_EXPLANATION_TEXT_LENGTH,
  );

  if (!question || choices.length < 2 || answerIndex < 0 || answerIndex >= choices.length) {
    throw new Error('Gemini returned an invalid question format. Please try again with a clearer prompt.');
  }

  const questionParts = buildFormattedQuestion({
    question,
    questionLead: payload?.questionLead,
    questionContextLines: payload?.questionContextLines,
    questionAsk: payload?.questionAsk,
  });

  const formattedQuestion = truncateText(questionParts.formattedQuestion || question, MAX_FORMATTED_QUESTION_LENGTH);
  const hints = normalizeHints(payload?.hints, formattedQuestion || question);

  return {
    question,
    formattedQuestion,
    questionDisplay: questionParts.questionDisplay,
    choices,
    answerIndex,
    correctAnswer: choices[answerIndex],
    explanation: explanation || 'No explanation provided by Gemini.',
    hints,
    meta: {
      topic: fallback.topic,
      difficulty: normalizeDifficulty(payload?.difficulty || fallback.difficulty),
      gradeLevel: fallback.gradeLevel || null,
      questionType: fallback.questionType,
      language: fallback.language,
    },
  };
};

const normalizeQuestionBatch = (payload, fallback) => {
  const rawQuestions = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.questions)
      ? payload.questions
      : payload && typeof payload === 'object'
        ? [payload]
        : [];

  const normalizedQuestions = [];

  for (const candidate of rawQuestions) {
    try {
      const normalized = sanitizeQuestionPayload(candidate, fallback);
      normalizedQuestions.push(normalized);
    } catch {
      // Skip malformed entries and keep valid ones.
    }
  }

  if (normalizedQuestions.length === 0) {
    throw new Error('Gemini returned no valid questions.');
  }

  return normalizedQuestions;
};

const normalizeQuestionsFromText = (text, fallback) => {
  const candidates = extractQuestionCandidatesFromText(text);
  const normalizedQuestions = [];
  const seenQuestionKeys = new Set();

  for (const candidate of candidates) {
    try {
      const normalized = sanitizeQuestionPayload(candidate, fallback);
      const key = normalized.question.toLowerCase();
      if (seenQuestionKeys.has(key)) {
        continue;
      }

      seenQuestionKeys.add(key);
      normalizedQuestions.push(normalized);
    } catch {
      // Ignore malformed partial question candidates.
    }
  }

  return normalizedQuestions;
};

const normalizeStatueQuestionId = (value) => {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim().slice(0, 80);
};

const normalizeStatueBatchPayload = (payload, fallbackByQuestionId = new Map()) => {
  const rawQuestions = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.questions)
      ? payload.questions
      : payload && typeof payload === 'object'
        ? [payload]
        : [];

  const normalizedByQuestionId = new Map();

  for (const candidate of rawQuestions) {
    const questionId = normalizeStatueQuestionId(candidate?.questionId);
    if (!questionId || normalizedByQuestionId.has(questionId) || !fallbackByQuestionId.has(questionId)) {
      continue;
    }

    try {
      const normalized = sanitizeQuestionPayload(candidate, fallbackByQuestionId.get(questionId));
      normalizedByQuestionId.set(questionId, {
        ...normalized,
        questionId,
      });
    } catch {
      // Skip malformed entries and keep valid ones.
    }
  }

  return normalizedByQuestionId;
};

const normalizeStatueBatchFromText = (text, fallbackByQuestionId = new Map()) => {
  const candidates = extractQuestionCandidatesFromText(text);
  const normalizedByQuestionId = new Map();

  for (const candidate of candidates) {
    const questionId = normalizeStatueQuestionId(candidate?.questionId);
    if (!questionId || normalizedByQuestionId.has(questionId) || !fallbackByQuestionId.has(questionId)) {
      continue;
    }

    try {
      const normalized = sanitizeQuestionPayload(candidate, fallbackByQuestionId.get(questionId));
      normalizedByQuestionId.set(questionId, {
        ...normalized,
        questionId,
      });
    } catch {
      // Skip malformed entries and keep valid ones.
    }
  }

  return normalizedByQuestionId;
};

const mergeStatueQuestionMaps = (baseMap = new Map(), incomingMap = new Map(), orderedQuestionIds = []) => {
  const merged = new Map(baseMap);

  for (const questionId of orderedQuestionIds) {
    if (merged.has(questionId) || !incomingMap.has(questionId)) {
      continue;
    }

    merged.set(questionId, incomingMap.get(questionId));
  }

  return merged;
};

const mergeUniqueQuestions = (baseQuestions = [], incomingQuestions = [], limit = Infinity) => {
  const merged = [...baseQuestions];
  const seenKeys = new Set(
    baseQuestions
      .map((question) => String(question?.question || '').trim().toLowerCase())
      .filter(Boolean),
  );

  for (const question of incomingQuestions) {
    if (merged.length >= limit) {
      break;
    }

    const key = String(question?.question || '').trim().toLowerCase();
    if (!key || seenKeys.has(key)) {
      continue;
    }

    seenKeys.add(key);
    merged.push(question);
  }

  return merged.slice(0, limit);
};

const buildPrompt = ({
  topic,
  difficulty,
  gradeLevel,
  questionType,
  language,
  instructions,
  choicesCount,
  questionCount,
}) => {
  const optionalGrade = gradeLevel ? `Target grade level: ${gradeLevel}.` : '';
  const optionalInstructions = instructions ? `Extra instructions: ${instructions}` : '';

  return [
    'You are creating a clean classroom-ready question for an educational game.',
    `Create exactly ${questionCount} ${questionType} questions about: ${topic}.`,
    `Each question must be short, clear, and understandable (keep the displayed prompt concise).`,
    `Difficulty: ${difficulty}.`,
    optionalGrade,
    `Language: ${language}.`,
    `Return exactly ${choicesCount} answer choices per question.`,
    optionalInstructions,
    'Return strict JSON only using this schema:',
    '{',
    '  "questions": [',
    '    {',
    '      "question": "string",',
    '      "questionLead": "string",',
    '      "questionContextLines": ["string", "..."],',
    '      "questionAsk": "string",',
    '      "choices": ["string", "string", "..."],',
    '      "answerIndex": 0,',
    '      "explanation": "string",',
    '      "hints": ["string", "string"],',
    '      "difficulty": "easy|medium|hard"',
    '    }',
    '  ]',
    '}',
    'Formatting rules:',
    '- questionLead: short context sentence with minimal filler words.',
    '- questionContextLines: one logical step per line.',
    '- If code or pseudocode is used, put code only in questionContextLines.',
    '- questionAsk: one final explicit question ending with ?.',
    '- question: full human-readable version using line breaks between lead, context block, and ask.',
    '- hints must contain exactly 2 short hints per question.',
    '- Keep choices concise and avoid long paragraphs.',
    'Do not wrap the JSON in markdown fences and do not include additional keys.',
    'Do not add any prose before or after the JSON object.',
  ]
    .filter(Boolean)
    .join('\n');
};

const buildStatueBatchPrompt = ({ statues = [] }) => {
  const normalizedStatues = Array.isArray(statues) ? statues : [];

  const statueLines = normalizedStatues.map((statue, index) => [
    `Statue ${index + 1}:`,
    `- questionId: ${statue.questionId}`,
    `- topic: ${statue.topic}`,
    `- choicesCount: ${statue.choicesCount}`,
    `- difficulty: ${statue.difficulty}`,
    `- language: ${statue.language}`,
    `- gradeLevel: ${statue.gradeLevel || '(none)'}`,
    `- extraInstructions: ${statue.instructions || '(none)'}`,
  ].join('\n'));

  return [
    'You are creating classroom-ready multiple-choice questions for game statues.',
    `Generate exactly ${normalizedStatues.length} questions, one per statue specification below.`,
    'Each output question must keep the same questionId from the input.',
    'Return strict JSON only using this schema:',
    '{',
    '  "questions": [',
    '    {',
    '      "questionId": "string",',
    '      "question": "string",',
    '      "questionLead": "string",',
    '      "questionContextLines": ["string", "..."],',
    '      "questionAsk": "string",',
    '      "choices": ["string", "string", "..."],',
    '      "answerIndex": 0,',
    '      "explanation": "string",',
    '      "hints": ["string", "string"],',
    '      "difficulty": "easy|medium|hard"',
    '    }',
    '  ]',
    '}',
    'Rules:',
    '- Use each questionId exactly once.',
    '- choices length must match choicesCount for that statue.',
    '- hints must contain exactly 2 short hints per question.',
    '- Keep question text concise and classroom-appropriate.',
    '- Do not wrap JSON in markdown.',
    '- Do not output extra keys or extra prose.',
    '',
    'Statue specifications:',
    ...statueLines,
  ].join('\n');
};

const shouldRetryWithoutSchema = (errorMessage = '') => {
  const normalized = String(errorMessage).toLowerCase();
  return normalized.includes('responseschema')
    || normalized.includes('unknown name "responseschema"')
    || normalized.includes('cannot find field "responseschema"');
};

const isRetryableGeminiError = (error) => {
  const statusCode = Number(error?.statusCode);
  if (error?.retryable) {
    return true;
  }

  return [408, 429, 500, 502, 503, 504].includes(statusCode);
};

const collectOutputTextFromResponse = (parsedResponse = {}, provider = DEFAULT_AI_PROVIDER) => {
  if (provider === 'deepseek') {
    return (parsedResponse?.choices || [])
      .map((choice) => choice?.message?.content)
      .filter(Boolean)
      .join('\n')
      .trim();
  }

  return (parsedResponse?.candidates || [])
    .flatMap((candidate) => candidate?.content?.parts || [])
    .map((part) => part?.text)
    .filter(Boolean)
    .join('\n')
    .trim();
};

const requestAiContent = async ({
  providerConfig,
  prompt,
  temperature,
  includeResponseSchema,
  responseSchema = QUESTION_RESPONSE_SCHEMA,
  timeoutMs,
  maxOutputTokens,
}) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const isGeminiProvider = providerConfig.provider === 'gemini';

  try {
    const headers = {
      'Content-Type': 'application/json',
    };

    const requestBody = isGeminiProvider
      ? {
          contents: [
            {
              role: 'user',
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            temperature,
            topP: 0.8,
            maxOutputTokens,
            responseMimeType: 'application/json',
            ...(includeResponseSchema ? { responseSchema } : {}),
          },
        }
      : {
          model: providerConfig.model,
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature,
          top_p: 0.8,
          max_tokens: maxOutputTokens,
          response_format: {
            type: 'json_object',
          },
        };

    if (!isGeminiProvider) {
      headers.Authorization = `Bearer ${providerConfig.apiKey}`;
    }

    const response = await fetch(providerConfig.url, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    const rawResponse = await response.text();
    const parsedResponse = safeJsonParse(rawResponse) || {};

    if (!response.ok) {
      const apiMessage = parsedResponse?.error?.message
        || parsedResponse?.message
        || `${providerConfig.providerLabel} request failed with status ${response.status}`;
      const error = new Error(apiMessage);
      error.statusCode = response.status;
      error.retryable = [408, 429, 500, 502, 503, 504].includes(response.status);
      throw error;
    }

    const outputText = collectOutputTextFromResponse(parsedResponse, providerConfig.provider);
    return {
      outputText,
      parsedResponse,
    };
  } catch (error) {
    if (error.name === 'AbortError') {
      const timeoutError = new Error(`${providerConfig.providerLabel} request timed out after ${Math.round(timeoutMs / 1000)}s. Please try again.`);
      timeoutError.code = 'GEMINI_TIMEOUT';
      timeoutError.statusCode = 504;
      timeoutError.retryable = true;
      throw timeoutError;
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
};

const requestAIWithFallback = async ({
  providerConfig,
  prompt,
  temperature,
  timeoutMs,
  maxOutputTokens,
  responseSchema = QUESTION_RESPONSE_SCHEMA,
}) => {
  try {
    return await requestAiContent({
      providerConfig,
      prompt,
      temperature,
      includeResponseSchema: true,
      responseSchema,
      timeoutMs,
      maxOutputTokens,
    });
  } catch (error) {
    const canRetryWithoutSchema = providerConfig.provider === 'gemini' && shouldRetryWithoutSchema(error.message);
    if (!canRetryWithoutSchema && !isRetryableGeminiError(error)) {
      throw error;
    }

    const relaxedTokenBudget = clampNumber(Math.floor(maxOutputTokens * 0.85), 900, maxOutputTokens);

    try {
      return await requestAiContent({
        providerConfig,
        prompt,
        temperature,
        includeResponseSchema: false,
        responseSchema,
        timeoutMs,
        maxOutputTokens: relaxedTokenBudget,
      });
    } catch (retryError) {
      if (!isRetryableGeminiError(retryError)) {
        throw retryError;
      }

      return requestAiContent({
        providerConfig,
        prompt,
        temperature: Math.min(temperature, 0.1),
        includeResponseSchema: false,
        responseSchema,
        timeoutMs: clampNumber(timeoutMs + 15000, MIN_REQUEST_TIMEOUT_MS, MAX_REQUEST_TIMEOUT_MS),
        maxOutputTokens: relaxedTokenBudget,
      });
    }
  }
};

const generateQuestionWithGemini = async ({
  topic,
  difficulty,
  gradeLevel,
  questionType,
  language,
  instructions,
  choicesCount,
  questionCount,
}) => {
  if (typeof fetch !== 'function') {
    throw new Error('Fetch API is not available in this Node runtime. Use Node 18+ to call the AI provider.');
  }

  const providerConfig = resolveAIClientConfig();
  const requestTimeoutMs = resolveRequestTimeoutMs();
  const maxOutputTokens = resolveMaxOutputTokens(questionCount);
  const fallbackMeta = {
    topic,
    difficulty,
    gradeLevel,
    questionType,
    language,
  };

  const prompt = buildPrompt({
    topic,
    difficulty,
    gradeLevel,
    questionType,
    language,
    instructions,
    choicesCount,
    questionCount,
  });

  const retryPrompt = [
    prompt,
    'Your last answer was invalid or incomplete.',
    `Return exactly ${questionCount} valid questions in one strict JSON object with no markdown and no extra text.`,
    'Keep each field concise so the JSON is not truncated.',
  ].join('\n\n');

  const compactRetryPrompt = [
    prompt,
    `Return exactly ${questionCount} valid questions.`,
    'Keep the question prompt under 130 characters when possible.',
    'Keep explanation and hints very short.',
    'Respond with strict compact JSON only and no markdown.',
  ].join('\n\n');

  const attemptPlans = [
    {
      prompt,
      temperature: 0.2,
      maxOutputTokens,
    },
    {
      prompt: retryPrompt,
      temperature: 0,
      maxOutputTokens: clampNumber(maxOutputTokens + 1200, MIN_OUTPUT_TOKENS, MAX_OUTPUT_TOKENS),
    },
    {
      prompt: compactRetryPrompt,
      temperature: 0,
      maxOutputTokens: clampNumber(maxOutputTokens + 2200, MIN_OUTPUT_TOKENS, MAX_OUTPUT_TOKENS),
    },
  ];

  let bestNormalizedQuestions = [];
  let bestParsedQuestion = null;
  let lastOutputText = '';

  for (const attemptPlan of attemptPlans) {
    const attemptResult = await requestAIWithFallback({
      providerConfig,
      prompt: attemptPlan.prompt,
      temperature: attemptPlan.temperature,
      timeoutMs: requestTimeoutMs,
      maxOutputTokens: attemptPlan.maxOutputTokens,
    });

    const outputText = String(attemptResult.outputText || '');
    lastOutputText = outputText;
    if (!outputText) {
      continue;
    }

    const parsedQuestion = extractJsonObject(outputText);
    let normalizedQuestions = [];

    if (parsedQuestion) {
      try {
        normalizedQuestions = normalizeQuestionBatch(parsedQuestion, fallbackMeta);
      } catch {
        normalizedQuestions = [];
      }
    }

    if (normalizedQuestions.length === 0) {
      normalizedQuestions = normalizeQuestionsFromText(outputText, fallbackMeta);
    }

    if (normalizedQuestions.length > bestNormalizedQuestions.length) {
      bestNormalizedQuestions = normalizedQuestions;
      bestParsedQuestion = parsedQuestion;
    }

    if (normalizedQuestions.length >= questionCount) {
      const normalized = normalizedQuestions.slice(0, questionCount);
      return {
        questions: normalized,
        requestedQuestionCount: questionCount,
        generatedQuestionCount: normalized.length,
        raw: parsedQuestion || { questions: normalized },
        model: providerConfig.model,
      };
    }
  }

  if (bestNormalizedQuestions.length > 0 && bestNormalizedQuestions.length < questionCount) {
    const remainingCount = questionCount - bestNormalizedQuestions.length;
    const existingQuestionsText = bestNormalizedQuestions
      .map((question, index) => `${index + 1}. ${question.question}`)
      .join('\n');

    const fillInstructions = [
      instructions,
      'Do not repeat these existing questions:',
      existingQuestionsText,
      'Keep text concise to avoid truncation.',
    ]
      .filter(Boolean)
      .join('\n');

    const fillPrompt = buildPrompt({
      topic,
      difficulty,
      gradeLevel,
      questionType,
      language,
      instructions: fillInstructions,
      choicesCount,
      questionCount: remainingCount,
    });

    try {
      const fillAttempt = await requestAIWithFallback({
        providerConfig,
        prompt: fillPrompt,
        temperature: 0,
        timeoutMs: requestTimeoutMs,
        maxOutputTokens: clampNumber(maxOutputTokens + 1400, MIN_OUTPUT_TOKENS, MAX_OUTPUT_TOKENS),
      });

      const fillOutput = String(fillAttempt.outputText || '');
      if (fillOutput) {
        const fillParsed = extractJsonObject(fillOutput);
        let fillQuestions = [];

        if (fillParsed) {
          try {
            fillQuestions = normalizeQuestionBatch(fillParsed, fallbackMeta);
          } catch {
            fillQuestions = [];
          }
        }

        if (fillQuestions.length === 0) {
          fillQuestions = normalizeQuestionsFromText(fillOutput, fallbackMeta);
        }

        const mergedQuestions = mergeUniqueQuestions(
          bestNormalizedQuestions,
          fillQuestions,
          questionCount,
        );

        if (mergedQuestions.length > bestNormalizedQuestions.length) {
          bestNormalizedQuestions = mergedQuestions;
          bestParsedQuestion = fillParsed || bestParsedQuestion;
          lastOutputText = fillOutput;
        }
      }
    } catch {
      // Ignore fill pass failures and use best recovered questions.
    }
  }

  if (bestNormalizedQuestions.length >= questionCount) {
    const normalized = bestNormalizedQuestions.slice(0, questionCount);
    return {
      questions: normalized,
      requestedQuestionCount: questionCount,
      generatedQuestionCount: normalized.length,
      raw: bestParsedQuestion || { questions: normalized },
      model: providerConfig.model,
    };
  }

  if (questionCount === 1 && bestNormalizedQuestions.length > 0) {
    const normalized = bestNormalizedQuestions.slice(0, 1);
    return {
      questions: normalized,
      requestedQuestionCount: 1,
      generatedQuestionCount: normalized.length,
      raw: bestParsedQuestion || { questions: normalized },
      model: providerConfig.model,
    };
  }

  const preview = String(lastOutputText || '')
    .slice(0, OUTPUT_TEXT_PREVIEW_LIMIT)
    .replace(/\s+/g, ' ')
    .trim();

  if (bestNormalizedQuestions.length > 0) {
    throw new Error(`Gemini returned only ${bestNormalizedQuestions.length}/${questionCount} valid questions. Preview: ${preview}`);
  }

  throw new Error(`Gemini response was not valid JSON. Preview: ${preview}`);
};

const generateSingleQuestionWithGemini = async ({
  topic,
  difficulty = 'medium',
  gradeLevel = '',
  questionType = 'multiple-choice',
  language = 'English',
  instructions = '',
  choicesCount = 4,
}) => {
  const payload = await generateQuestionWithGemini({
    topic,
    difficulty,
    gradeLevel,
    questionType,
    language,
    instructions,
    choicesCount,
    questionCount: 1,
  });

  return {
    question: payload.questions[0],
    raw: payload.raw,
    model: payload.model,
  };
};

const generateStatueQuestionsWithGemini = async ({ statues = [] } = {}) => {
  if (typeof fetch !== 'function') {
    throw new Error('Fetch API is not available in this Node runtime. Use Node 18+ to call the AI provider.');
  }

  const providerConfig = resolveAIClientConfig();

  const normalizedStatues = (Array.isArray(statues) ? statues : [])
    .map((entry) => {
      const questionId = normalizeStatueQuestionId(entry?.questionId);
      const topic = typeof entry?.topic === 'string' ? entry.topic.trim().slice(0, 140) : '';

      if (!questionId || !topic) {
        return null;
      }

      const choicesCountRaw = Number.parseInt(entry?.choicesCount, 10);
      const choicesCount = Number.isInteger(choicesCountRaw)
        ? clampNumber(choicesCountRaw, 2, 6)
        : 4;

      return {
        questionId,
        topic,
        choicesCount,
        difficulty: normalizeDifficulty(entry?.difficulty || 'medium'),
        gradeLevel: typeof entry?.gradeLevel === 'string' ? entry.gradeLevel.trim().slice(0, 40) : '',
        language: typeof entry?.language === 'string' && entry.language.trim()
          ? entry.language.trim().slice(0, 40)
          : 'English',
        instructions: typeof entry?.instructions === 'string' ? entry.instructions.trim().slice(0, 500) : '',
      };
    })
    .filter(Boolean)
    .filter((entry, index, array) => array.findIndex((candidate) => candidate.questionId === entry.questionId) === index);

  if (normalizedStatues.length === 0) {
    return {
      questionsById: {},
      requestedQuestionCount: 0,
      generatedQuestionCount: 0,
      raw: { questions: [] },
      model: providerConfig.model,
    };
  }

  const requestTimeoutMs = resolveRequestTimeoutMs();
  const maxOutputTokens = resolveMaxOutputTokens(Math.max(normalizedStatues.length, 4));
  const orderedQuestionIds = normalizedStatues.map((entry) => entry.questionId);

  const fallbackByQuestionId = new Map(
    normalizedStatues.map((entry) => [
      entry.questionId,
      {
        topic: entry.topic,
        difficulty: entry.difficulty,
        gradeLevel: entry.gradeLevel,
        questionType: 'multiple-choice',
        language: entry.language,
      },
    ]),
  );

  const prompt = buildStatueBatchPrompt({
    statues: normalizedStatues,
  });

  const retryPrompt = [
    prompt,
    'Your last answer was invalid or incomplete.',
    'Return all required questionIds exactly once in strict JSON.',
    'Keep explanations and hints concise to avoid truncation.',
  ].join('\n\n');

  const compactRetryPrompt = [
    prompt,
    'Keep each question under 130 characters when possible.',
    'Keep hints short and direct.',
    'Respond with strict compact JSON only and no markdown.',
  ].join('\n\n');

  const attemptPlans = [
    {
      prompt,
      temperature: 0.2,
      maxOutputTokens,
    },
    {
      prompt: retryPrompt,
      temperature: 0,
      maxOutputTokens: clampNumber(maxOutputTokens + 1400, MIN_OUTPUT_TOKENS, MAX_OUTPUT_TOKENS),
    },
    {
      prompt: compactRetryPrompt,
      temperature: 0,
      maxOutputTokens: clampNumber(maxOutputTokens + 2200, MIN_OUTPUT_TOKENS, MAX_OUTPUT_TOKENS),
    },
  ];

  let bestQuestionsById = new Map();
  let bestParsedPayload = null;
  let lastOutputText = '';

  for (const attemptPlan of attemptPlans) {
    const attemptResult = await requestAIWithFallback({
      providerConfig,
      prompt: attemptPlan.prompt,
      temperature: attemptPlan.temperature,
      timeoutMs: requestTimeoutMs,
      maxOutputTokens: attemptPlan.maxOutputTokens,
      responseSchema: STATUE_BATCH_RESPONSE_SCHEMA,
    });

    const outputText = String(attemptResult.outputText || '');
    lastOutputText = outputText;
    if (!outputText) {
      continue;
    }

    const parsedPayload = extractJsonObject(outputText);
    let attemptQuestionsById = new Map();

    if (parsedPayload) {
      attemptQuestionsById = normalizeStatueBatchPayload(parsedPayload, fallbackByQuestionId);
    }

    if (attemptQuestionsById.size === 0) {
      attemptQuestionsById = normalizeStatueBatchFromText(outputText, fallbackByQuestionId);
    }

    const mergedQuestionsById = mergeStatueQuestionMaps(bestQuestionsById, attemptQuestionsById, orderedQuestionIds);
    if (mergedQuestionsById.size > bestQuestionsById.size) {
      bestQuestionsById = mergedQuestionsById;
      bestParsedPayload = parsedPayload || bestParsedPayload;
    }

    if (bestQuestionsById.size >= orderedQuestionIds.length) {
      break;
    }
  }

  if (bestQuestionsById.size > 0 && bestQuestionsById.size < orderedQuestionIds.length) {
    const missingQuestionIds = orderedQuestionIds.filter((questionId) => !bestQuestionsById.has(questionId));
    const missingStatues = normalizedStatues.filter((entry) => missingQuestionIds.includes(entry.questionId));

    const fillPrompt = [
      buildStatueBatchPrompt({ statues: missingStatues }),
      'Only return these missing questionIds. Do not repeat previously answered questionIds.',
    ].join('\n\n');

    try {
      const fillAttempt = await requestAIWithFallback({
        providerConfig,
        prompt: fillPrompt,
        temperature: 0,
        timeoutMs: requestTimeoutMs,
        maxOutputTokens: clampNumber(maxOutputTokens + 1400, MIN_OUTPUT_TOKENS, MAX_OUTPUT_TOKENS),
        responseSchema: STATUE_BATCH_RESPONSE_SCHEMA,
      });

      const fillOutputText = String(fillAttempt.outputText || '');
      if (fillOutputText) {
        const fillPayload = extractJsonObject(fillOutputText);
        let fillQuestionsById = new Map();

        if (fillPayload) {
          fillQuestionsById = normalizeStatueBatchPayload(fillPayload, fallbackByQuestionId);
        }

        if (fillQuestionsById.size === 0) {
          fillQuestionsById = normalizeStatueBatchFromText(fillOutputText, fallbackByQuestionId);
        }

        const mergedFill = mergeStatueQuestionMaps(bestQuestionsById, fillQuestionsById, orderedQuestionIds);
        if (mergedFill.size > bestQuestionsById.size) {
          bestQuestionsById = mergedFill;
          bestParsedPayload = fillPayload || bestParsedPayload;
          lastOutputText = fillOutputText;
        }
      }
    } catch {
      // Ignore fill failures and return partial successful questions.
    }
  }

  if (bestQuestionsById.size === 0) {
    const preview = String(lastOutputText || '')
      .slice(0, OUTPUT_TEXT_PREVIEW_LIMIT)
      .replace(/\s+/g, ' ')
      .trim();
    throw new Error(`Gemini response was not valid JSON. Preview: ${preview}`);
  }

  return {
    questionsById: Object.fromEntries(Array.from(bestQuestionsById.entries())),
    requestedQuestionCount: orderedQuestionIds.length,
    generatedQuestionCount: bestQuestionsById.size,
    raw: bestParsedPayload || { questions: Array.from(bestQuestionsById.values()) },
    model: providerConfig.model,
  };
};

module.exports = {
  generateQuestionWithGemini,
  generateSingleQuestionWithGemini,
  generateStatueQuestionsWithGemini,
};
