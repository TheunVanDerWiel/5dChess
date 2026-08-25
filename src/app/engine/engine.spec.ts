import { KNIGHT_OFFSETS, SLIDING } from './geometry';
import { Color, EMPTY, Piece } from './piece';
import { State, Timeline, colorToMove, ref } from './state';
import { movesForLine, targets } from './movegen';
import { applyMove, isTurnComplete, undoMove } from './turn';
import { stateFromDto, stateToDto } from './dto';
import { promotes, promotionChoices, promotionRank } from './promotion';
import { GameState } from 'src/app/types/GameState';

/** The opening position the API hands out for a standard game. */
const STANDARD = '{"TimeLines":[{"Index":0,"Boards":[{"Squares":[[2,4,8,16,32,8,4,2],[0,0,0,0,0,0,0,0],[null,null,null,null,null,null,null,null],[null,null,null,null,null,null,null,null],[null,null,null,null,null,null,null,null],[null,null,null,null,null,null,null,null],[1,1,1,1,1,1,1,1],[3,5,9,17,33,9,5,3]]}]}]}';

function standardState(): State {
	return stateFromDto(JSON.parse(STANDARD) as GameState);
}

/** A single empty timeline with `boards` boards, starting at time 0. */
function blankState(size: number, boards = 1): State {
	const line: Timeline = { index: 0, startT: 0, parent: null, boards: [] };
	for (let t = 0; t < boards; t++) {
		line.boards.push({ t, squares: new Int16Array(size * size).fill(EMPTY) });
	}
	return new State(size, [line]);
}

/** Timelines at the given indices, each holding `count` boards from `startT`. */
function timelines(size: number, lines: { index: number, startT: number, count: number }[]): State {
	return new State(size, lines.map(line => {
		const timeline: Timeline = { index: line.index, startT: line.startT, parent: null, boards: [] };
		for (let i = 0; i < line.count; i++) {
			timeline.boards.push({
				t: line.startT + i,
				squares: new Int16Array(size * size).fill(EMPTY)
			});
		}
		return timeline;
	}));
}

/** The two timelines an even number of starting timelines gives: -1 and 1, no 0. */
function evenState(size: number): State {
	return timelines(size, [
		{ index: -1, startT: 0, count: 1 },
		{ index: 1, startT: 0, count: 1 }
	]);
}

describe('geometry', () => {
	it('covers every combination of axes and signs', () => {
		expect(SLIDING[0].length).toBe(8);   // rook
		expect(SLIDING[1].length).toBe(24);  // bishop
		expect(SLIDING[2].length).toBe(32);  // unicorn
		expect(SLIDING[3].length).toBe(16);  // dragon
		expect(KNIGHT_OFFSETS.length).toBe(48);
	});

	it('keeps every direction time-parity preserving', () => {
		for (const family of SLIDING) {
			for (const direction of family) {
				expect(Math.abs(direction[1] % 2)).toBe(0);
			}
		}
	});
});

describe('opening position', () => {
	it('has one active timeline with white to move', () => {
		const state = standardState();
		expect(state.size).toBe(8);
		expect(state.present()).toBe(0);
		expect(colorToMove(state.present())).toBe(Color.white);
		expect(state.requiredLines(Color.white)).toEqual([0]);
		expect(state.requiredLines(Color.black)).toEqual([]);
	});

	it('offers a pawn its single and double step, and nothing across time', () => {
		const state = standardState();
		// White pawns sit on rank index 6 and advance toward index 0.
		const found = targets(state, ref(0, 0, 6, 4)).map(t => `${t.l},${t.t},${t.x},${t.y}`);
		expect(found.sort()).toEqual(['0,0,4,4', '0,0,5,4']);
	});

	it('offers the knight its two board moves', () => {
		const state = standardState();
		expect(targets(state, ref(0, 0, 7, 1)).length).toBe(2);
	});

	it('generates the twenty opening moves of ordinary chess', () => {
		expect(movesForLine(standardState(), 0).length).toBe(20);
	});

	it('survives a round trip through the wire format', () => {
		const dto = stateToDto(standardState());
		expect(JSON.stringify(dto)).toBe(JSON.stringify(JSON.parse(STANDARD)));
	});
});

describe('a missing board blocks a ray', () => {
	it('stops a rook at the edge of the multiverse', () => {
		const state = blankState(3);
		state.set(ref(0, 0, 1, 1), Piece.white_rook);
		// Only the four spatial squares remain: there is no neighbouring timeline and
		// no earlier board, and neither counts as empty space to travel through.
		expect(targets(state, ref(0, 0, 1, 1)).length).toBe(4);
	});

	it('lets the same rook travel back once a past board exists', () => {
		const state = blankState(3, 3);
		state.set(ref(0, 2, 1, 1), Piece.white_rook);
		const found = targets(state, ref(0, 2, 1, 1));
		expect(found.some(t => t.l === 0 && t.t === 0 && t.x === 1 && t.y === 1)).toBe(true);
		// t = 4 does not exist, so the forward direction is blocked rather than empty.
		expect(found.some(t => t.t === 4)).toBe(false);
	});
});

describe('a game that opened on an even number of timelines', () => {
	// There is no index 0 for a piece to pass through, so -1 and 1 are neighbours
	// and everything crossing between them travels a single step.
	it('slides a rook onto the timeline beside it', () => {
		const state = evenState(3);
		state.set(ref(-1, 0, 1, 1), Piece.white_rook);
		const found = targets(state, ref(-1, 0, 1, 1));
		expect(found.some(to => to.l === 1 && to.x === 1 && to.y === 1)).toBe(true);
	});

	it('steps a king across, one timeline and not two', () => {
		const state = evenState(3);
		state.set(ref(-1, 0, 1, 1), Piece.white_king);
		const found = targets(state, ref(-1, 0, 1, 1));
		expect(found.some(to => to.l === 1 && to.x === 1 && to.y === 1)).toBe(true);
	});

	it('advances a pawn across to the timeline beside it', () => {
		const state = evenState(3);
		// A pawn's advance across the multiverse matches its advance up the board, so
		// white travels toward the lower index and black toward the higher one.
		state.set(ref(1, 0, 1, 1), Piece.white_pawn);
		state.set(ref(-1, 0, 0, 0), Piece.black_pawn);
		expect(targets(state, ref(1, 0, 1, 1))
			.some(to => to.l === -1 && to.x === 1 && to.y === 1)).toBe(true);
		expect(targets(state, ref(-1, 0, 0, 0))
			.some(to => to.l === 1 && to.x === 0 && to.y === 0)).toBe(true);
	});

	it('lands a knight two files over on the next timeline', () => {
		const state = evenState(5);
		state.set(ref(-1, 0, 2, 2), Piece.white_knight);
		const found = targets(state, ref(-1, 0, 2, 2));
		expect(found.some(to => to.l === 1 && to.x === 4 && to.y === 2)).toBe(true);
	});

	it('never offers the timeline that is not there', () => {
		const state = evenState(3);
		state.set(ref(-1, 0, 1, 1), Piece.white_queen);
		expect(targets(state, ref(-1, 0, 1, 1)).every(to => to.l === -1 || to.l === 1)).toBe(true);
	});

	it('is still stopped by a timeline with no board at that time', () => {
		// Counting timelines is not licence to pass through one that has not started.
		const state = timelines(3, [
			{ index: -1, startT: 0, count: 1 },
			{ index: 1, startT: 2, count: 1 }
		]);
		state.set(ref(-1, 0, 1, 1), Piece.white_rook);
		expect(targets(state, ref(-1, 0, 1, 1)).some(to => to.l === 1)).toBe(false);
	});
});

describe('playing a move', () => {
	it('advances the timeline and hands the turn over', () => {
		const state = standardState();
		const applied = applyMove(state, { from: ref(0, 0, 6, 4), to: ref(0, 0, 4, 4) });
		expect(state.headT(0)).toBe(1);
		expect(state.at(ref(0, 1, 4, 4))).toBe(Piece.white_pawn);
		expect(state.at(ref(0, 1, 6, 4))).toBe(EMPTY);
		// The board it left is history and must be untouched.
		expect(state.at(ref(0, 0, 6, 4))).toBe(Piece.white_pawn);
		expect(isTurnComplete(state, Color.white)).toBe(true);
		expect(state.present()).toBe(1);

		undoMove(state, applied);
		expect(state.headT(0)).toBe(0);
		expect(state.timelines.length).toBe(1);
	});

	it('branches a new timeline when moving to a board that is not the latest', () => {
		const state = blankState(3, 3);
		state.set(ref(0, 2, 1, 1), Piece.white_rook);
		const applied = applyMove(state, { from: ref(0, 2, 1, 1), to: ref(0, 0, 1, 1) });

		expect(applied.created).toBe(1);
		const branch = state.line(1)!;
		expect(branch.startT).toBe(1);
		expect(branch.parent).toBe(0);
		expect(state.at(ref(1, 1, 1, 1))).toBe(Piece.white_rook);
		expect(state.headT(0)).toBe(3);
		expect(state.at(ref(0, 3, 1, 1))).toBe(EMPTY);

		// The branch drags the present back to the board black now has to answer.
		expect(state.isActive(1)).toBe(true);
		expect(state.present()).toBe(1);
		expect(colorToMove(state.present())).toBe(Color.black);

		undoMove(state, applied);
		expect(state.timelines.length).toBe(1);
		expect(state.present()).toBe(2);
	});

	it('continues both timelines when jumping onto another latest board', () => {
		const state = blankState(3, 1);
		// A second timeline whose latest board is at the same time as the first.
		state.addTimeline(0, 0, Color.white);
		state.set(ref(0, 0, 0, 0), Piece.white_rook);
		expect(state.headT(1)).toBe(1);

		const state2 = blankState(3, 3);
		state2.set(ref(0, 2, 0, 0), Piece.white_rook);
		state2.addTimeline(0, 1, Color.white);
		expect(state2.headT(1)).toBe(2);
		const applied = applyMove(state2, { from: ref(0, 2, 0, 0), to: ref(1, 2, 0, 0) });
		expect(applied.created).toBe(null);
		expect(applied.advanced).toEqual([0, 1]);
		expect(state2.headT(0)).toBe(3);
		expect(state2.headT(1)).toBe(3);
		expect(state2.at(ref(1, 3, 0, 0))).toBe(Piece.white_rook);
	});
});

describe('en passant', () => {
	/** A board with a white pawn ready to step twice and a black pawn beside its path. */
	function pawnEndgame(): State {
		const state = blankState(8);
		state.set(ref(0, 0, 6, 4), Piece.white_pawn);
		state.set(ref(0, 0, 4, 3), Piece.black_pawn);
		state.set(ref(0, 0, 0, 0), Piece.black_rook);
		state.set(ref(0, 0, 7, 7), Piece.white_rook);
		return state;
	}

	it('records the square a double step skipped', () => {
		const state = pawnEndgame();
		const applied = applyMove(state, { from: ref(0, 0, 6, 4), to: ref(0, 0, 4, 4) });

		expect(state.enPassant.length).toBe(1);
		const record = state.enPassant[0];
		expect(record.target).toEqual(ref(0, 1, 5, 4));
		expect(record.victim).toEqual(ref(0, 1, 4, 4));
		expect(record.captor).toBe(Color.black);

		undoMove(state, applied);
		expect(state.enPassant.length).toBe(0);
	});

	it('lets the neighbouring pawn capture onto the skipped square', () => {
		const state = pawnEndgame();
		applyMove(state, { from: ref(0, 0, 6, 4), to: ref(0, 0, 4, 4) });

		const found = targets(state, ref(0, 1, 4, 3));
		expect(found.some(t => t.l === 0 && t.t === 1 && t.x === 5 && t.y === 4)).toBe(true);

		const applied = applyMove(state, { from: ref(0, 1, 4, 3), to: ref(0, 1, 5, 4) });
		expect(state.at(ref(0, 2, 5, 4))).toBe(Piece.black_pawn);
		expect(state.at(ref(0, 2, 4, 3))).toBe(EMPTY);
		// The pawn is taken where it stood, not where the capture landed.
		expect(state.at(ref(0, 2, 4, 4))).toBe(EMPTY);
		expect(applied.captured).toBe(Piece.white_pawn);

		undoMove(state, applied);
		expect(state.at(ref(0, 1, 4, 4))).toBe(Piece.white_pawn);
	});

	it('expires once the moment has passed', () => {
		const state = pawnEndgame();
		applyMove(state, { from: ref(0, 0, 6, 4), to: ref(0, 0, 4, 4) });
		applyMove(state, { from: ref(0, 1, 0, 0), to: ref(0, 1, 0, 1) });
		applyMove(state, { from: ref(0, 2, 7, 7), to: ref(0, 2, 7, 6) });

		const found = targets(state, ref(0, 3, 4, 3));
		expect(found.some(t => t.x === 5 && t.y === 4)).toBe(false);
	});

	it('refuses to double step across timelines', () => {
		const size = 8;
		// Two timelines on white's advancing side, which is the negative one.
		const state = new State(size, [-2, -1, 0].map(index => ({
			index,
			startT: 0,
			parent: index === 0 ? null : 0,
			boards: [{ t: 0, squares: new Int16Array(size * size).fill(EMPTY) }]
		})));
		state.set(ref(0, 0, 6, 4), Piece.white_pawn);

		const found = targets(state, ref(0, 0, 6, 4));
		// One timeline over is a normal advance; two would skip a square on a board
		// the pawn never touches, which no capture could then reach.
		expect(found.some(t => t.l === -1 && t.t === 0)).toBe(true);
		expect(found.some(t => t.l === -2)).toBe(false);
	});
});

describe('promotion', () => {
	it('promotes on the far edge of a pawn own advance', () => {
		expect(promotionRank(Color.white, 8)).toBe(0);
		expect(promotionRank(Color.black, 8)).toBe(7);
	});

	it('offers only the pieces the game was set up with', () => {
		const choices = promotionChoices(standardState(), Color.white);
		expect(choices).toEqual([Piece.black_queen, Piece.black_rook, Piece.black_bishop, Piece.black_knight]);
	});

	it('becomes the piece the move names', () => {
		const state = blankState(8);
		state.set(ref(0, 0, 1, 4), Piece.white_pawn);
		expect(promotes(state, Piece.white_pawn, ref(0, 0, 0, 4))).toBe(true);

		const applied = applyMove(state, { from: ref(0, 0, 1, 4), to: ref(0, 0, 0, 4), promotion: Piece.black_knight });
		expect(state.at(ref(0, 1, 0, 4))).toBe(Piece.white_knight);

		undoMove(state, applied);
		expect(state.at(ref(0, 0, 1, 4))).toBe(Piece.white_pawn);
	});

	it('falls back to a queen when the move says nothing', () => {
		const state = blankState(8);
		state.set(ref(0, 0, 1, 4), Piece.white_pawn);
		applyMove(state, { from: ref(0, 0, 1, 4), to: ref(0, 0, 0, 4) });
		expect(state.at(ref(0, 1, 0, 4))).toBe(Piece.white_queen);
	});

	it('leaves pieces that are not pawns alone', () => {
		const state = blankState(8);
		state.set(ref(0, 0, 1, 4), Piece.white_rook);
		expect(promotes(state, Piece.white_rook, ref(0, 0, 0, 4))).toBe(false);
	});
});

describe('castling', () => {
	function clear(state: State, t: number, files: number[]) {
		files.forEach(y => state.set(ref(0, t, 7, y), EMPTY));
	}

	it('is unavailable while pieces stand in the way', () => {
		const state = standardState();
		expect(targets(state, ref(0, 0, 7, 4)).length).toBe(0);
	});

	it('moves the king two files and the rook to the square it crossed', () => {
		const state = standardState();
		clear(state, 0, [5, 6]);

		const found = targets(state, ref(0, 0, 7, 4));
		expect(found.some(t => t.x === 7 && t.y === 6)).toBe(true);

		const applied = applyMove(state, { from: ref(0, 0, 7, 4), to: ref(0, 0, 7, 6) });
		expect(state.at(ref(0, 1, 7, 6))).toBe(Piece.white_king);
		expect(state.at(ref(0, 1, 7, 5))).toBe(Piece.white_rook);
		expect(state.at(ref(0, 1, 7, 7))).toBe(EMPTY);
		expect(state.at(ref(0, 1, 7, 4))).toBe(EMPTY);

		undoMove(state, applied);
		expect(state.at(ref(0, 0, 7, 7))).toBe(Piece.white_rook);
	});

	it('castles toward the far rook as well', () => {
		const state = standardState();
		clear(state, 0, [1, 2, 3]);

		expect(targets(state, ref(0, 0, 7, 4)).some(t => t.y === 2)).toBe(true);
		applyMove(state, { from: ref(0, 0, 7, 4), to: ref(0, 0, 7, 2) });
		expect(state.at(ref(0, 1, 7, 2))).toBe(Piece.white_king);
		expect(state.at(ref(0, 1, 7, 3))).toBe(Piece.white_rook);
		expect(state.at(ref(0, 1, 7, 0))).toBe(EMPTY);
	});

	it('refuses a rook that was not there for the whole history', () => {
		const state = standardState();
		clear(state, 0, [5, 6]);
		// Give the position a past in which the rook's square was empty.
		state.set(ref(0, 0, 7, 7), EMPTY);
		state.pushBoard(0);
		state.pushBoard(0);
		state.set(ref(0, 1, 7, 7), Piece.white_rook);
		state.set(ref(0, 2, 7, 7), Piece.white_rook);

		expect(targets(state, ref(0, 2, 7, 4)).some(t => t.y === 6)).toBe(false);
	});
});

describe('timeline activity', () => {
	it('keeps one spare timeline active for each player', () => {
		const state = blankState(3, 3);
		expect(state.activeLimit()).toBe(1);
		state.addTimeline(0, 1, Color.white);
		// White has one, black has none, so black's first branch is still activatable.
		expect(state.activeLimit()).toBe(1);
		expect(state.isActive(1)).toBe(true);
		state.addTimeline(0, 1, Color.white);
		expect(state.isActive(2)).toBe(false);
		state.addTimeline(0, 1, Color.black);
		expect(state.activeLimit()).toBe(2);
		expect(state.isActive(2)).toBe(true);
	});
});
