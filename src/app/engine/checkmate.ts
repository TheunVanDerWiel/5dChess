import { Attack, attacksOn, movableBy } from './attacks';
import { Move } from './movegen';
import { Color, opponent } from './piece';
import { State } from './state';
import { Color as Side } from './piece';
import { DEFAULT_BUDGET, Limits, findLegalTurn } from './search';

export enum Verdict {
	/** The colour has a turn it can legally play. */
	playable = 'playable',
	/** The colour has no legal turn at all. */
	trapped = 'trapped',
	/** The search ran out of time without settling it. */
	unknown = 'unknown'
}

export interface Judgement {
	verdict: Verdict;
	/** A turn that proves the position playable. */
	turn: Move[] | null;
	/** Attacks that no turn could ever answer, when that is what settles it. */
	unanswerable: Attack[];
	nodes: number;
	ms: number;
}

/** How long the search may take before it gives up and says it does not know. */
export const DEFAULT_DEADLINE = 5000;

function defaults(): Limits {
	return { budget: DEFAULT_BUDGET, until: Date.now() + DEFAULT_DEADLINE };
}

/**
 * Attacks that no turn can answer, however it is played.
 *
 * A move only ever creates boards; it never alters one that already exists. So if an
 * attacker stands on a board the colour cannot move on, nothing about that attack can
 * be changed: the attacker cannot be taken, because reaching its board would mean
 * moving to a board awaiting the other colour, which no move does; the royal cannot
 * step away, because it stands on a board that is already history; and the line
 * between them cannot be blocked, because every board along it already exists and a
 * new board is only ever created where there was none.
 *
 * One of these is therefore proof that the colour is trapped, found in a single scan.
 * The proof holds only while the present cannot be dragged backwards, though: a move
 * into the past starts a timeline earlier than everything else, and an attacker left
 * ahead of the new present stops threatening however untouchable it is.
 */
export function unanswerableAttacks(state: State, color: Color): Attack[] {
	const attacks = attacksOn(state, color, movableBy(state, opponent(color)));
	if (attacks.length === 0) { return []; }
	if (!canActivateTimeline(state, color)) {
		// Without a timeline that counts, moves can only carry the present forward,
		// and an attack at or before it stays at or before it.
		return attacks;
	}
	const earliest = Math.min(...state.timelines.map(line => line.startT));
	const lowest = Math.min(...attacks.map(attack => attack.from.t));
	// A branch can begin no earlier than one half-move after the earliest board there
	// is, so if even that would not strand the nearest attacker, nothing will.
	return earliest + 1 >= lowest ? attacks : [];
}

/**
 * Whether a timeline the colour started would be an active one. Only active
 * timelines are counted when working out the present, so only these can drag it
 * back; once a player's spare is spent, branching no longer changes the present.
 */
export function canActivateTimeline(state: State, color: Color): boolean {
	const index = color === Side.white ? state.maxIndex + 1 : state.minIndex - 1;
	let positive = index > 0 ? 1 : 0;
	let negative = index < 0 ? 1 : 0;
	for (const line of state.timelines) {
		if (line.index > 0) { positive++; }
		if (line.index < 0) { negative++; }
	}
	return Math.abs(index) <= Math.min(positive, negative) + 1;
}

/**
 * Whether the colour can play at all: the question behind both checkmate and
 * stalemate, which differ only in whether the colour was under attack to begin with.
 */
export function judge(state: State, color: Color, limits: Limits = defaults()): Judgement {
	const started = Date.now();
	const unanswerable = unanswerableAttacks(state, color);
	if (unanswerable.length > 0) {
		return {
			verdict: Verdict.trapped, turn: null, unanswerable,
			nodes: 0, ms: Date.now() - started
		};
	}

	const search = findLegalTurn(state, color, limits);
	if (search.turn !== null) {
		return {
			verdict: Verdict.playable, turn: search.turn, unanswerable: [],
			nodes: search.nodes, ms: Date.now() - started
		};
	}
	return {
		// Only an exhausted search proves the point; a search that ran out of time
		// proves nothing, and must never be reported as a loss.
		verdict: search.complete ? Verdict.trapped : Verdict.unknown,
		turn: null, unanswerable: [],
		nodes: search.nodes, ms: Date.now() - started
	};
}
