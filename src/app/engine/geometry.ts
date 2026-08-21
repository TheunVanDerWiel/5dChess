import { Color, Piece } from './piece';

/** A direction over the four axes, in [line, time, x, y] order. */
export type Direction = readonly [number, number, number, number];

/**
 * One step along the time axis spans a full turn, i.e. two half-moves, so that a
 * move always lands on a board with the same side to move as the board it left.
 */
export const TIME_STEP = 2;

/** The size of a single step along each axis, in [line, time, x, y] order. */
const AXIS_STEP: readonly number[] = [1, TIME_STEP, 1, 1];

/**
 * White advances toward higher timeline indices, mirroring its spatial advance:
 * both point "up" on a board rendered from white's perspective.
 */
const WHITE_LINE_ADVANCE = 1;

/** White starts on the high ranks and advances toward rank 0. */
const WHITE_RANK_ADVANCE = -1;

function buildSlidingDirections(): Direction[][] {
	// Grouped by the number of axes involved: rook, bishop, unicorn, dragon.
	const families: Direction[][] = [[], [], [], []];
	for (let mask = 1; mask < 16; mask++) {
		const axes: number[] = [];
		for (let axis = 0; axis < 4; axis++) {
			if ((mask & (1 << axis)) !== 0) {
				axes.push(axis);
			}
		}
		// Every combination of signs over the axes in this subset.
		for (let signs = 0; signs < 1 << axes.length; signs++) {
			const vector = [0, 0, 0, 0];
			for (let i = 0; i < axes.length; i++) {
				const axis = axes[i];
				vector[axis] = ((signs & (1 << i)) !== 0 ? -1 : 1) * AXIS_STEP[axis];
			}
			families[axes.length - 1].push(vector as unknown as Direction);
		}
	}
	return families;
}

function buildKnightOffsets(): Direction[] {
	const offsets: Direction[] = [];
	// Two axes in a 1:2 ratio, ordered, so both assignments of the ratio count.
	for (let shortAxis = 0; shortAxis < 4; shortAxis++) {
		for (let longAxis = 0; longAxis < 4; longAxis++) {
			if (shortAxis === longAxis) { continue; }
			for (const shortSign of [-1, 1]) {
				for (const longSign of [-1, 1]) {
					const vector = [0, 0, 0, 0];
					vector[shortAxis] = shortSign * AXIS_STEP[shortAxis];
					vector[longAxis] = longSign * AXIS_STEP[longAxis] * 2;
					offsets.push(vector as unknown as Direction);
				}
			}
		}
	}
	return offsets;
}

/** Sliding directions grouped by dimensionality: [0] rook, [1] bishop, [2] unicorn, [3] dragon. */
export const SLIDING: readonly Direction[][] = buildSlidingDirections();

export const KNIGHT_OFFSETS: readonly Direction[] = buildKnightOffsets();

export enum CaptureMode {
	/** The target square must be empty. */
	never,
	/** The target square must hold an enemy piece. */
	only,
	/** Either is allowed. */
	either
}

export interface MoveRule {
	directions: readonly Direction[];
	/** Steps allowed along each direction; 0 means slide until blocked. */
	maxDistance: number;
	capture: CaptureMode;
	/** Whether maxDistance doubles when the piece has not moved yet. */
	doubleFromStart?: boolean;
}

/** The two directions a pawn of this colour advances: one spatial, one across timelines. */
export function pawnAdvance(color: Color): { rank: number; line: number } {
	const sign = color === Color.white ? 1 : -1;
	return { rank: sign * WHITE_RANK_ADVANCE, line: sign * WHITE_LINE_ADVANCE };
}

export function isPawn(piece: number): boolean {
	const type = Piece.type(piece);
	return type === Piece.black_pawn || type === Piece.black_brawn;
}

function pawnRules(color: Color, brawn: boolean): MoveRule[] {
	const { rank, line } = pawnAdvance(color);
	// Only the spatial advance may be doubled: a pawn stepping two timelines would
	// skip a square on a board it never touches, which no capture could then alter.
	const spatial: Direction[] = [[0, 0, rank, 0]];
	const across: Direction[] = [[line, 0, 0, 0]];
	// Diagonals pairing each advance direction with a step along one other axis.
	const captures: Direction[] = [
		[0, 0, rank, -1],
		[0, 0, rank, 1],
		[line, -TIME_STEP, 0, 0],
		[line, TIME_STEP, 0, 0]
	];
	if (brawn) {
		captures.push([line, 0, 0, -1], [line, 0, 0, 1]);
		captures.push([0, -TIME_STEP, rank, 0], [0, TIME_STEP, rank, 0]);
	}
	return [
		{ directions: spatial, maxDistance: 1, capture: CaptureMode.never, doubleFromStart: true },
		{ directions: across, maxDistance: 1, capture: CaptureMode.never },
		{ directions: captures, maxDistance: 1, capture: CaptureMode.only }
	];
}

function sliding(families: number[], maxDistance = 0): MoveRule[] {
	return families.map(family => ({
		directions: SLIDING[family],
		maxDistance,
		capture: CaptureMode.either
	}));
}

/** The movement rules for a piece, resolved against its colour. */
export function rulesFor(piece: Piece): MoveRule[] {
	const color = Piece.color(piece);
	switch (Piece.type(piece)) {
		case Piece.black_pawn: return pawnRules(color, false);
		case Piece.black_brawn: return pawnRules(color, true);
		case Piece.black_rook: return sliding([0]);
		case Piece.black_bishop: return sliding([1]);
		case Piece.black_unicorn: return sliding([2]);
		case Piece.black_dragon: return sliding([3]);
		case Piece.black_princess: return sliding([0, 1]);
		case Piece.black_queen: return sliding([0, 1, 2, 3]);
		case Piece.black_royal_queen: return sliding([0, 1, 2, 3]);
		case Piece.black_king: return sliding([0, 1, 2, 3], 1);
		case Piece.black_common_king: return sliding([0, 1, 2, 3], 1);
		case Piece.black_knight:
			return [{ directions: KNIGHT_OFFSETS, maxDistance: 1, capture: CaptureMode.either }];
		default: return [];
	}
}
