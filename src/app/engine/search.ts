import { isAttacked, movableBy, settledBy } from './attacks';
import { Move, movesForLine } from './movegen';
import { Color, opponent } from './piece';
import { State, colorToMove } from './state';
import { applyMove, undoMove } from './turn';

/** How many positions a search will look at before giving up. */
export const DEFAULT_BUDGET = 100000;

export interface Limits {
	/** Most positions to examine. */
	budget?: number;
	/** A wall clock time to stop at, from Date.now(). */
	until?: number;
}

export interface TurnSearch {
	/** A complete, legal turn, or null if none was found. */
	turn: Move[] | null;
	/** How many positions were examined. */
	nodes: number;
	/**
	 * Whether the search finished rather than running out of budget. A null turn
	 * only means something when this is true.
	 */
	complete: boolean;
}

interface Budget {
	nodes: number;
	left: number;
	until: number;
	spent: boolean;
}

/** What the search works from, settled once before it starts. */
interface Plan {
	color: Color;
	/** The timelines the colour can move on, in the order they are decided. */
	lines: number[];
	/** Timelines the colour has to carry forward this turn. */
	obliged: Set<number>;
	/**
	 * For each obliged timeline, the furthest position in `lines` holding a move that
	 * could land on it and carry it forward instead. Absent when there is no such move,
	 * and null altogether when the obligations themselves could still be lifted.
	 */
	lastArrival: Map<number, number> | null;
	/** Whether the colour is under attack, which makes moves into the past worth trying first. */
	threatened: boolean;
}

/**
 * Looks for one turn the colour could legally play.
 *
 * A turn is a set of moves, not a sequence: each timeline is moved on at most once,
 * because moving on a board hands it to the other colour. So the search walks the
 * timelines in a fixed order and decides, for each, whether to move there — which
 * enumerates sets rather than orderings and keeps the same turn from being tried
 * every possible way round.
 *
 * Whether the turn is legal is only settled at the end. A player may leave a royal
 * capturable partway through their own turn, as long as the position they finally
 * hand over does not. Some attacks are past saving the moment they appear, though,
 * and a turn that has made one is abandoned there and then.
 */
export function findLegalTurn(state: State, color: Color, limits: Limits = {}): TurnSearch {
	const budget: Budget = {
		nodes: 0,
		left: limits.budget ?? DEFAULT_BUDGET,
		until: limits.until ?? Number.POSITIVE_INFINITY,
		spent: false
	};
	const plan = survey(state, color, budget);
	const turn = plan === null ? null : explore(state, plan, [], 0, budget, false);
	return { turn, nodes: budget.nodes, complete: !budget.spent };
}

/** Whether the colour has anything left to answer for and has come out of it safely. */
export function isTurnLegal(state: State, color: Color): boolean {
	return state.requiredLines(color).length === 0
		&& !isAttacked(state, color, movableBy(state, opponent(color)));
}

/**
 * Whether a timeline the colour started would be an active one. Only active
 * timelines are counted when working out the present, so only these can drag it
 * back; once a player's spare is spent, branching no longer changes the present.
 */
export function canActivateTimeline(state: State, color: Color): boolean {
	const index = color === Color.white ? state.maxIndex + 1 : state.minIndex - 1;
	let positive = index > 0 ? 1 : 0;
	let negative = index < 0 ? 1 : 0;
	for (const line of state.timelines) {
		if (line.index > 0) { positive++; }
		if (line.index < 0) { negative++; }
	}
	return Math.abs(index) <= Math.min(positive, negative) + 1;
}

/**
 * The earliest the present could stand once the colour has finished a legal turn,
 * however the rest of it is played.
 *
 * Without a timeline that counts, a move only ever adds boards to the end of a
 * timeline, so the present never goes back; and a turn is not finished until the
 * present has passed to the other colour. With one, a move into the past can drag
 * the present back, though no earlier than one half-move after the earliest board.
 */
export function presentFloor(state: State, color: Color): number {
	const present = state.present();
	const handedOver = colorToMove(present) === color ? present + 1 : present;
	if (!canActivateTimeline(state, color)) { return handedOver; }
	const earliest = Math.min(...state.timelines.map(line => line.startT));
	return Math.min(handedOver, earliest + 1);
}

/**
 * Whether the colour's royals are under an attack the rest of the turn cannot answer:
 * the attacker cannot be taken, the royal cannot step away and the line cannot be
 * blocked, because every board involved is already history or awaits the attacker.
 */
export function isDoomed(state: State, color: Color): boolean {
	return isAttacked(state, color, settledBy(state, opponent(color), presentFloor(state, color)));
}

/**
 * Tries every move once on its own, before searching for combinations of them.
 *
 * A move that dooms the colour by itself dooms every turn it is part of: the boards
 * it creates are the same whatever else is played, as long as it lands on the same
 * board, and the rest of the turn can only carry the present forward. Moves into the
 * past aside, that is. That leaves two things worth knowing up front. Timelines where
 * almost every move is fatal are the ones to decide first, since they cut the search
 * down the most. And an obliged timeline nobody can safely move on, or land on, means
 * there is no turn at all, which the search then sees before it has started.
 *
 * Returns null if the budget ran out while looking.
 */
function survey(state: State, color: Color, budget: Budget): Plan | null {
	const obliged = new Set(state.requiredLines(color));
	// Lines created while searching start on the other colour's move, so they can never
	// be moved on this turn, and nothing else can become playable that was not already.
	const playable = state.timelines
		.map(line => line.index)
		.filter(index => colorToMove(state.headT(index)) === color);
	const safe = new Map<number, number>(playable.map(line => [line, 0]));
	const arrivals = new Map<number, Set<number>>();
	for (const line of playable) {
		for (const move of movesForLine(state, line)) {
			if (tick(budget)) { return null; }
			const applied = applyMove(state, move);
			const doomed = isDoomed(state, color);
			undoMove(state, applied);
			if (doomed) { continue; }
			safe.set(line, safe.get(line)! + 1);
			if (applied.advanced.length > 1) {
				const landed = applied.advanced[1];
				if (!arrivals.has(landed)) { arrivals.set(landed, new Set()); }
				arrivals.get(landed)!.add(line);
			}
		}
	}

	// Obliged lines first, fewest safe moves first among them; the others are only ever
	// moved on if leaving them be finds nothing. Otherwise the timelines furthest from
	// the colour's own side go first: an attack there is the hardest to answer, since
	// answering one from the past means branching, and branches start on the colour's
	// own side, about as far from those boards as anything can be.
	const farthest = color === Color.white ? 1 : -1;
	const lines = playable.slice().sort((one, two) => {
		const a = obliged.has(one), b = obliged.has(two);
		if (a !== b) { return a ? -1 : 1; }
		const easier = a ? safe.get(one)! - safe.get(two)! : 0;
		return easier !== 0 ? easier : farthest * (one - two);
	});

	let lastArrival: Map<number, number> | null = null;
	// Only while the present cannot be dragged back are the obligations here to stay.
	if (!canActivateTimeline(state, color)) {
		lastArrival = new Map();
		for (const [landed, sources] of arrivals) {
			lastArrival.set(landed, Math.max(...[...sources].map(source => lines.indexOf(source))));
		}
	}

	return {
		color, lines, obliged, lastArrival,
		threatened: isAttacked(state, color, movableBy(state, opponent(color)))
	};
}

/** Counts a node, and says whether the search has to stop. */
function tick(budget: Budget): boolean {
	budget.nodes++;
	// Checking the clock costs about as much as a node, so only look now and then.
	if (budget.left-- <= 0 || ((budget.nodes & 255) === 1 && Date.now() >= budget.until)) {
		budget.spent = true;
	}
	return budget.spent;
}

/**
 * Decides the timelines from `index` on. `moved` says a move has just been played,
 * which is when a turn can have doomed itself.
 */
function explore(state: State, plan: Plan, chosen: Move[], index: number, budget: Budget,
	moved: boolean): Move[] | null {
	if (tick(budget)) { return null; }

	const color = plan.color;
	if (index >= plan.lines.length) {
		return isTurnLegal(state, color) ? chosen.slice() : null;
	}
	if (moved && isDoomed(state, color)) { return null; }

	const line = plan.lines[index];
	// A move from elsewhere may have landed here and carried this board forward already.
	const playable = colorToMove(state.headT(line)) === color;
	// Somewhere the player has to move; elsewhere they need not, and trying that
	// first keeps optional timelines from multiplying the search for no reason.
	const moveFirst = plan.obliged.has(line);
	// An obliged board left alone has to be landed on by a move from a timeline still
	// to come, and if no such move is safe, leaving it is pointless.
	const mayLeave = !moveFirst || !playable || plan.lastArrival === null
		|| (plan.lastArrival.get(line) ?? -1) > index;

	if (!moveFirst) {
		const skipped = explore(state, plan, chosen, index + 1, budget, false);
		if (skipped !== null) { return skipped; }
	}

	if (playable) {
		for (const move of ordered(state, line, plan.threatened)) {
			const applied = applyMove(state, move);
			chosen.push(move);
			const found = explore(state, plan, chosen, index + 1, budget, true);
			chosen.pop();
			undoMove(state, applied);
			if (found !== null) { return found; }
			if (budget.spent) { return null; }
		}
	}

	if (moveFirst && mayLeave) {
		// Even an obliged board can be left alone, as long as a move from somewhere
		// else lands on it and carries it forward.
		return explore(state, plan, chosen, index + 1, budget, false);
	}
	return null;
}

/** Moves for a board, deepest journey into the past first when that might help. */
function ordered(state: State, line: number, threatened: boolean): Move[] {
	const moves = movesForLine(state, line);
	if (!threatened) { return moves; }
	return moves.sort((one, two) => (one.to.t - one.from.t) - (two.to.t - two.from.t));
}
