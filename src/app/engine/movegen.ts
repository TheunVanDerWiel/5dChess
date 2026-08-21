import { CaptureMode, isPawn, rulesFor } from './geometry';
import { Color, EMPTY, Piece } from './piece';
import { EnPassant, Ref, State, colorToMove, ref, sameRef } from './state';

/** A single piece movement. A turn is a set of these, at most one per timeline. */
export interface Move {
	from: Ref;
	to: Ref;
	/** The type a promoting pawn becomes; ignored on any other move. */
	promotion?: Piece;
}

/**
 * Every square the piece on `from` can reach. The source is taken at face value:
 * callers decide whether the piece is entitled to move at all.
 */
export function targets(state: State, from: Ref): Ref[] {
	const piece = state.at(from);
	if (piece === EMPTY) { return []; }
	const color = Piece.color(piece);
	const found: Ref[] = [];
	for (const rule of rulesFor(piece)) {
		let limit = rule.maxDistance;
		if (limit > 0 && rule.doubleFromStart === true && isUnmoved(state, from)) {
			limit *= 2;
		}
		for (const direction of rule.directions) {
			for (let distance = 1; limit === 0 || distance <= limit; distance++) {
				const to = ref(
					from.l + direction[0] * distance,
					from.t + direction[1] * distance,
					from.x + direction[2] * distance,
					from.y + direction[3] * distance
				);
				if (!state.inBounds(to.x, to.y)) { break; }
				// A board that does not exist blocks the ray exactly like a piece does.
				const board = state.board(to.l, to.t);
				if (board === null) { break; }
				const occupant = board.squares[to.x * state.size + to.y];
				if (occupant === EMPTY) {
					if (rule.capture !== CaptureMode.only) { found.push(to); }
					continue;
				}
				if (Piece.color(occupant) !== color && rule.capture !== CaptureMode.never) {
					found.push(to);
				}
				break;
			}
		}
	}
	if (isPawn(piece)) {
		found.push(...enPassantTargets(state, from, piece));
	}
	if (Piece.type(piece) === Piece.black_king) {
		found.push(...castlingTargets(state, from, piece));
	}
	return found;
}

/**
 * Squares a pawn may capture to although they are empty, because an enemy pawn
 * stepped over them on the previous half-move.
 */
function enPassantTargets(state: State, from: Ref, piece: number): Ref[] {
	const color = Piece.color(piece);
	const captures = rulesFor(piece).find(rule => rule.capture === CaptureMode.only);
	if (captures === undefined) { return []; }
	return state.enPassant.filter(record => {
		if (record.captor !== color || record.createdAt !== from.t - 1) { return false; }
		if (!state.isHead(record.target.l, record.target.t)) { return false; }
		if (state.at(record.target) !== EMPTY) { return false; }
		const victim = state.at(record.victim);
		if (victim === EMPTY || Piece.color(victim) === color) { return false; }
		return captures.directions.some(direction =>
			from.l + direction[0] === record.target.l
			&& from.t + direction[1] === record.target.t
			&& from.x + direction[2] === record.target.x
			&& from.y + direction[3] === record.target.y);
	}).map(record => record.target);
}

/** The pawn a capture onto `to` takes in passing, if any. */
export function findEnPassant(state: State, from: Ref, to: Ref, color: Color): EnPassant | null {
	return state.enPassant.find(record => record.captor === color
		&& record.createdAt === from.t - 1
		&& sameRef(record.target, to)) ?? null;
}

/** Every move the side to move can make from the head board of a timeline. */
export function movesForLine(state: State, l: number): Move[] {
	const t = state.headT(l);
	const board = state.board(l, t);
	if (board === null) { return []; }
	const color = colorToMove(t);
	const moves: Move[] = [];
	for (let x = 0; x < state.size; x++) {
		for (let y = 0; y < state.size; y++) {
			const piece = board.squares[x * state.size + y];
			if (piece === EMPTY || Piece.color(piece) !== color) { continue; }
			const from = ref(l, t, x, y);
			for (const to of targets(state, from)) {
				moves.push({ from, to });
			}
		}
	}
	return moves;
}

/**
 * Squares the king can castle to: two files toward an unmoved rook of its own
 * colour, with nothing in between. The rook ends on the square the king crossed,
 * so the rook must stand at least three files away.
 */
function castlingTargets(state: State, from: Ref, piece: number): Ref[] {
	if (!isUnmoved(state, from)) { return []; }
	const color = Piece.color(piece);
	const found: Ref[] = [];
	for (const step of [-1, 1]) {
		for (let y = from.y + step; y >= 0 && y < state.size; y += step) {
			const square = ref(from.l, from.t, from.x, y);
			const occupant = state.at(square);
			if (occupant === EMPTY) { continue; }
			if (Piece.color(occupant) === color
				&& Piece.type(occupant) === Piece.black_rook
				&& Math.abs(y - from.y) >= 3
				&& isUnmoved(state, square)) {
				found.push(ref(from.l, from.t, from.x, from.y + 2 * step));
			}
			break;
		}
	}
	return found;
}

/**
 * Whether the piece has occupied this square for the whole history of its board,
 * which is what entitles a pawn to its double step and a king and rook to castle.
 */
export function isUnmoved(state: State, location: Ref): boolean {
	const piece = state.at(location);
	let current = location;
	for (;;) {
		const previous = state.previous(current.l, current.t);
		if (previous === null) { return true; }
		const earlier = ref(previous.l, previous.t, location.x, location.y);
		if (state.at(earlier) !== piece) { return false; }
		current = earlier;
	}
}
