import { isPawn, pawnAdvance } from './geometry';
import { Move, findEnPassant } from './movegen';
import { Color, EMPTY, Piece, Square } from './piece';
import { Board, EnPassant, Ref, State, colorToMove, ref } from './state';
import { DEFAULT_PROMOTION, promotes } from './promotion';

/** Everything needed to take a move back. */
export interface AppliedMove {
	move: Move;
	/** Timelines that gained a board, in the order they gained it. */
	advanced: number[];
	/** The timeline this move branched into existence, if any. */
	created: number | null;
	captured: Square;
	/** Whether this move left an en passant opportunity behind. */
	passed: boolean;
}

function offset(state: State, at: Ref): number {
	return at.x * state.size + at.y;
}

/**
 * Plays one move. A move always creates boards and never alters existing ones:
 * it advances its own timeline, additionally advances the destination timeline
 * when the destination is a head board, and otherwise branches a new timeline
 * off the destination board.
 */
export function applyMove(state: State, move: Move): AppliedMove {
	const piece = state.at(move.from);
	if (piece === EMPTY) { throw new Error('No piece to move'); }
	const color = Piece.color(piece);
	const passing = isPawn(piece) && state.at(move.to) === EMPTY
		? findEnPassant(state, move.from, move.to, color)
		: null;
	const captured = passing === null ? state.at(move.to) : state.at(passing.victim);
	const castling = castlingRook(state, move, piece);
	const sameBoard = move.from.l === move.to.l && move.from.t === move.to.t;
	const advanced: number[] = [];
	let created: number | null = null;
	let destination: Board;

	if (sameBoard) {
		destination = state.pushBoard(move.from.l);
		advanced.push(move.from.l);
		destination.squares[offset(state, move.from)] = EMPTY;
	} else {
		const source = state.pushBoard(move.from.l);
		advanced.push(move.from.l);
		source.squares[offset(state, move.from)] = EMPTY;
		if (state.isHead(move.to.l, move.to.t)) {
			// The destination timeline continues rather than branching.
			destination = state.pushBoard(move.to.l);
			advanced.push(move.to.l);
		} else {
			const line = state.addTimeline(move.to.l, move.to.t, color);
			created = line.index;
			destination = line.boards[0];
		}
	}
	// A pawn reaching the far rank is replaced by the piece the move names.
	destination.squares[offset(state, move.to)] = promotes(state, piece, move.to)
		? Piece.of(move.promotion ?? DEFAULT_PROMOTION, color)
		: piece;
	if (passing !== null) {
		// The pawn is taken where it stands, not where the capture landed.
		destination.squares[offset(state, passing.victim)] = EMPTY;
	}

	if (castling !== null) {
		// The rook crosses to the far side of the king, on the board the move creates.
		destination.squares[offset(state, castling.to)] = state.at(castling.from);
		destination.squares[offset(state, castling.from)] = EMPTY;
	}

	const record = doubleStep(state, move, piece, color);
	if (record !== null) { state.enPassant.push(record); }

	return { move, advanced, created, captured, passed: record !== null };
}

/**
 * The opportunity a move leaves behind when a pawn steps twice. Only the spatial
 * double step exists, so the skipped square is on the board the pawn landed on.
 */
function doubleStep(state: State, move: Move, piece: number, color: Color): EnPassant | null {
	if (!isPawn(piece)) { return null; }
	const { rank } = pawnAdvance(color);
	if (move.to.l !== move.from.l || move.to.t !== move.from.t || move.to.y !== move.from.y) {
		return null;
	}
	if (move.to.x - move.from.x !== 2 * rank) { return null; }
	// Boards created by this move sit one half-move after the board it left.
	const t = move.from.t + 1;
	return {
		target: ref(move.from.l, t, move.from.x + rank, move.from.y),
		victim: ref(move.from.l, t, move.to.x, move.to.y),
		captor: color === Color.white ? Color.black : Color.white,
		createdAt: move.from.t
	};
}

/**
 * Where the rook travels when a move is a castle. A king moves at most one square
 * on its own, so a two-file step identifies the move with nothing else to check.
 */
function castlingRook(state: State, move: Move, piece: number): { from: Ref; to: Ref } | null {
	if (Piece.type(piece) !== Piece.black_king) { return null; }
	if (move.to.l !== move.from.l || move.to.t !== move.from.t || move.to.x !== move.from.x) {
		return null;
	}
	const distance = move.to.y - move.from.y;
	if (Math.abs(distance) !== 2) { return null; }
	const step = distance < 0 ? -1 : 1;
	for (let y = move.from.y + step; y >= 0 && y < state.size; y += step) {
		const square = ref(move.from.l, move.from.t, move.from.x, y);
		if (state.at(square) === EMPTY) { continue; }
		return { from: square, to: ref(move.from.l, move.from.t, move.from.x, move.from.y + step) };
	}
	return null;
}

export function undoMove(state: State, applied: AppliedMove): void {
	if (applied.passed) { state.enPassant.pop(); }
	if (applied.created !== null) {
		state.removeTimeline(applied.created);
	}
	for (let i = applied.advanced.length - 1; i >= 0; i--) {
		state.popBoard(applied.advanced[i]);
	}
}

export function applyTurn(state: State, moves: readonly Move[]): AppliedMove[] {
	return moves.map(move => applyMove(state, move));
}

export function undoTurn(state: State, applied: readonly AppliedMove[]): void {
	for (let i = applied.length - 1; i >= 0; i--) {
		undoMove(state, applied[i]);
	}
}

/** Whether the colour has discharged every obligation and the present has advanced. */
export function isTurnComplete(state: State, color: Color): boolean {
	return state.requiredLines(color).length === 0;
}

/**
 * Whether the colour is entitled to move on this timeline's head board: it must be
 * their move there, and the board must still be the head.
 */
export function canMoveOn(state: State, l: number, color: Color): boolean {
	const line = state.line(l);
	if (line === null) { return false; }
	return colorToMove(state.headT(l)) === color;
}
