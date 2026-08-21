import { findLegalTurn, isTurnLegal } from './search';
import { Color, EMPTY, Piece } from './piece';
import { State, Timeline, ref } from './state';
import { applyTurn } from './turn';
import { stateFromDto } from './dto';
import { GameState } from 'src/app/types/GameState';

const STANDARD = '{"TimeLines":[{"Index":0,"Boards":[{"Squares":[[2,4,8,16,32,8,4,2],[0,0,0,0,0,0,0,0],[null,null,null,null,null,null,null,null],[null,null,null,null,null,null,null,null],[null,null,null,null,null,null,null,null],[null,null,null,null,null,null,null,null],[1,1,1,1,1,1,1,1],[3,5,9,17,33,9,5,3]]}]}]}';

function standardState(): State {
	return stateFromDto(JSON.parse(STANDARD) as GameState);
}

function boards(size: number, indices: number[]): State {
	return new State(size, indices.map(index => {
		const line: Timeline = {
			index,
			startT: 0,
			parent: index === 0 ? null : 0,
			boards: [{ t: 0, squares: new Int16Array(size * size).fill(EMPTY) }]
		};
		return line;
	}));
}

describe('finding a turn to play', () => {
	it('finds one in the opening position', () => {
		const state = standardState();
		const found = findLegalTurn(state, Color.white);
		expect(found.turn).not.toBeNull();
		expect(found.turn!.length).toBe(1);
		expect(found.complete).toBe(true);
	});

	it('returns a turn that really is legal', () => {
		const state = standardState();
		const found = findLegalTurn(state, Color.white);
		applyTurn(state, found.turn!);
		expect(isTurnLegal(state, Color.white)).toBe(true);
	});

	it('escapes a check by moving the king', () => {
		const state = boards(8, [0]);
		state.set(ref(0, 0, 7, 4), Piece.white_king);
		state.set(ref(0, 0, 1, 4), Piece.black_rook);
		const found = findLegalTurn(state, Color.white);
		expect(found.turn).not.toBeNull();
		// Every answer has to take the king off the file the rook holds.
		expect(found.turn![0].to.y).not.toBe(4);
	});

	it('reports no turn at all when the king is trapped', () => {
		const state = boards(8, [0]);
		state.set(ref(0, 0, 7, 4), Piece.white_king);
		state.set(ref(0, 0, 1, 4), Piece.black_rook);
		state.set(ref(0, 0, 0, 3), Piece.black_rook);
		state.set(ref(0, 0, 0, 5), Piece.black_rook);
		const found = findLegalTurn(state, Color.white);
		expect(found.turn).toBeNull();
		expect(found.complete).toBe(true);
	});

	it('lets the king step aside once one of the rooks is gone', () => {
		const state = boards(8, [0]);
		state.set(ref(0, 0, 7, 4), Piece.white_king);
		state.set(ref(0, 0, 1, 4), Piece.black_rook);
		state.set(ref(0, 0, 0, 3), Piece.black_rook);
		expect(findLegalTurn(state, Color.white).turn).not.toBeNull();
	});
});

describe('turns that span timelines', () => {
	it('moves on every timeline that is waiting', () => {
		const state = boards(8, [0, 1]);
		// Facing each other across the timelines: a rook's only move along that axis
		// is onto the same square one timeline over, and each blocks the other's, so
		// neither can answer for both boards at once.
		state.set(ref(0, 0, 4, 4), Piece.white_rook);
		state.set(ref(1, 0, 4, 4), Piece.white_rook);
		expect(state.requiredLines(Color.white).sort()).toEqual([0, 1]);

		const found = findLegalTurn(state, Color.white);
		expect(found.turn).not.toBeNull();
		expect(found.turn!.length).toBe(2);
		expect(found.turn!.map(move => move.from.l).sort()).toEqual([0, 1]);
	});

	it('accepts one move that carries two timelines forward', () => {
		const state = boards(8, [0, 1]);
		// The rook can step sideways onto the other timeline's latest board, which
		// advances both at once and answers for both.
		state.set(ref(0, 0, 4, 4), Piece.white_rook);
		const found = findLegalTurn(state, Color.white);
		expect(found.turn).not.toBeNull();
		expect(found.turn!.length).toBe(1);
		expect(found.turn![0].from.l).toBe(0);
		expect(found.turn![0].to.l).toBe(1);
	});

	it('will not settle for answering only one of them', () => {
		const state = boards(8, [0, 1]);
		state.set(ref(0, 0, 4, 4), Piece.white_rook);
		const found = findLegalTurn(state, Color.white);
		applyTurn(state, found.turn!);
		expect(state.requiredLines(Color.white)).toEqual([]);
		expect(state.headT(0)).toBe(1);
		expect(state.headT(1)).toBe(1);
	});
});
