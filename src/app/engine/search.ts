import { isAttacked, movableBy } from './attacks';
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

/**
 * Looks for one turn the colour could legally play.
 *
 * A turn is a set of moves, not a sequence: each timeline is moved on at most once,
 * because moving on a board hands it to the other colour. So the search walks the
 * timelines in a fixed order and decides, for each, whether to move there — which
 * enumerates sets rather than orderings and keeps the same turn from being tried
 * every possible way round.
 *
 * Whether the turn is legal is only asked at the end. A player may leave a royal
 * capturable partway through their own turn, as long as the position they finally
 * hand over does not.
 */
export function findLegalTurn(state: State, color: Color, limits: Limits = {}): TurnSearch {
	const budget: Budget = {
		nodes: 0,
		left: limits.budget ?? DEFAULT_BUDGET,
		until: limits.until ?? Number.POSITIVE_INFINITY,
		spent: false
	};
	// Timelines created while searching start on the other colour's move, so they
	// can never be moved on this turn and the list is safe to fix up front.
	const lines = state.timelines.map(line => line.index);
	const obliged = new Set(state.requiredLines(color));
	// Under attack, a move into the past is the one that can drag the present back
	// and strand the attacker ahead of it, so those are worth trying first.
	const threatened = isAttacked(state, color, movableBy(state, opponent(color)));
	const turn = explore(state, color, lines, obliged, [], 0, budget, threatened);
	return { turn, nodes: budget.nodes, complete: !budget.spent };
}

/** Whether the colour has anything left to answer for and has come out of it safely. */
export function isTurnLegal(state: State, color: Color): boolean {
	return state.requiredLines(color).length === 0
		&& !isAttacked(state, color, movableBy(state, opponent(color)));
}

function explore(state: State, color: Color, lines: number[], obliged: Set<number>,
	chosen: Move[], index: number, budget: Budget, threatened: boolean): Move[] | null {
	budget.nodes++;
	// Checking the clock costs about as much as a node, so only look now and then.
	if (budget.left-- <= 0 || ((budget.nodes & 255) === 1 && Date.now() >= budget.until)) {
		budget.spent = true;
		return null;
	}

	if (index >= lines.length) {
		return isTurnLegal(state, color) ? chosen.slice() : null;
	}

	const line = lines[index];
	const playable = state.line(line) !== null && colorToMove(state.headT(line)) === color;
	// Somewhere the player has to move; elsewhere they need not, and trying that
	// first keeps optional timelines from multiplying the search for no reason.
	const moveFirst = obliged.has(line);

	if (!moveFirst) {
		const skipped = explore(state, color, lines, obliged, chosen, index + 1, budget, threatened);
		if (skipped !== null) { return skipped; }
	}

	if (playable) {
		for (const move of ordered(state, line, threatened)) {
			const applied = applyMove(state, move);
			chosen.push(move);
			const found = explore(state, color, lines, obliged, chosen, index + 1, budget, threatened);
			chosen.pop();
			undoMove(state, applied);
			if (found !== null) { return found; }
			if (budget.spent) { return null; }
		}
	}

	if (moveFirst) {
		// Even an obliged board can be left alone, as long as a move from somewhere
		// else lands on it and carries it forward.
		return explore(state, color, lines, obliged, chosen, index + 1, budget, threatened);
	}
	return null;
}

/** Moves for a board, deepest journey into the past first when that might help. */
function ordered(state: State, line: number, threatened: boolean): Move[] {
	const moves = movesForLine(state, line);
	if (!threatened) { return moves; }
	return moves.sort((one, two) => (one.to.t - one.from.t) - (two.to.t - two.from.t));
}
