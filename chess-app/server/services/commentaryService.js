import { log } from "../utils/logger.js";

export const COMMENTARY_MAX_CHARS = 160;

const PIECE_NAMES = {
  p: "pawn",
  n: "knight",
  b: "bishop",
  r: "rook",
  q: "queen",
  k: "king",
};

const SYSTEM_PROMPT = `You are a witty, PG-rated chess TV commentator.
You receive structured JSON chess context (move, SAN, FEN, turn, status, history, recentCommentary).
recentCommentary lists the last comments already spoken in this game — study it and avoid repetition.
Write at most 1-2 short sentences (under 22 words total, max 160 characters).
Vary tone every move: do not recycle catchphrases, jokes, punchlines, or sentence structures from recentCommentary.
Reference the current move and board state; write something fresh.
Be funny but never mean-spirited.
Never use hate speech, slurs, harassment, politics, religion, NSFW content, or personal insults.
Plain text only — no markdown, quotes, hashtags, or emojis.`;

const LLM_FRESHNESS_INSTRUCTION =
  "Do not repeat phrasing, jokes, or structure from recentCommentary. Write something fresh.";

const BLOCKLIST = [
  "nazi",
  "hitler",
  "slut",
  "whore",
  "fuck",
  "shit",
  "bitch",
  "retard",
  "kys",
  "kill yourself",
];

const OPENING_LINES = {
  e4: [
    "Classic e4 — the crowd goes mild, but the board just woke up.",
    "e4 claims the center. Old reliable, still booking gigs.",
    "King's pawn to e4. The opening credits have started.",
    "e4 — bold, central, and mildly threatening in a polite way.",
  ],
  d4: [
    "d4 enters the chat. The queenside lawyers are on retainer.",
    "Queen's pawn to d4. Structure before fireworks.",
    "d4 — the quiet move that starts loud arguments ten turns later.",
    "d4 plants a flag in the center. Diplomacy optional.",
  ],
  Nf3: [
    "Nf3: a polite knock before the door gets kicked in.",
    "Knight to f3 — development with excellent posture.",
    "Nf3 develops and eyes the center. Very professional.",
    "The knight hops to f3. Reconnaissance before the feast.",
  ],
  c4: [
    "The English Opening — tea, crumpets, and positional grudges.",
    "c4 — flank pressure with excellent stationery.",
    "English Opening via c4. Sideways aggression, refined.",
    "c4 slides in from the wing. The center will hear about this.",
  ],
};

function pick(lines) {
  return lines[Math.floor(Math.random() * lines.length)];
}

function normalizeText(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getWordNGrams(text, n = 4) {
  const words = normalizeText(text).split(" ").filter(Boolean);
  const ngrams = [];
  for (let i = 0; i <= words.length - n; i++) {
    ngrams.push(words.slice(i, i + n).join(" "));
  }
  return ngrams;
}

function isTooSimilar(candidate, recentTexts) {
  const normCandidate = normalizeText(candidate);
  if (!normCandidate) return false;

  for (const recent of recentTexts) {
    const normRecent = normalizeText(recent);
    if (!normRecent) continue;
    if (normCandidate === normRecent) return true;

    const candidateNgrams = new Set(getWordNGrams(candidate, 4));
    for (const ngram of getWordNGrams(recent, 4)) {
      if (candidateNgrams.has(ngram)) return true;
    }

    const candidateTail = normCandidate.split(" ").slice(-6).join(" ");
    const recentTail = normRecent.split(" ").slice(-6).join(" ");
    if (candidateTail.length > 15 && candidateTail === recentTail) return true;
  }

  return false;
}

function pickFresh(candidates, recentTexts = []) {
  if (!candidates.length) return "";
  const shuffled = [...candidates].sort(() => Math.random() - 0.5);

  for (const line of shuffled) {
    if (!isTooSimilar(line, recentTexts)) return line;
  }

  const recentNormalized = new Set(recentTexts.map(normalizeText));
  const nonExact = shuffled.filter((line) => !recentNormalized.has(normalizeText(line)));
  return nonExact[0] || shuffled[0];
}

function recentTextsFromContext(ctx) {
  return (ctx.recentCommentary || []).map((entry) => entry.text).filter(Boolean);
}

function containsBlockedContent(text) {
  const lower = text.toLowerCase();
  return BLOCKLIST.some((term) => lower.includes(term));
}

export function truncateAtSentenceBoundary(text, maxChars = COMMENTARY_MAX_CHARS) {
  if (!text) return "";
  const trimmed = text.trim();
  if (trimmed.length <= maxChars) return trimmed;

  let truncated = trimmed.slice(0, maxChars).trim();
  const lastSentenceEnd = Math.max(
    truncated.lastIndexOf("."),
    truncated.lastIndexOf("!"),
    truncated.lastIndexOf("?")
  );

  if (lastSentenceEnd >= Math.floor(maxChars * 0.5)) {
    return truncated.slice(0, lastSentenceEnd + 1).trim();
  }

  const lastSpace = truncated.lastIndexOf(" ");
  if (lastSpace > 0) {
    return `${truncated.slice(0, lastSpace).trim()}…`;
  }

  return `${truncated}…`;
}

export function sanitizeCommentary(text) {
  if (!text) return null;

  let cleaned = text
    .trim()
    .replace(/^["']|["']$/g, "")
    .replace(/#\w+/g, "")
    .replace(/\s+/g, " ");

  if (!cleaned || containsBlockedContent(cleaned)) return null;

  cleaned = truncateAtSentenceBoundary(cleaned);
  return cleaned || null;
}

/** Final server-side length cap (idempotent after sanitizeCommentary). */
export function capCommentaryText(text) {
  return sanitizeCommentary(text) || truncateAtSentenceBoundary(String(text || ""));
}

export function buildLLMUserPayload(context) {
  return {
    ...context,
    instruction: LLM_FRESHNESS_INSTRUCTION,
  };
}

/**
 * Rule-based commentary driven by structured fields — no string parsing.
 * @param {Object} ctx - output of buildCommentaryContext
 */
export function ruleBasedCommentary(ctx) {
  const { san, status, captured, piece, flags, move } = ctx;
  const recentTexts = recentTextsFromContext(ctx);
  const mover = PIECE_NAMES[piece] || "piece";
  const toSquare = move?.to || "the target square";

  let line;

  if (status.checkmate) {
    line = pickFresh(
      [
        `${san} delivers checkmate. Someone's ego just filed for bankruptcy.`,
        `Checkmate on ${san}. The king has left the building.`,
        `${san} ends it. HR would like a word with the losing side.`,
        `Game over — ${san} is the walk-off hit.`,
        `${san} seals it. The king's resignation letter is one move late.`,
        `Checkmate via ${san}. The defense has been discontinued.`,
      ],
      recentTexts
    );
  } else if (status.stalemate) {
    line = pickFresh(
      [
        "Stalemate! Both players achieved the rare art of mutual stubbornness.",
        "Stalemate — a draw where everyone wins at being impossible.",
        "Nobody can move, nobody loses. Peak committee meeting energy.",
        "Stalemate called. The pieces filed a joint complaint about progress.",
        "Dead position, live egos. Stalemate it is.",
        "Stalemate — chess's version of 'we agree to disagree forever.'",
      ],
      recentTexts
    );
  } else if (status.draw) {
    line = pickFresh(
      [
        "It's a draw. The pieces have agreed to disagree.",
        "Draw called. Peace treaty signed on the 64 squares.",
        "Game drawn — both sides ran out of spicy ideas.",
        "Half a point each. The audience wanted a sequel.",
        "Draw declared. Neither army could close the deal.",
        "Split points. The tension evaporates, the tea remains.",
      ],
      recentTexts
    );
  } else if (status.check) {
    line = pickFresh(
      [
        `${san} with check! The king's calendar just cleared.`,
        `Check after ${san}. Royal security is having a bad day.`,
        `${san} puts the king in check. The crown wobbles.`,
        `Check! ${san} forces a royal relocation plan.`,
        `${san} rings the king's doorbell. Nobody's answering.`,
        `The king is in check after ${san}. Luxury panic activated.`,
        `${san} checks — the king's escape routes are trending downward.`,
      ],
      recentTexts
    );
  } else if (captured) {
    const victim = PIECE_NAMES[captured] || "piece";
    line = pickFresh(
      [
        `${san} captures the ${victim}. Rest in captured pieces.`,
        `The ${victim} is gone after ${san}. Aggressive portfolio management.`,
        `${san} takes a ${victim}. The board is not a charity.`,
        `${san} removes the ${victim}. Cold, legal, effective.`,
        `The ${victim} falls to ${san}. Material imbalance incoming.`,
        `${san} scoops the ${victim}. Exchange accepted, feelings not included.`,
        `Goodbye, ${victim} — ${san} was the last thing you saw.`,
      ],
      recentTexts
    );
  } else if (flags?.includes("k") || flags?.includes("q")) {
    line = pickFresh(
      [
        `${san} — castling! The king found a panic room.`,
        "Castling: tuck the king in, wake the rook up.",
        `${san} castles. Safety first, violence second.`,
        `Castling with ${san}. The king chose the scenic defensive route.`,
        `${san} — king to safety, rook to the party.`,
        `Castle time via ${san}. Royalty relocates, rook gets promoted to active duty.`,
      ],
      recentTexts
    );
  } else if (flags?.includes("e")) {
    line = pickFresh(
      [
        `${san} en passant! The pawn got deleted by rulebook lawyers.`,
        "En passant — chess's sneakiest 'gotcha' clause.",
        `${san} says 'surprise' to that passing pawn.`,
        `En passant on ${san}. The pawn never saw the paperwork.`,
        `${san} — a diagonal delete with administrative flair.`,
        `En passant! ${san} proves the rulebook has jokes.`,
      ],
      recentTexts
    );
  } else if (piece === "p" && flags?.includes("p")) {
    line = pickFresh(
      [
        `${san} — promotion! A pawn graduated with honors.`,
        "Pawn promotion: small soldier, big promotion energy.",
        `${san} promotes. The pawn union is thrilled.`,
        `Promotion via ${san}! From foot soldier to royalty.`,
        `${san} — the pawn cashes in its loyalty points.`,
        `The pawn promotes on ${san}. Career change unlocked.`,
      ],
      recentTexts
    );
  } else if (OPENING_LINES[san]) {
    line = pickFresh(OPENING_LINES[san], recentTexts);
  } else if (piece === "n") {
    line = pickFresh(
      [
        `${san} — the knight takes the scenic L-shaped route to ${toSquare}.`,
        `Knight to ${toSquare} via ${san}. Hops, skips, and positional jumps.`,
        `${san} develops the knight. It refuses straight lines on principle.`,
        `The knight lands on ${toSquare} with ${san}. Eccentric, effective.`,
        `${san} — a knight tour with business intentions.`,
        `Knight activity on ${san}. The horseshoe is pointed at the center.`,
      ],
      recentTexts
    );
  } else if (piece === "b") {
    line = pickFresh(
      [
        `${san} — the bishop slides diagonally into the plot.`,
        `Bishop to ${toSquare} with ${san}. Long-range shade deployed.`,
        `${san} activates the bishop. Diagonals are now under new management.`,
        `The bishop glides on ${san}. Subtle, angled, mildly ominous.`,
        `${san} — diagonal pressure without raising its voice.`,
        `Bishop move ${san}. Cross-board sniping from a safe distance.`,
      ],
      recentTexts
    );
  } else if (piece === "r") {
    line = pickFresh(
      [
        `${san} — the rook files a straight-line complaint.`,
        `Rook to ${toSquare} via ${san}. Open files are its love language.`,
        `${san} mobilizes the rook. Rank and file diplomacy.`,
        `The rook stomps to ${toSquare} on ${san}. No curves, all business.`,
        `${san} — heavy piece energy on an open highway.`,
        `Rook lift incoming with ${san}. Horizontal menace, vertical options.`,
      ],
      recentTexts
    );
  } else if (piece === "q") {
    line = pickFresh(
      [
        `${san} — the queen arrives fashionably and powerfully.`,
        `Queen to ${toSquare} on ${san}. Maximum flexibility, minimum patience.`,
        `${san} unleashes the queen. The board feels smaller now.`,
        `The queen saunters to ${toSquare} via ${san}.`,
        `${san} — royal mobility with a side of menace.`,
        `Queen activity on ${san}. Every direction is suddenly a problem.`,
      ],
      recentTexts
    );
  } else if (piece === "k") {
    line = pickFresh(
      [
        `${san} — the king takes a stroll. Bold or desperate, jury's out.`,
        `King to ${toSquare} on ${san}. His Majesty is on the move.`,
        `${san} — a royal step with surprisingly high stakes.`,
        `The king walks to ${toSquare}. The entourage is nervous.`,
        `${san} — king move. The quietest piece, loudest implications.`,
        `King relocation via ${san}. Safety was not invited to this meeting.`,
      ],
      recentTexts
    );
  } else if (piece === "p") {
    line = pickFresh(
      [
        `${san} — a pawn inches forward. Small step, big attitude.`,
        `Pawn to ${toSquare} with ${san}. Foot soldier reporting for duty.`,
        `${san} nudges the pawn. The center appreciates the effort.`,
        `The pawn advances on ${san}. Slow, steady, surprisingly dramatic.`,
        `${san} — pawn push. Quiet move, noisy long-term plans.`,
        `Pawn march via ${san}. One square closer to glory or doom.`,
      ],
      recentTexts
    );
  } else {
    line = pickFresh(
      [
        `${san} — the ${mover} shifts the plot on ${toSquare}.`,
        `${san} played. The ${mover} has plans above its pay grade.`,
        `Solid ${san}. The ${mover} is up to something.`,
        `${san} keeps the ${mover} busy on ${toSquare}.`,
        `The ${mover} moves with ${san}. Positionally suspicious.`,
        `${san} — ${mover} activity with suspiciously good timing.`,
        `${san} lands on ${toSquare}. The ${mover} clocks in for work.`,
      ],
      recentTexts
    );
  }

  const sanitized = sanitizeCommentary(line);
  if (sanitized && !isTooSimilar(sanitized, recentTexts)) {
    return sanitized;
  }

  const fallback = pickFresh(
    [
      `${san} — fresh angle, same board, new headache for the opponent.`,
      `${san} changes the temperature. Nobody saw that coming.`,
      `On ${san}, the ${mover} picks a new fight.`,
      `${san} — different words, same competitive energy.`,
      `The ${mover} plays ${san}. Plot twist on ${toSquare}.`,
    ],
    recentTexts
  );

  return sanitizeCommentary(fallback) || `${san}! A solid move on the board.`;
}

async function generateFromLLM(context) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return null;

  const model = process.env.OPENROUTER_MODEL || "deepseek/deepseek-v4-flash";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.OPENROUTER_HTTP_REFERER || "http://localhost:5173",
        "X-Title": process.env.OPENROUTER_APP_TITLE || "Chess App",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: JSON.stringify(buildLLMUserPayload(context)) },
        ],
        max_tokens: 70,
        temperature: 0.9,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`OpenRouter API error ${response.status}: ${body}`);
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content?.trim();
    return sanitizeCommentary(text);
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Generate one commentary line from structured chess context.
 * @param {Object} context - buildCommentaryContext output
 */
export async function generateCommentary(context) {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) {
    log.debug("Commentary source: rule-based (OPENROUTER_API_KEY not set)");
    return ruleBasedCommentary(context);
  }

  try {
    const llmText = await generateFromLLM(context);
    if (llmText) {
      log.debug("Commentary source: LLM", {
        model: process.env.OPENROUTER_MODEL || "deepseek/deepseek-v4-flash",
        recentCommentaryCount: context.recentCommentary?.length ?? 0,
      });
      return llmText;
    }
    log.debug("Commentary source: rule-based (LLM returned empty or invalid)");
  } catch (err) {
    log.warn("LLM commentary failed, using rule-based fallback", {
      error: err.message,
    });
  }

  log.debug("Commentary source: rule-based (LLM fallback)");
  return ruleBasedCommentary(context);
}
