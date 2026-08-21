import { Verdict, judge, unanswerableAttacks } from './checkmate';
import { Color, EMPTY, Piece } from './piece';
import { State, Timeline, ref } from './state';
import { applyTurn } from './turn';

function boards(size: number, lines: { index: number, count: number }[]): State {
	return new State(size, lines.map(line => {
		const timeline: Timeline = { index: line.index, startT: 0, parent: line.index === 0 ? null : 0, boards: [] };
		for (let t = 0; t < line.count; t++) {
			timeline.boards.push({ t, squares: new Int16Array(size * size).fill(EMPTY) });
		}
		return timeline;
	}));
}

describe('judging a position', () => {
	it('calls an ordinary position playable', () => {
		const state = boards(8, [{ index: 0, count: 1 }]);
		state.set(ref(0, 0, 7, 4), Piece.white_king);
		const found = judge(state, Color.white);
		expect(found.verdict).toBe(Verdict.playable);
		expect(found.turn).not.toBeNull();
	});

	it('calls a trapped king trapped', () => {
		const state = boards(8, [{ index: 0, count: 1 }]);
		state.set(ref(0, 0, 7, 4), Piece.white_king);
		state.set(ref(0, 0, 1, 4), Piece.black_rook);
		state.set(ref(0, 0, 0, 3), Piece.black_rook);
		state.set(ref(0, 0, 0, 5), Piece.black_rook);
		expect(judge(state, Color.white).verdict).toBe(Verdict.trapped);
	});

	it('says it does not know rather than guessing when time runs out', () => {
		const state = boards(8, [{ index: 0, count: 1 }]);
		state.set(ref(0, 0, 7, 4), Piece.white_king);
		state.set(ref(0, 0, 1, 4), Piece.black_rook);
		state.set(ref(0, 0, 0, 3), Piece.black_rook);
		state.set(ref(0, 0, 0, 5), Piece.black_rook);
		expect(judge(state, Color.white, { until: Date.now() - 1 }).verdict).toBe(Verdict.unknown);
	});
});

describe('escaping by moving the present backwards', () => {
	/** A back rank mate, on a timeline that has a past to retreat into. */
	function withHistory(boardCount: number): State {
		const state = boards(8, [{ index: 0, count: boardCount }]);
		const last = boardCount - 1;
		state.set(ref(0, last, 7, 4), Piece.white_king);
		state.set(ref(0, last, 1, 4), Piece.black_rook);
		state.set(ref(0, last, 0, 3), Piece.black_rook);
		state.set(ref(0, last, 0, 5), Piece.black_rook);
		return state;
	}

	it('is mate when there is nowhere back to go', () => {
		expect(judge(withHistory(1), Color.white).verdict).toBe(Verdict.trapped);
	});

	it('is not mate once an earlier board exists to branch to', () => {
		const state = withHistory(5);
		const found = judge(state, Color.white);
		expect(found.verdict).toBe(Verdict.playable);
		// The saving move goes back in time, starting a timeline earlier than the
		// attackers and leaving them ahead of the new present.
		expect(found.turn!.some(move => move.to.t < move.from.t)).toBe(true);
	});

	it('leaves the attackers behind the new present', () => {
		const state = withHistory(5);
		const found = judge(state, Color.white);
		applyTurn(state, found.turn!);
		expect(state.present()).toBeLessThan(4);
	});
});

describe('attacks no turn could ever answer', () => {
	/**
	 * White has already moved on timeline 0 and black has not replied, so that board
	 * is black's to play. White's king sits there under fire, and white's move is due
	 * on timeline 1 — where nothing they can do reaches the other board at all.
	 */
	function strandedKing(): State {
		const state = boards(8, [{ index: 0, count: 2 }, { index: 1, count: 1 }]);
		state.set(ref(0, 1, 7, 4), Piece.white_king);
		state.set(ref(0, 1, 0, 4), Piece.black_rook);
		state.set(ref(1, 0, 4, 4), Piece.white_rook);
		return state;
	}

	it('leaves white to move, on the other timeline', () => {
		const state = strandedKing();
		expect(state.present()).toBe(0);
		expect(state.requiredLines(Color.white)).toEqual([1]);
	});

	it('leaves white trapped, though it takes a search to show it', () => {
		const state = strandedKing();
		// The rook is a half-move ahead of the present, so it is not yet a threat;
		// white's own move carries the present up to meet it.
		expect(unanswerableAttacks(state, Color.white).length).toBe(0);
		expect(judge(state, Color.white).verdict).toBe(Verdict.trapped);
	});

	it('is answered once the king can be shielded', () => {
		const state = strandedKing();
		// A rook in the line of fire on that same board: now nothing gets through.
		state.set(ref(0, 1, 4, 4), Piece.white_rook);
		expect(judge(state, Color.white).verdict).toBe(Verdict.playable);
	});
});
