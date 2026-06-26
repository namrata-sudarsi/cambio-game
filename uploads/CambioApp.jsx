import { useState, useEffect, useCallback, useRef } from "react";

// ─── Constants ───────────────────────────────────────────────────────
const SUITS = ["♠", "♥", "♦", "♣"];
const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const JOKER = "🃏";

function cardValue(card) {
  if (!card) return 0;
  if (card.isJoker) return 0;
  if (card.rank === "A") return 1;
  if (card.rank === "K" && (card.suit === "♥" || card.suit === "♦")) return -1;
  if (["K", "Q", "J"].includes(card.rank)) return 10;
  return parseInt(card.rank);
}

function cardColor(card) {
  if (card.isJoker) return "#9b59b6";
  return card.suit === "♥" || card.suit === "♦" ? "#c0392b" : "#1a1a2e";
}

function cardLabel(card) {
  if (card.isJoker) return JOKER;
  return `${card.rank}${card.suit}`;
}

function buildDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ rank, suit, isJoker: false, id: `${rank}${suit}` });
    }
  }
  deck.push({ isJoker: true, id: "JK1", rank: "JK", suit: "" });
  deck.push({ isJoker: true, id: "JK2", rank: "JK", suit: "" });
  return deck;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function getCardAbility(card) {
  if (!card || card.isJoker) return null;
  if (["7", "8"].includes(card.rank)) return "peek_own";
  if (["9", "10"].includes(card.rank)) return "peek_other";
  if (["J", "Q"].includes(card.rank)) return "blind_swap";
  if (card.rank === "K" && (card.suit === "♠" || card.suit === "♣")) return "king_swap";
  return null;
}

// ─── AI Logic ────────────────────────────────────────────────────────
function aiDecision(aiHand, aiKnown, drawnCard) {
  const drawnVal = cardValue(drawnCard);
  let worstKnownIdx = -1;
  let worstKnownVal = -2;
  for (const [idx, card] of aiKnown.entries()) {
    if (idx >= aiHand.length || !aiHand[idx]) continue;
    const v = cardValue(card);
    if (v > worstKnownVal) { worstKnownVal = v; worstKnownIdx = idx; }
  }
  if (worstKnownIdx >= 0 && drawnVal < worstKnownVal) {
    return { action: "swap", idx: worstKnownIdx };
  }
  const unknownIndices = [];
  for (let i = 0; i < aiHand.length; i++) {
    if (!aiHand[i]) continue; // skip empty slots
    if (!aiKnown.has(i)) unknownIndices.push(i);
  }
  if (drawnVal <= 3 && unknownIndices.length > 0) {
    return { action: "swap", idx: unknownIndices[0] };
  }
  const ability = getCardAbility(drawnCard);
  if (ability === "peek_own" && unknownIndices.length > 0) {
    return { action: "use_ability", ability, target: unknownIndices[0] };
  }
  return { action: "discard" };
}

// ─── Phases ──────────────────────────────────────────────────────────
const PHASE = {
  SETUP: "setup",
  PEEK: "peek",
  DRAW: "draw",
  DRAWN: "drawn",
  ABILITY: "ability",
  AI_TURN: "ai_turn",
  FINAL_STICK: "final_stick", // player dealt with drawn card but can still stick before ending
  REVEAL: "reveal",
};

// ─── Card Component ──────────────────────────────────────────────────
const ABILITY_LABEL = {
  peek_own: "PEEK OWN", peek_other: "PEEK OPP",
  blind_swap: "BLIND SWAP", king_swap: "KING SWAP",
};

function CardView({ card, faceUp, onClick, highlighted, selectable, dimmed, glowColor, animIn, animOut, showAbility, matchHint }) {
  const prevFaceUpRef = useRef(faceUp);
  const [flipKey, setFlipKey] = useState(0);

  useEffect(() => {
    if (faceUp && !prevFaceUpRef.current) setFlipKey(k => k + 1);
    prevFaceUpRef.current = faceUp;
  }, [faceUp]);

  let animation;
  if (animOut) animation = "cardToDiscard 0.35s ease-in forwards";
  else if (animIn) animation = "cardFromDeck 0.4s ease-out forwards";
  else if (flipKey > 0) animation = "cardReveal 0.3s ease-out";

  const color = faceUp && card ? cardColor(card) : null;
  const ability = showAbility && card ? getCardAbility(card) : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      <div
        onClick={(selectable || matchHint) ? onClick : undefined}
        style={{
          width: 68, height: 96, borderRadius: 10,
          position: "relative", userSelect: "none",
          cursor: (selectable || matchHint) ? "pointer" : "default",
          opacity: dimmed ? 0.28 : 1,
          animation,
          transform: highlighted ? "translateY(-7px) scale(1.07)" : (selectable || matchHint) ? "translateY(-2px) scale(1.03)" : "none",
          transition: "transform 0.18s ease, box-shadow 0.18s ease, opacity 0.2s ease",
          boxShadow: highlighted
            ? `0 14px 32px ${glowColor ? glowColor + "99" : "rgba(212,175,55,0.55)"}, 0 0 0 2px ${glowColor || "#d4af37"}`
            : matchHint
              ? "0 0 0 2px rgba(251,146,60,0.9), 0 6px 22px rgba(251,146,60,0.4)"
              : selectable
                ? "0 6px 22px rgba(212,175,55,0.28), 0 0 0 1.5px rgba(212,175,55,0.45)"
                : "0 4px 14px rgba(0,0,0,0.65)",
        }}
      >
        {faceUp ? (
          /* ── Face-up card ── */
          <div style={{
            position: "absolute", inset: 0, borderRadius: 10,
            background: "linear-gradient(150deg, #ffffff 0%, #f7f2e8 100%)",
            border: "1px solid rgba(0,0,0,0.12)",
            overflow: "hidden",
          }}>
            {/* Top-left pip */}
            <div style={{
              position: "absolute", top: 5, left: 6,
              color, lineHeight: 1.1, textAlign: "center",
            }}>
              <div style={{ fontSize: card.isJoker ? 16 : 14, fontWeight: 800, fontFamily: "Georgia, serif" }}>
                {card.isJoker ? "🃏" : card.rank}
              </div>
              {!card.isJoker && <div style={{ fontSize: 11, marginTop: -1 }}>{card.suit}</div>}
            </div>
            {/* Center */}
            <div style={{
              position: "absolute", top: "50%", left: "50%",
              transform: "translate(-50%, -50%)",
              fontSize: card.isJoker ? 36 : 28, color,
              lineHeight: 1,
            }}>
              {card.isJoker ? "🃏" : card.suit}
            </div>
            {/* Bottom-right pip (rotated) */}
            {!card.isJoker && (
              <div style={{
                position: "absolute", bottom: 5, right: 6,
                color, lineHeight: 1.1, textAlign: "center",
                transform: "rotate(180deg)",
              }}>
                <div style={{ fontSize: 14, fontWeight: 800, fontFamily: "Georgia, serif" }}>{card.rank}</div>
                <div style={{ fontSize: 11, marginTop: -1 }}>{card.suit}</div>
              </div>
            )}
          </div>
        ) : (
          /* ── Face-down card ── */
          <div style={{
            position: "absolute", inset: 0, borderRadius: 10,
            background: "linear-gradient(145deg, #1c3f6e 0%, #0d2444 55%, #1c3f6e 100%)",
            border: "1.5px solid rgba(212,175,55,0.28)",
            overflow: "hidden",
          }}>
            {/* Diamond tiling */}
            <div style={{
              position: "absolute", inset: 0,
              backgroundImage: "repeating-linear-gradient(45deg, transparent, transparent 9px, rgba(212,175,55,0.05) 9px, rgba(212,175,55,0.05) 10px)",
            }} />
            {/* Inner border */}
            <div style={{
              position: "absolute", inset: 6,
              border: "1px solid rgba(212,175,55,0.22)",
              borderRadius: 5,
            }} />
            <div style={{
              position: "absolute", inset: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 20, color: "rgba(212,175,55,0.32)",
            }}>✦</div>
          </div>
        )}
      </div>
      {/* Ability badge under drawn card */}
      {ability && (
        <div style={{
          fontSize: 9, fontWeight: 700, letterSpacing: 0.8,
          color: "#38bdf8", fontFamily: "Inter, sans-serif",
          background: "rgba(56,189,248,0.12)",
          border: "1px solid rgba(56,189,248,0.3)",
          borderRadius: 4, padding: "2px 6px",
        }}>
          {ABILITY_LABEL[ability]}
        </div>
      )}
    </div>
  );
}

// ─── Main App ────────────────────────────────────────────────────────
export default function CambioApp() {
  const [phase, setPhase] = useState(PHASE.SETUP);
  const [deck, setDeck] = useState([]);
  const [discard, setDiscard] = useState([]);
  const [playerHand, setPlayerHand] = useState([]);
  const [aiHand, setAiHand] = useState([]);
  const [playerKnown, setPlayerKnown] = useState(new Set());
  const [aiKnown, setAiKnown] = useState(new Map());
  const [drawnCard, setDrawnCard] = useState(null);
  const [drawnFrom, setDrawnFrom] = useState(null);
  const [message, setMessage] = useState("");
  const [peeksLeft, setPeeksLeft] = useState(2);
  const [cambioCaller, _setCambioCaller] = useState(null);
  const cambioCallerRef = useRef(null);
  const setCambioCaller = (v) => { cambioCallerRef.current = v; _setCambioCaller(v); };
  const [abilityMode, setAbilityMode] = useState(null);
  const [abilityStep, setAbilityStep] = useState(0);
  const [tempReveal, setTempReveal] = useState(new Set());
  const [scores, setScores] = useState(null);
  const [swapSource, setSwapSource] = useState(null);
  const [stickMode, setStickMode] = useState(false);
  const [roundNum, setRoundNum] = useState(0);
  const timerRef = useRef(null);

  const clearTimer = () => { if (timerRef.current) clearTimeout(timerRef.current); };

  // ── Deal ──
  const startGame = useCallback(() => {
    const d = shuffle(buildDeck());
    const pH = d.splice(0, 4);
    const aH = d.splice(0, 4);
    const disc = [d.splice(0, 1)[0]];
    setDeck(d); setDiscard(disc);
    setPlayerHand(pH); setAiHand(aH);
    setPlayerKnown(new Set()); setAiKnown(new Map());
    setDrawnCard(null); setDrawnFrom(null);
    setCambioCaller(null); // also resets ref
    setAbilityMode(null); setAbilityStep(0); setTempReveal(new Set());
    setScores(null); setSwapSource(null); setStickMode(false); setStickTarget(null); setAiSwapAnim(null);
    setRoundNum(0);
    setPeeksLeft(2);
    setMessage("Tap your 2 bottom cards to peek and memorize them!");
    setPhase(PHASE.PEEK);
    const ak = new Map();
    ak.set(2, aH[2]); ak.set(3, aH[3]);
    setAiKnown(ak);
  }, []);

  // ── Helpers ──
  const isBottomRow = (idx, handLen) => {
    const cols = 2;
    const row = Math.floor(idx / cols);
    const totalRows = Math.ceil(handLen / cols);
    return row === totalRows - 1;
  };

  // ── Peek phase ──
  const handlePeek = (idx) => {
    if (phase !== PHASE.PEEK || peeksLeft <= 0) return;
    if (!isBottomRow(idx, playerHand.length)) {
      setMessage("Only your bottom cards! Tap the bottom row.");
      return;
    }
    if (tempReveal.has(`p${idx}`)) return;

    const tr = new Set(tempReveal); tr.add(`p${idx}`);
    setTempReveal(tr);
    const nk = new Set(playerKnown); nk.add(idx);
    setPlayerKnown(nk);

    const left = peeksLeft - 1;
    setPeeksLeft(left);
    if (left === 0) {
      setMessage("Memorize them! Hiding in 3 seconds...");
      clearTimer();
      timerRef.current = setTimeout(() => {
        setTempReveal(new Set());
        setMessage("Your turn! Draw from deck or take the discard.");
        setPhase(PHASE.DRAW);
      }, 3000);
    } else {
      setMessage(`Good! Peek at ${left} more bottom card.`);
    }
  };

  // ── Reshuffle discard into deck when deck runs out ──
  const reshuffleIfNeeded = (currentDeck, currentDiscard) => {
    if (currentDeck.length > 0) return { deck: currentDeck, discard: currentDiscard };
    if (currentDiscard.length <= 1) return { deck: currentDeck, discard: currentDiscard };
    const top = currentDiscard[currentDiscard.length - 1];
    const newDeck = shuffle(currentDiscard.slice(0, -1));
    return { deck: newDeck, discard: [top] };
  };

  // ── Draw ──
  const drawFromDeck = () => {
    if (phase !== PHASE.DRAW) return;
    const { deck: nd, discard: nd2 } = reshuffleIfNeeded(deck, discard);
    if (nd.length === 0) return;
    const refreshed = [...nd]; const card = refreshed.pop();
    setDeck(refreshed); setDiscard(nd2); setDrawnCard(card); setDrawnFrom("deck");
    setStickMode(false);
    setMessage("Swap it with one of your cards, or discard it (abilities activate on discard).");
    setPhase(PHASE.DRAWN);
  };

  const drawFromDiscard = () => {
    if (phase !== PHASE.DRAW || discard.length === 0) return;
    const nd = [...discard]; const card = nd.pop();
    setDiscard(nd); setDrawnCard(card); setDrawnFrom("discard");
    setStickMode(false);
    setMessage("Pick one of your cards to swap with this card.");
    setPhase(PHASE.DRAWN);
  };

  // ── Swap drawn card ──
  const swapWithOwn = (idx) => {
    if (phase !== PHASE.DRAWN) return;
    const nh = [...playerHand];
    const old = nh[idx];
    nh[idx] = drawnCard;
    setPlayerHand(nh);
    setDiscard(d => [...d, old]);
    setDrawnCard(null); setDrawnFrom(null);
    const nk = new Set(playerKnown); nk.add(idx);
    setPlayerKnown(nk);
    setAbilityMode(null);
    endPlayerTurn();
  };

  // ── Discard drawn card ──
  const discardDrawn = () => {
    if (phase !== PHASE.DRAWN || drawnFrom === "discard") return;
    const ability = getCardAbility(drawnCard);
    setDiscard(d => [...d, drawnCard]);
    setDrawnCard(null); setDrawnFrom(null);
    if (ability) {
      setAbilityMode(ability); setAbilityStep(0); setSwapSource(null);
      if (ability === "peek_own") setMessage("Pick one of YOUR cards to peek at.");
      else if (ability === "peek_other") setMessage("Pick one of OPPONENT's cards to peek at.");
      else if (ability === "blind_swap") setMessage("Pick one of YOUR cards first.");
      else if (ability === "king_swap") setMessage("Pick any card to look at.");
      setPhase(PHASE.ABILITY);
    } else {
      endPlayerTurn();
    }
  };

  const skipAbility = () => {
    setAbilityMode(null); setTempReveal(new Set());
    endPlayerTurn();
  };

  // ── Abilities ──
  const handleAbility = (owner, idx) => {
    if (phase !== PHASE.ABILITY) return;
    const isPlayer = owner === "player";

    if (abilityMode === "peek_own") {
      if (!isPlayer) return;
      setTempReveal(new Set([`p${idx}`]));
      const nk = new Set(playerKnown); nk.add(idx); setPlayerKnown(nk);
      setMessage(`Card ${idx + 1}: ${cardLabel(playerHand[idx])}. Memorize it!`);
      clearTimer();
      timerRef.current = setTimeout(() => { setTempReveal(new Set()); setAbilityMode(null); endPlayerTurn(); }, 2500);

    } else if (abilityMode === "peek_other") {
      if (isPlayer) return;
      setTempReveal(new Set([`a${idx}`]));
      setMessage(`Opponent card ${idx + 1}: ${cardLabel(aiHand[idx])}. Memorize it!`);
      clearTimer();
      timerRef.current = setTimeout(() => { setTempReveal(new Set()); setAbilityMode(null); endPlayerTurn(); }, 2500);

    } else if (abilityMode === "blind_swap") {
      if (swapSource === null) {
        if (!isPlayer) return;
        setSwapSource({ owner: "player", idx });
        setMessage("Now pick one of OPPONENT's cards to swap with.");
      } else {
        if (isPlayer) return;
        const ph = [...playerHand]; const ah = [...aiHand];
        const tmp = ph[swapSource.idx]; ph[swapSource.idx] = ah[idx]; ah[idx] = tmp;
        setPlayerHand(ph); setAiHand(ah);
        const nk = new Set(playerKnown); nk.delete(swapSource.idx); setPlayerKnown(nk);
        const nak = new Map(aiKnown); nak.delete(idx); setAiKnown(nak);
        setMessage("Blind swap done!");
        setSwapSource(null); setAbilityMode(null);
        clearTimer();
        timerRef.current = setTimeout(() => endPlayerTurn(), 1000);
      }

    } else if (abilityMode === "king_swap") {
      if (abilityStep === 0) {
        const card = isPlayer ? playerHand[idx] : aiHand[idx];
        setTempReveal(new Set([`${isPlayer ? "p" : "a"}${idx}`]));
        setMessage(`That's ${cardLabel(card)}. Pick another card to swap it with, or skip.`);
        setSwapSource({ owner, idx }); setAbilityStep(1);
        if (isPlayer) { const nk = new Set(playerKnown); nk.add(idx); setPlayerKnown(nk); }
      } else {
        const src = swapSource;
        const ph = [...playerHand]; const ah = [...aiHand];
        const getC = (o, i) => o === "player" ? ph[i] : ah[i];
        const setC = (o, i, c) => { if (o === "player") ph[i] = c; else ah[i] = c; };
        const c1 = getC(src.owner, src.idx); const c2 = getC(owner, idx);
        setC(src.owner, src.idx, c2); setC(owner, idx, c1);
        setPlayerHand(ph); setAiHand(ah);
        setMessage("King swap done!");
        setSwapSource(null); setAbilityMode(null); setTempReveal(new Set());
        clearTimer();
        timerRef.current = setTimeout(() => endPlayerTurn(), 1000);
      }
    }
  };

  // ── Sticking ──
  // stickMode can be: false, "pick" (pick any card), or "swap" (pick your card to give opponent)
  const [aiSwapAnim, setAiSwapAnim] = useState(null); // { idx, phase: 'out'|'in' }
  const [stickTarget, setStickTarget] = useState(null); // { owner, idx, card } of the stuck card

  const handleStick = (owner, idx) => {
    if (discard.length === 0) return;
    const topDiscard = discard[discard.length - 1];
    const card = owner === "player" ? playerHand[idx] : aiHand[idx];

    if (!card) return; // empty slot

    if (card.rank !== topDiscard.rank) {
      // Wrong stick — penalty card
      if (deck.length > 0) {
        const nd = [...deck]; const penalty = nd.pop(); setDeck(nd);
        // Put penalty in first empty slot, or append
        setPlayerHand(h => {
          const nh = [...h];
          const emptyIdx = nh.findIndex(c => c === null);
          if (emptyIdx >= 0) { nh[emptyIdx] = penalty; } else { nh.push(penalty); }
          return nh;
        });
        setMessage("Wrong stick! Penalty card added. 😬");
      }
      setStickMode(false); setStickTarget(null);
      return;
    }

    if (owner === "player") {
      // Stick own card — null out the slot
      const nh = [...playerHand]; nh[idx] = null;
      setPlayerHand(nh);
      setDiscard(d => [...d, card]);
      const nk = new Set(playerKnown); nk.delete(idx);
      setPlayerKnown(nk);
      setStickMode(false); setStickTarget(null);
      setMessage("Nice stick! Card removed! 🎯");
    } else {
      // Stick opponent's card — null out their slot, then player picks a card to give
      const ah = [...aiHand]; ah[idx] = null;
      setAiHand(ah);
      setDiscard(d => [...d, card]);
      const nak = new Map(aiKnown); nak.delete(idx);
      setAiKnown(nak);
      setStickTarget({ owner: "ai", idx });
      setStickMode("swap");
      setMessage("Nice stick on opponent! Now pick one of YOUR cards to give them.");
    }
  };

  const handleStickSwap = (playerIdx) => {
    if (!playerHand[playerIdx]) return; // can't give empty slot
    const card = playerHand[playerIdx];
    const targetIdx = stickTarget.idx;
    // Null out player's slot
    const nh = [...playerHand]; nh[playerIdx] = null;
    setPlayerHand(nh);
    // Put card in opponent's empty slot
    const ah = [...aiHand]; ah[targetIdx] = card;
    setAiHand(ah);
    const nk = new Set(playerKnown); nk.delete(playerIdx);
    setPlayerKnown(nk);
    setStickMode(false); setStickTarget(null);
    setMessage("You gave a card to opponent! 🎯");
  };

  // ── Turn flow ──
  const endPlayerTurn = () => {
    setStickMode(false); setStickTarget(null);
    if (cambioCallerRef.current === "player") { doReveal(); return; }
    if (cambioCallerRef.current === "ai") {
      setPhase(PHASE.FINAL_STICK);
      setMessage("You can still stick a card, or tap End Turn to finish.");
      return;
    }
    setMessage("Opponent is thinking...");
    setPhase(PHASE.AI_TURN);
    clearTimer();
    timerRef.current = setTimeout(() => doAiTurn(), 1500);
  };

  const doAiTurn = () => {
    // Bot sticking: check if any known card matches the discard top
    if (discard.length > 0) {
      const topDiscard = discard[discard.length - 1];
      for (const [idx, knownCard] of aiKnown.entries()) {
        if (idx < aiHand.length && aiHand[idx] && knownCard.rank === topDiscard.rank) {
          const ah = [...aiHand]; const stuck = ah[idx]; ah[idx] = null;
          setAiHand(ah);
          setDiscard(d => [...d, stuck]);
          const nak = new Map(aiKnown); nak.delete(idx); setAiKnown(nak);
          setMessage("Opponent stuck a card! 😤");
          clearTimer();
          timerRef.current = setTimeout(() => {
            if (cambioCallerRef.current) { doReveal(); return; }
            setPhase(PHASE.DRAW);
            setMessage("Your turn! Draw from deck or take the discard.");
          }, 1200);
          return;
        }
      }
    }

    const { deck: freshDeck, discard: freshDiscard } = reshuffleIfNeeded(deck, discard);
    if (freshDeck.length === 0) { doReveal(); return; }
    setDiscard(freshDiscard);
    const nd = [...freshDeck]; const card = nd.pop(); setDeck(nd);
    const decision = aiDecision(aiHand, aiKnown, card);

    if (decision.action === "swap") {
      const ah = [...aiHand]; const old = ah[decision.idx]; ah[decision.idx] = card;
      const nak = new Map(aiKnown); nak.set(decision.idx, card);
      // Phase 1: old card slides out
      setAiSwapAnim({ idx: decision.idx, phase: "out" });
      setMessage("Opponent swapped a card.");
      setTimeout(() => {
        // Phase 2: swap state, new card slides in
        setAiHand(ah); setDiscard(d => [...d, old]); setAiKnown(nak);
        setAiSwapAnim({ idx: decision.idx, phase: "in" });
        setTimeout(() => setAiSwapAnim(null), 420);
      }, 360);
    } else if (decision.action === "use_ability") {
      setDiscard(d => [...d, card]);
      if (decision.ability === "peek_own") {
        const nak = new Map(aiKnown); nak.set(decision.target, aiHand[decision.target]); setAiKnown(nak);
      }
      setMessage("Opponent used an ability.");
    } else {
      setDiscard(d => [...d, card]);
      setMessage("Opponent discarded.");
    }

    // If someone already called Cambio, this was the final turn — reveal
    if (cambioCallerRef.current) {
      setMessage("Revealing all cards...");
      clearTimer();
      timerRef.current = setTimeout(() => doReveal(), 1500);
      return;
    }

    // Track rounds
    const currentRound = roundNum + 1;
    setRoundNum(currentRound);

    // AI considers calling Cambio — smarter logic
    let knownTotal = 0; let knownCount = 0;
    const activeCards = aiHand.filter(c => c !== null).length;
    for (const [idx, c] of aiKnown.entries()) {
      if (idx < aiHand.length && aiHand[idx]) { knownTotal += cardValue(c); knownCount++; }
    }
    // Estimate unknown cards as ~5.5 avg (middle of 0-10 range)
    const unknownCount = activeCards - knownCount;
    const estimatedTotal = knownTotal + (unknownCount * 5.5);

    const shouldCallCambio =
      // Confident: knows most cards and total is very low
      (knownCount >= 3 && knownTotal <= 4) ||
      // Knows all cards and total is decent
      (knownCount >= activeCards && knownTotal <= 8) ||
      // After a few rounds, call if estimated total is low
      (currentRound >= 3 && knownCount >= 2 && estimatedTotal <= 10) ||
      // Late game — be aggressive if known cards are decent
      (currentRound >= 5 && knownCount >= 2 && knownTotal <= 6) ||
      // Very late game — just go for it
      (currentRound >= 8 && estimatedTotal <= 15);

    if (shouldCallCambio && activeCards <= 4) {
      setCambioCaller("ai");
      setMessage("Opponent calls CAMBIO! You get one final turn!");
      clearTimer();
      timerRef.current = setTimeout(() => {
        setPhase(PHASE.DRAW);
        setMessage("FINAL TURN! Draw from deck or discard.");
      }, 2000);
      return;
    }

    clearTimer();
    timerRef.current = setTimeout(() => {
      setTempReveal(new Set());
      setPhase(PHASE.DRAW);
      setMessage("Your turn! Draw from deck or take the discard.");
    }, 2000);
  };

  const callCambio = () => {
    if (phase !== PHASE.DRAW || cambioCaller) return;
    setCambioCaller("player");
    setMessage("You called CAMBIO! Opponent gets one last turn...");
    setPhase(PHASE.AI_TURN);
    clearTimer();
    timerRef.current = setTimeout(() => doAiTurn(), 1500);
  };

  const doReveal = () => {
    setPhase(PHASE.REVEAL);
    const pScore = playerHand.reduce((s, c) => c ? s + cardValue(c) : s, 0);
    const aScore = aiHand.reduce((s, c) => c ? s + cardValue(c) : s, 0);
    let winner;
    if (pScore < aScore) winner = "player";
    else if (aScore < pScore) winner = "ai";
    else winner = cambioCaller === "player" ? "ai" : "player";
    setScores({ player: pScore, ai: aScore, winner });
  };

  useEffect(() => () => clearTimer(), []);

  // ── Rendering ──
  const isTR = (owner, idx) => tempReveal.has(`${owner === "player" ? "p" : "a"}${idx}`);

  const renderCard = (card, owner, idx, handLen) => {
    if (!card) {
      return (
        <div key={`${owner}-${idx}-empty`} style={{
          width: 68, height: 96, borderRadius: 10,
          border: "1.5px dashed rgba(255,255,255,0.07)",
          background: "rgba(255,255,255,0.015)",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "rgba(255,255,255,0.1)", fontSize: 18, userSelect: "none",
        }}>✕</div>
      );
    }

    const isPlayer = owner === "player";
    const revealed = phase === PHASE.REVEAL || isTR(owner, idx);
    const stickOpen = (phase === PHASE.DRAW || phase === PHASE.AI_TURN || phase === PHASE.FINAL_STICK)
      && !stickMode && discard.length > 0
      && cambioCaller !== "player";
    let selectable = false;
    let dimmed = false;

    if (phase === PHASE.PEEK && isPlayer) {
      const bottom = isBottomRow(idx, handLen);
      selectable = bottom && !tempReveal.has(`p${idx}`);
      dimmed = !bottom;
    } else if (phase === PHASE.DRAWN && isPlayer) {
      selectable = true;
    } else if (phase === PHASE.ABILITY) {
      if (abilityMode === "peek_own") selectable = isPlayer;
      else if (abilityMode === "peek_other") selectable = !isPlayer;
      else if (abilityMode === "blind_swap") selectable = swapSource === null ? isPlayer : !isPlayer;
      else if (abilityMode === "king_swap") selectable = true;
    } else if (stickMode === "swap" && isPlayer) {
      selectable = true;
    } else if (stickOpen) {
      selectable = true;
    }

    const highlighted = swapSource?.owner === owner && swapSource?.idx === idx;
    const animOut = !isPlayer && aiSwapAnim?.idx === idx && aiSwapAnim.phase === "out";
    const animIn  = !isPlayer && aiSwapAnim?.idx === idx && aiSwapAnim.phase === "in";

    const discardTop = discard.length > 0 ? discard[discard.length - 1] : null;
    const matchHint = false;

    return (
      <CardView
        key={`${owner}-${idx}-${card.id}`}
        card={card} faceUp={revealed} selectable={selectable}
        highlighted={highlighted} dimmed={dimmed}
        glowColor={stickMode === "swap" ? "#d4af37" : undefined}
        animIn={animIn} animOut={animOut} matchHint={matchHint}
        onClick={() => {
          if (phase === PHASE.PEEK && isPlayer) handlePeek(idx);
          else if (phase === PHASE.DRAWN && isPlayer) swapWithOwn(idx);
          else if (phase === PHASE.ABILITY) handleAbility(owner, idx);
          else if (stickMode === "swap" && isPlayer) handleStickSwap(idx);
          else if (stickOpen) handleStick(owner, idx);
        }}
      />
    );
  };

  const renderHand = (hand, owner) => (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 68px)", gap: 10, justifyContent: "center" }}>
      {hand.map((card, idx) => renderCard(card, owner, idx, hand.length))}
    </div>
  );

  // ── Shared tokens ──
  const C = {
    bg: "#080b12",
    surface: "rgba(255,255,255,0.04)",
    border: "rgba(255,255,255,0.07)",
    gold: "#d4af37",
    goldDim: "rgba(212,175,55,0.18)",
    text: "#e2d9c8",
    muted: "#6b7280",
    font: "'Inter', -apple-system, sans-serif",
    title: "'Cinzel', Georgia, serif",
  };

  const btn = (variant = "ghost") => {
    const base = {
      border: "none", borderRadius: 50, fontWeight: 600,
      fontSize: 13, cursor: "pointer", letterSpacing: 0.5,
      padding: "10px 22px", transition: "all 0.18s ease",
      fontFamily: C.font,
    };
    if (variant === "primary") return { ...base, background: "linear-gradient(135deg, #d4af37, #b8932a)", color: "#0a0c14", boxShadow: "0 4px 18px rgba(212,175,55,0.35)" };
    if (variant === "danger")  return { ...base, background: "linear-gradient(135deg, #dc2626, #b91c1c)", color: "#fff", boxShadow: "0 4px 16px rgba(220,38,38,0.3)" };
    return { ...base, background: "rgba(255,255,255,0.07)", color: C.text, border: "1px solid rgba(255,255,255,0.1)" };
  };

  // ═══════════════════════════════════════════════════════════════════
  // SETUP SCREEN
  // ═══════════════════════════════════════════════════════════════════
  if (phase === PHASE.SETUP) {
    const rule = (icon, text) => (
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 10 }}>
        <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>{icon}</span>
        <span style={{ color: "#a89878", fontSize: 13, lineHeight: 1.6 }}>{text}</span>
      </div>
    );
    return (
      <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: C.font }}>
        <div style={{ position: "fixed", inset: 0, background: "radial-gradient(ellipse at 50% 60%, rgba(20,80,45,0.18) 0%, transparent 65%)", pointerEvents: "none" }} />
        <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 380, padding: "0 20px", display: "flex", flexDirection: "column", alignItems: "center" }}>
          {/* Logo */}
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <div style={{ fontSize: 11, letterSpacing: 6, color: C.muted, marginBottom: 6, fontWeight: 500 }}>THE CARD GAME</div>
            <h1 style={{ fontFamily: C.title, fontSize: 52, fontWeight: 900, letterSpacing: 8, margin: 0, background: "linear-gradient(135deg, #c9a227 0%, #f0d060 45%, #c9a227 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>CAMBIO</h1>
          </div>

          {/* Rules card */}
          <div style={{ width: "100%", background: "rgba(255,255,255,0.03)", border: `1px solid ${C.border}`, borderRadius: 16, padding: "20px 22px", marginBottom: 28 }}>
            <div style={{ fontFamily: C.title, fontSize: 11, letterSpacing: 3, color: C.gold, marginBottom: 16, fontWeight: 700 }}>HOW TO PLAY</div>
            {rule("🎯", <><strong style={{ color: C.text }}>Lowest score wins.</strong> Start with 4 face-down cards — peek at your bottom 2.</>)}
            {rule("🃏", "Each turn: draw a card, then swap it into your hand or discard it to trigger its ability.")}
            {rule("⚡", <><strong style={{ color: C.text }}>Stick</strong> — if you hold a card matching the discard, play it to remove it from your hand.</>)}
            {rule("🔔", <>Call <strong style={{ color: C.gold }}>CAMBIO</strong> when you think you have the lowest hand. Opponent gets one last turn.</>)}
            <div style={{ borderTop: `1px solid ${C.border}`, marginTop: 14, paddingTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 16px", fontSize: 11, color: C.muted, lineHeight: 1.7 }}>
              <div><span style={{ color: "#6b7280" }}>A</span> = 1 &nbsp;·&nbsp; <span style={{ color: "#6b7280" }}>2-10</span> = face</div>
              <div><span style={{ color: "#6b7280" }}>J/Q/K</span> = 10 pts</div>
              <div><span style={{ color: "#6b7280" }}>Red K</span> = −1 pts</div>
              <div><span style={{ color: "#6b7280" }}>Joker</span> = 0 pts</div>
              <div style={{ gridColumn: "1/-1", borderTop: `1px solid ${C.border}`, marginTop: 4, paddingTop: 8 }}>
                <span style={{ color: "#6b7280" }}>7/8</span> peek own &nbsp;·&nbsp; <span style={{ color: "#6b7280" }}>9/10</span> peek opp<br />
                <span style={{ color: "#6b7280" }}>J/Q</span> blind swap &nbsp;·&nbsp; <span style={{ color: "#6b7280" }}>Black K</span> look &amp; swap
              </div>
            </div>
          </div>

          <button style={{ ...btn("primary"), padding: "14px 44px", fontSize: 14, letterSpacing: 2, fontFamily: C.title }} onClick={startGame}>
            DEAL CARDS
          </button>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // REVEAL SCREEN
  // ═══════════════════════════════════════════════════════════════════
  if (phase === PHASE.REVEAL && scores) {
    const won = scores.winner === "player";
    return (
      <div style={{ minHeight: "100vh", background: C.bg, fontFamily: C.font, color: C.text }}>
        <div style={{ position: "fixed", inset: 0, background: `radial-gradient(ellipse at 50% 40%, ${won ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.1)"} 0%, transparent 65%)`, pointerEvents: "none" }} />
        <div style={{ position: "relative", zIndex: 1, maxWidth: 400, margin: "0 auto", padding: "28px 16px", display: "flex", flexDirection: "column", alignItems: "center", minHeight: "100vh" }}>

          {/* Result banner */}
          <div style={{ textAlign: "center", marginBottom: 28, animation: "winnerPop 0.5s ease-out" }}>
            <div style={{ fontSize: 44, marginBottom: 6 }}>{won ? "🏆" : "💀"}</div>
            <div style={{ fontFamily: C.title, fontSize: 26, fontWeight: 900, letterSpacing: 3, color: won ? "#22c55e" : "#ef4444" }}>
              {won ? "YOU WIN" : "YOU LOSE"}
            </div>
          </div>

          {/* Score cards */}
          <div style={{ display: "flex", gap: 12, width: "100%", marginBottom: 28 }}>
            {[
              { label: "Opponent", score: scores.ai, winner: scores.winner === "ai" },
              { label: "You", score: scores.player, winner: scores.winner === "player" },
            ].map(({ label, score, winner: w }) => (
              <div key={label} style={{
                flex: 1, background: w ? "rgba(212,175,55,0.08)" : C.surface,
                border: `1px solid ${w ? C.gold : C.border}`,
                borderRadius: 12, padding: "14px 12px", textAlign: "center",
              }}>
                <div style={{ fontSize: 11, color: C.muted, letterSpacing: 2, fontWeight: 600, marginBottom: 6 }}>{label.toUpperCase()}</div>
                <div style={{ fontFamily: C.title, fontSize: 32, fontWeight: 700, color: w ? C.gold : C.text }}>{score}</div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>pts</div>
              </div>
            ))}
          </div>

          {/* Hands */}
          <div style={{ width: "100%", marginBottom: 16 }}>
            <div style={{ fontSize: 10, letterSpacing: 3, color: C.muted, fontWeight: 600, marginBottom: 10, textAlign: "center" }}>OPPONENT'S HAND</div>
            {renderHand(aiHand, "ai")}
          </div>
          <div style={{ width: "100%", marginBottom: 32 }}>
            <div style={{ fontSize: 10, letterSpacing: 3, color: C.muted, fontWeight: 600, marginBottom: 10, textAlign: "center" }}>YOUR HAND</div>
            {renderHand(playerHand, "player")}
          </div>

          <button style={{ ...btn("primary"), padding: "13px 40px", fontSize: 13, letterSpacing: 2, fontFamily: C.title }} onClick={startGame}>
            PLAY AGAIN
          </button>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // GAME SCREEN
  // ═══════════════════════════════════════════════════════════════════
  const discardTop = discard.length > 0 ? discard[discard.length - 1] : null;

  const phaseLabel = {
    [PHASE.PEEK]: "PEEK PHASE",
    [PHASE.DRAW]: "YOUR TURN",
    [PHASE.DRAWN]: "SWAP OR DISCARD",
    [PHASE.ABILITY]: "USE ABILITY",
    [PHASE.AI_TURN]: "OPPONENT'S TURN",
    [PHASE.FINAL_STICK]: "FINAL TURN",
    [PHASE.REVEAL]: "REVEAL",
  }[phase] || "";

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: C.font, color: C.text, display: "flex", flexDirection: "column" }}>
      {/* Ambient felt glow */}
      <div style={{ position: "fixed", inset: 0, background: "radial-gradient(ellipse at 50% 45%, rgba(16,90,50,0.12) 0%, transparent 60%)", pointerEvents: "none" }} />

      <div style={{ position: "relative", zIndex: 1, maxWidth: 420, width: "100%", margin: "0 auto", padding: "0 14px", display: "flex", flexDirection: "column", flex: 1 }}>

        {/* ── Header ── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 0 10px" }}>
          <h1 style={{ fontFamily: C.title, fontSize: 22, fontWeight: 900, letterSpacing: 5, margin: 0, background: "linear-gradient(135deg, #c9a227, #f0d060, #c9a227)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>CAMBIO</h1>
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 2, color: cambioCaller ? "#f59e0b" : C.muted, background: cambioCaller ? "rgba(245,158,11,0.1)" : "rgba(255,255,255,0.04)", border: `1px solid ${cambioCaller ? "rgba(245,158,11,0.3)" : C.border}`, borderRadius: 20, padding: "4px 10px" }}>
            {cambioCaller ? (cambioCaller === "player" ? "FINAL ROUND" : "FINAL TURN") : phaseLabel}
          </div>
        </div>

        {/* ── Opponent zone ── */}
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: "12px 14px 14px", marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: 2.5, color: C.muted }}>OPPONENT</span>
            <span style={{ fontSize: 10, color: C.muted, background: "rgba(255,255,255,0.05)", borderRadius: 10, padding: "2px 8px" }}>
              {aiHand.filter(Boolean).length} cards
            </span>
          </div>
          {renderHand(aiHand, "ai")}
        </div>

        {/* ── Table felt ── */}
        <div style={{ background: "rgba(12,40,24,0.55)", border: "1px solid rgba(34,120,60,0.2)", borderRadius: 16, padding: "14px 12px", marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 14 }}>

            {/* Deck */}
            <div style={{ textAlign: "center" }}>
              <div
                onClick={drawFromDeck}
                style={{
                  width: 68, height: 96, borderRadius: 10, position: "relative",
                  cursor: phase === PHASE.DRAW && deck.length > 0 ? "pointer" : "default",
                  opacity: deck.length === 0 ? 0.25 : 1,
                  transition: "all 0.18s",
                  boxShadow: phase === PHASE.DRAW && deck.length > 0
                    ? "0 0 0 2px #d4af37, 0 8px 24px rgba(212,175,55,0.3)"
                    : "0 4px 14px rgba(0,0,0,0.6)",
                  animation: phase === PHASE.DRAW && deck.length > 0 ? "pulseBorder 2s infinite" : undefined,
                }}
              >
                {/* Stack layers */}
                {[3,2,1].map(i => (
                  <div key={i} style={{
                    position: "absolute", inset: 0, borderRadius: 10,
                    background: "linear-gradient(145deg, #1c3f6e, #0d2444)",
                    border: "1.5px solid rgba(212,175,55,0.2)",
                    transform: `translateY(${i * 1.5}px) translateX(${i * 0.5}px)`,
                    zIndex: i,
                  }} />
                ))}
                <div style={{
                  position: "absolute", inset: 0, borderRadius: 10, zIndex: 4,
                  background: "linear-gradient(145deg, #1c3f6e, #0d2444)",
                  border: "1.5px solid rgba(212,175,55,0.28)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  overflow: "hidden",
                }}>
                  <div style={{ position: "absolute", inset: 0, backgroundImage: "repeating-linear-gradient(45deg, transparent, transparent 9px, rgba(212,175,55,0.05) 9px, rgba(212,175,55,0.05) 10px)" }} />
                  <div style={{ position: "absolute", inset: 6, border: "1px solid rgba(212,175,55,0.2)", borderRadius: 5 }} />
                  <span style={{ fontSize: 20, color: "rgba(212,175,55,0.3)", zIndex: 1 }}>✦</span>
                </div>
              </div>
              <div style={{ fontSize: 10, color: C.muted, marginTop: 6, fontWeight: 500 }}>Deck · {deck.length}</div>
            </div>

            {/* Discard */}
            <div style={{ textAlign: "center" }}>
              <div
                onClick={drawFromDiscard}
                style={{
                  width: 68, height: 96, borderRadius: 10, position: "relative",
                  cursor: phase === PHASE.DRAW && discardTop ? "pointer" : "default",
                  transition: "all 0.18s",
                  boxShadow: phase === PHASE.DRAW && discardTop
                    ? "0 0 0 2px #d4af37, 0 8px 24px rgba(212,175,55,0.3)"
                    : discardTop ? "0 4px 14px rgba(0,0,0,0.5)" : "none",
                  background: discardTop ? "linear-gradient(150deg, #fff 0%, #f7f2e8 100%)" : "rgba(255,255,255,0.03)",
                  border: discardTop ? "1px solid rgba(0,0,0,0.1)" : `1.5px dashed ${C.border}`,
                }}
              >
                {discardTop ? (
                  <>
                    <div style={{ position: "absolute", top: 5, left: 6, color: cardColor(discardTop), lineHeight: 1.1 }}>
                      <div style={{ fontSize: 14, fontWeight: 800, fontFamily: "Georgia, serif" }}>{discardTop.isJoker ? "🃏" : discardTop.rank}</div>
                      {!discardTop.isJoker && <div style={{ fontSize: 11 }}>{discardTop.suit}</div>}
                    </div>
                    <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", fontSize: discardTop.isJoker ? 36 : 28, color: cardColor(discardTop), lineHeight: 1 }}>
                      {discardTop.isJoker ? "🃏" : discardTop.suit}
                    </div>
                    {!discardTop.isJoker && (
                      <div style={{ position: "absolute", bottom: 5, right: 6, color: cardColor(discardTop), lineHeight: 1.1, transform: "rotate(180deg)" }}>
                        <div style={{ fontSize: 14, fontWeight: 800, fontFamily: "Georgia, serif" }}>{discardTop.rank}</div>
                        <div style={{ fontSize: 11 }}>{discardTop.suit}</div>
                      </div>
                    )}
                  </>
                ) : (
                  <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: C.muted, letterSpacing: 1, fontWeight: 600 }}>DISCARD</div>
                )}
              </div>
              <div style={{ fontSize: 10, color: C.muted, marginTop: 6, fontWeight: 500 }}>Discard</div>
            </div>

            {/* Drawn card */}
            {drawnCard && (
              <div style={{ textAlign: "center" }}>
                <CardView card={drawnCard} faceUp highlighted selectable={false} showAbility />
                <div style={{ fontSize: 10, color: C.gold, marginTop: 6, fontWeight: 600, letterSpacing: 1 }}>DRAWN</div>
              </div>
            )}
          </div>
        </div>

        {/* ── Toast message ── */}
        <div key={message} style={{
          background: "rgba(8,11,18,0.9)", border: `1px solid rgba(212,175,55,0.25)`,
          backdropFilter: "blur(8px)", borderRadius: 10,
          padding: "10px 16px", fontSize: 13, textAlign: "center", color: "#e8d9b8",
          marginBottom: 10, lineHeight: 1.5, fontWeight: 500,
          animation: "fadeSlideUp 0.25s ease-out",
          boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
        }}>{message}</div>

        {/* ── Action buttons ── */}
        <div style={{ display: "flex", justifyContent: "center", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          {phase === PHASE.DRAWN && drawnFrom === "deck" && (
            <button style={btn("ghost")} onClick={discardDrawn}>
              {getCardAbility(drawnCard) ? `Use ${drawnCard.rank} ability` : "Discard"}
            </button>
          )}
          {phase === PHASE.ABILITY && (
            <button style={btn("ghost")} onClick={skipAbility}>Skip Ability</button>
          )}
          {phase === PHASE.DRAW && !cambioCaller && (
            <button style={btn("primary")} onClick={callCambio}>Call CAMBIO</button>
          )}
          {phase === PHASE.FINAL_STICK && (
            <button style={btn("primary")} onClick={doReveal}>End Turn</button>
          )}
          {stickMode === "swap" && (
            <>
              <button style={btn("danger")} onClick={() => { setStickMode(false); setStickTarget(null); }}>Cancel</button>
              <div style={{ width: "100%", textAlign: "center", fontSize: 12, color: C.gold, fontWeight: 500 }}>
                Pick one of your cards to give the opponent
              </div>
            </>
          )}
        </div>

        {/* ── Player zone ── */}
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: "12px 14px 14px", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: 2.5, color: C.gold }}>YOU</span>
            <span style={{ fontSize: 10, color: C.muted, background: "rgba(255,255,255,0.05)", borderRadius: 10, padding: "2px 8px" }}>
              {playerHand.filter(Boolean).length} cards
            </span>
          </div>
          {renderHand(playerHand, "player")}
        </div>

      </div>
    </div>
  );
}
