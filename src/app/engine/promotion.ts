import { isPawn, pawnAdvance } from './geometry';
import { Color, EMPTY, Piece } from './piece';
import { Ref, State } from './state';

/** The order promotion choices are offered in, strongest first. */
const CHOICE_ORDER: readonly Piece[] = [
	Piece.black_queen,
	Piece.black_princess,
	Piece.black_rook,
	Piece.black_bishop,
	Piece.black_knight,
	Piece.black_unicorn,
	Piece.black_dragon,
	Piece.black_common_king
];

/** What a pawn becomes when its move does not say. */
export const DEFAULT_PROMOTION = Piece.black_queen;

/** The rank a pawn of this colour promotes on: the far edge of its advance. */
export function promotionRank(color: Color, size: number): number {
	return pawnAdvance(color).rank < 0 ? 0 : size - 1;
}

/**
 * Whether landing here promotes. Only the spatial advance can reach the far rank;
 * a step across timelines keeps the pawn on the rank it was already on.
 */
export function promotes(state: State, piece: number, to: Ref): boolean {
	if (!isPawn(piece)) { return false; }
	return to.x === promotionRank(Piece.color(piece), state.size);
}

/**
 * The types a pawn may promote to, read off the position the game was set up with,
 * so that each variant offers its own pieces and nothing else. Pawns are excluded
 * because promoting to one is pointless, and royals because a second king is not a
 * piece the rules provide for.
 */
export function promotionChoices(start: State, color: Color): Piece[] {
	const present = new Set<number>();
	for (const line of start.timelines) {
		for (const board of line.boards) {
			for (const square of board.squares) {
				if (square === EMPTY || Piece.color(square) !== color) { continue; }
				present.add(Piece.type(square));
			}
		}
	}
	return CHOICE_ORDER.filter(type => present.has(type));
}
