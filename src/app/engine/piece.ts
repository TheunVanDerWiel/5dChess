/**
 * Piece encoding. The type occupies the high bits (one bit per type) and the colour
 * occupies bit 0, so `type | colour` is the stored value. Empty squares are EMPTY
 * rather than null, so that boards can live in a typed array.
 */

export enum Color {
	black = 0,
	white = 1
}

export enum Piece {
	black_pawn = 0,
	white_pawn = 1,
	black_rook = 2,
	white_rook = 3,
	black_knight = 4,
	white_knight = 5,
	black_bishop = 8,
	white_bishop = 9,
	black_queen = 16,
	white_queen = 17,
	black_king = 32,
	white_king = 33,
	black_brawn = 64,
	white_brawn = 65,
	black_unicorn = 128,
	white_unicorn = 129,
	black_dragon = 256,
	white_dragon = 257,
	black_princess = 512,
	white_princess = 513,
	black_royal_queen = 1024,
	white_royal_queen = 1025,
	black_common_king = 2048,
	white_common_king = 2049
}

/** Marks an empty square. Distinct from black_pawn, which is legitimately 0. */
export const EMPTY = -1;

/** The contents of a square: a piece, or EMPTY. */
export type Square = number;

/** Bitmask of the royal types: king and royal queen. */
const ROYAL_MASK = Piece.black_king | Piece.black_royal_queen;

export namespace Piece {
	export function color(piece: number): Color {
		return (piece & 1) as Color;
	}

	export function type(piece: number): Piece {
		return ((piece | 1) - 1) as Piece;
	}

	export function isRoyal(piece: number): boolean {
		return piece !== EMPTY && (piece & ROYAL_MASK) > 0;
	}

	export function of(type: Piece, color: Color): Piece {
		return (type | color) as Piece;
	}
}

const NAMES = new Map<number, string>([
	[Piece.black_pawn, 'Pawn'],
	[Piece.black_rook, 'Rook'],
	[Piece.black_knight, 'Knight'],
	[Piece.black_bishop, 'Bishop'],
	[Piece.black_queen, 'Queen'],
	[Piece.black_king, 'King'],
	[Piece.black_brawn, 'Brawn'],
	[Piece.black_unicorn, 'Unicorn'],
	[Piece.black_dragon, 'Dragon'],
	[Piece.black_princess, 'Princess'],
	[Piece.black_royal_queen, 'Royal queen'],
	[Piece.black_common_king, 'Common king']
]);

const SLUGS = new Map<number, string>([
	[Piece.black_pawn, 'pawn'],
	[Piece.black_rook, 'rook'],
	[Piece.black_knight, 'knight'],
	[Piece.black_bishop, 'bishop'],
	[Piece.black_queen, 'queen'],
	[Piece.black_king, 'king'],
	[Piece.black_brawn, 'brawn'],
	[Piece.black_unicorn, 'unicorn'],
	[Piece.black_dragon, 'dragon'],
	[Piece.black_princess, 'princess'],
	[Piece.black_royal_queen, 'royal-queen'],
	[Piece.black_common_king, 'common-king']
]);

/** Identifies a piece's drawing in the sprite. */
export function pieceSlug(piece: number): string {
	return SLUGS.get(Piece.type(piece)) ?? 'unknown';
}

export function pieceName(piece: number): string {
	return NAMES.get(Piece.type(piece)) ?? 'Piece';
}

export function opponent(color: Color): Color {
	return (1 - color) as Color;
}
