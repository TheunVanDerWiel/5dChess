import { attacksOn, exposedRoyals, isAttacked, movableAfter, movableBy } from './attacks';
import { Color, EMPTY, Piece } from './piece';
import { State, Timeline, ref } from './state';
import { stateFromDto } from './dto';
import { GameState } from 'src/app/types/GameState';

const STANDARD = '{"TimeLines":[{"Index":0,"Boards":[{"Squares":[[2,4,8,16,32,8,4,2],[0,0,0,0,0,0,0,0],[null,null,null,null,null,null,null,null],[null,null,null,null,null,null,null,null],[null,null,null,null,null,null,null,null],[null,null,null,null,null,null,null,null],[1,1,1,1,1,1,1,1],[3,5,9,17,33,9,5,3]]}]}]}';

function standardState(): State {
	return stateFromDto(JSON.parse(STANDARD) as GameState);
}

/** Timelines at the given indices, each holding empty boards over the given times. */
function boards(size: number, lines: { index: number, startT: number, count: number }[]): State {
	return new State(size, lines.map(line => {
		const timeline: Timeline = {
			index: line.index,
			startT: line.startT,
			parent: line.index === 0 ? null : 0,
			boards: []
		};
		for (let i = 0; i < line.count; i++) {
			timeline.boards.push({
				t: line.startT + i,
				squares: new Int16Array(size * size).fill(EMPTY)
			});
		}
		return timeline;
	}));
}

function oneLine(size: number, count = 1): State {
	return boards(size, [{ index: 0, startT: 0, count }]);
}

describe('who can be attacked at all', () => {
	it('ignores royals sitting on a board of their own colour', () => {
		const state = standardState();
		// t = 0 awaits white, so black's king is reachable there and white's is not.
		expect(exposedRoyals(state, Color.white, movableBy(state, Color.black)).length).toBe(0);
		expect(exposedRoyals(state, Color.black, movableBy(state, Color.white)))
			.toEqual([ref(0, 0, 0, 4)]);
	});

	it('finds nothing in the opening position', () => {
		const state = standardState();
		expect(attacksOn(state, Color.black, movableBy(state, Color.white))).toEqual([]);
		expect(attacksOn(state, Color.white, movableBy(state, Color.black))).toEqual([]);
	});
});

describe('attacks along a rank', () => {
	function withRook(): State {
		const state = oneLine(8);
		state.set(ref(0, 0, 0, 4), Piece.black_king);
		state.set(ref(0, 0, 0, 0), Piece.white_rook);
		return state;
	}

	it('reports the attacker and the squares in between', () => {
		const state = withRook();
		const found = attacksOn(state, Color.black, movableBy(state, Color.white));
		expect(found.length).toBe(1);
		expect(found[0].from).toEqual(ref(0, 0, 0, 0));
		expect(found[0].to).toEqual(ref(0, 0, 0, 4));
		expect(found[0].path.map(p => p.y)).toEqual([3, 2, 1]);
	});

	it('is stopped by anything in the way', () => {
		const state = withRook();
		state.set(ref(0, 0, 0, 2), Piece.white_pawn);
		expect(isAttacked(state, Color.black, movableBy(state, Color.white))).toBe(false);
	});
});

describe('attacks across time', () => {
	it('reaches a royal left behind on an earlier board', () => {
		const state = oneLine(8, 3);
		state.set(ref(0, 0, 0, 4), Piece.black_king);
		state.set(ref(0, 2, 0, 4), Piece.white_rook);
		const found = attacksOn(state, Color.black, movableBy(state, Color.white));
		expect(found.length).toBe(1);
		expect(found[0].from).toEqual(ref(0, 2, 0, 4));
		expect(found[0].to).toEqual(ref(0, 0, 0, 4));
	});

	it('ignores a piece that is no longer on the latest board', () => {
		const state = oneLine(8, 3);
		state.set(ref(0, 0, 0, 4), Piece.black_king);
		// The rook shares the king's board, but that board is history and cannot move.
		state.set(ref(0, 0, 0, 0), Piece.white_rook);
		expect(isAttacked(state, Color.black, movableBy(state, Color.white))).toBe(false);
	});
});

describe('attacks across timelines', () => {
	it('travels along a rank of boards', () => {
		const state = boards(8, [
			{ index: 0, startT: 0, count: 1 },
			{ index: 1, startT: 0, count: 1 },
			{ index: 2, startT: 0, count: 1 }
		]);
		state.set(ref(0, 0, 0, 4), Piece.black_king);
		state.set(ref(2, 0, 0, 4), Piece.white_rook);
		expect(isAttacked(state, Color.black, movableBy(state, Color.white))).toBe(true);
	});

	it('is stopped by a timeline that has no board at that time', () => {
		// Timeline 1 only starts later, so there is nothing at t = 0 to pass through.
		const state = boards(8, [
			{ index: 0, startT: 0, count: 1 },
			{ index: 1, startT: 2, count: 1 },
			{ index: 2, startT: 0, count: 1 }
		]);
		state.set(ref(0, 0, 0, 4), Piece.black_king);
		state.set(ref(2, 0, 0, 4), Piece.white_rook);
		expect(isAttacked(state, Color.black, movableBy(state, Color.white))).toBe(false);
	});
});

describe('pieces that arrive in one bound', () => {
	it('sees a knight', () => {
		const state = oneLine(8);
		state.set(ref(0, 0, 4, 4), Piece.black_king);
		state.set(ref(0, 0, 6, 5), Piece.white_knight);
		expect(isAttacked(state, Color.black, movableBy(state, Color.white))).toBe(true);
	});

	it('sees a pawn on its capturing diagonal but not in front of it', () => {
		const state = oneLine(8);
		state.set(ref(0, 0, 0, 4), Piece.black_king);
		state.set(ref(0, 0, 1, 3), Piece.white_pawn);
		expect(isAttacked(state, Color.black, movableBy(state, Color.white))).toBe(true);

		const ahead = oneLine(8);
		ahead.set(ref(0, 0, 0, 4), Piece.black_king);
		ahead.set(ref(0, 0, 1, 4), Piece.white_pawn);
		expect(isAttacked(ahead, Color.black, movableBy(ahead, Color.white))).toBe(false);
	});
});

describe('the warning a player gets before moving', () => {
	it('treats a board they must advance as already advanced', () => {
		const state = oneLine(8);
		state.set(ref(0, 0, 0, 4), Piece.white_king);
		state.set(ref(0, 0, 0, 0), Piece.black_rook);

		// As it stands the rook cannot move: t = 0 is white's to play.
		expect(isAttacked(state, Color.white, movableBy(state, Color.black))).toBe(false);
		// But white has to advance this board, and then the rook takes the king.
		expect(isAttacked(state, Color.white, movableAfter(state, Color.black))).toBe(true);
	});
});
