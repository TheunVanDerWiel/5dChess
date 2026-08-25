import { KNIGHT_OFFSETS, SLIDING, rulesFor, CaptureMode, Direction } from './geometry';
import { Color, EMPTY, Piece, opponent } from './piece';
import { Ref, State, colorToMove, ref } from './state';

/** One enemy piece that could capture a royal, and the squares it travels through. */
export interface Attack {
	from: Ref;
	to: Ref;
	/** The empty squares between the two, where a piece could interpose. */
	path: Ref[];
}

/**
 * Which boards count as the attacker's to move. Two questions, because they have
 * different answers: a piece can only set out from the latest board of a timeline,
 * but it can arrive on any board of the same colour, including one deep in the past.
 */
export interface Perspective {
	/** Whether a piece standing here could move at all. */
	source(l: number, t: number): boolean;
	/** Whether a royal standing here could be captured. */
	target(l: number, t: number): boolean;
}

/**
 * The strict reading, for deciding whether a finished turn is legal: the attacker
 * threatens from the latest board of any timeline awaiting their move, as long as
 * that board has not fallen behind the present.
 *
 * The present is what makes this worth stating. A move into the past starts a
 * timeline that begins earlier than everything else, which drags the present back
 * and leaves attackers stranded ahead of it, where they no longer threaten. So this
 * has to be read off the position being judged, never off the one before the turn.
 *
 * Inactive timelines still count: a move there is optional rather than illegal.
 */
export function movableBy(state: State, color: Color): Perspective {
	const present = state.present();
	const target = (l: number, t: number) => colorToMove(t) === color;
	return { target, source: (l, t) => target(l, t) && t <= present && state.isHead(l, t) };
}

/**
 * The reading a player needs before moving. A board they are obliged to advance is
 * treated as though it already had been, so it counts as the opponent's to move:
 * that is what makes "you are in check" mean "do something about it this turn".
 */
export function movableAfter(state: State, color: Color): Perspective {
	const defender = opponent(color);
	// Advancing those boards carries the present forward with them.
	const present = state.present() + 1;
	const pending = new Set(state.requiredLines(defender).map(l => `${l}:${state.headT(l)}`));
	const about = (l: number, t: number) => pending.has(`${l}:${t}`);
	const target = (l: number, t: number) => colorToMove(t) === color || about(l, t);
	return {
		target,
		source: (l, t) => target(l, t) && t <= present && (state.isHead(l, t) || about(l, t))
	};
}

/**
 * The royals that could be captured at all. A move keeps the parity of its time
 * coordinate, so a piece can only reach boards awaiting the same colour it belongs
 * to: royals sitting on their own colour's boards are out of reach, wherever in the
 * multiverse those boards are, including deep in the past.
 */
export function exposedRoyals(state: State, defender: Color, view: Perspective): Ref[] {
	const found: Ref[] = [];
	for (const line of state.timelines) {
		for (const board of line.boards) {
			if (!view.target(line.index, board.t)) { continue; }
			for (let x = 0; x < state.size; x++) {
				for (let y = 0; y < state.size; y++) {
					const piece = board.squares[x * state.size + y];
					if (piece !== EMPTY && Piece.color(piece) === defender && Piece.isRoyal(piece)) {
						found.push(ref(line.index, board.t, x, y));
					}
				}
			}
		}
	}
	return found;
}

/**
 * Every way the defender's royals could be captured, found by casting rays out from
 * each royal and asking what sits at the far end. A missing board stops a ray exactly
 * as a piece does: a move cannot pass through a board that was never played.
 */
export function attacksOn(state: State, defender: Color, view: Perspective): Attack[] {
	return collect(state, defender, view, false);
}

/** Whether any royal of the defender could be captured. Stops at the first one. */
export function isAttacked(state: State, defender: Color, view: Perspective): boolean {
	return collect(state, defender, view, true).length > 0;
}

function collect(state: State, defender: Color, view: Perspective, first: boolean): Attack[] {
	const attacker = opponent(defender);
	const found: Attack[] = [];
	for (const royal of exposedRoyals(state, defender, view)) {
		if (sliding(state, royal, attacker, view, found, first) && first) { return found; }
		if (stepping(state, royal, attacker, view, found, first) && first) { return found; }
	}
	return found;
}

/**
 * Rays outward from the royal, one per direction, stopping at the first obstacle.
 * The walk is kept to plain numbers and only builds squares once it has found
 * something: a scan casts eighty rays per royal, and a royal appears on every board
 * of its own history, so anything allocated in here is allocated tens of thousands
 * of times over.
 */
function sliding(state: State, royal: Ref, attacker: Color, view: Perspective,
	found: Attack[], first: boolean): boolean {
	const size = state.size;
	let any = false;
	for (let family = 0; family < SLIDING.length; family++) {
		const directions = SLIDING[family];
		for (let index = 0; index < directions.length; index++) {
			const direction = directions[index];
			let l = royal.l, t = royal.t, x = royal.x, y = royal.y;
			for (let distance = 1; ; distance++) {
				if (direction[0] !== 0) {
					// Only asked for when the ray moves across timelines, which most do not.
					const next = state.offsetLine(l, direction[0]);
					if (next === null) { break; }
					l = next;
				}
				t += direction[1];
				x += direction[2];
				y += direction[3];
				if (x < 0 || x >= size || y < 0 || y >= size) { break; }
				const board = state.board(l, t);
				if (board === null) { break; }
				const occupant = board.squares[x * size + y];
				if (occupant === EMPTY) { continue; }
				if (Piece.color(occupant) === attacker
					&& reaches(occupant, family, distance)
					&& view.source(l, t)) {
					found.push({ from: ref(l, t, x, y), to: royal, path: trail(state, royal, direction, distance) });
					any = true;
					if (first) { return true; }
				}
				break;
			}
		}
	}
	return any;
}

/** The empty squares a ray crossed before it hit something. */
function trail(state: State, royal: Ref, direction: Direction, distance: number): Ref[] {
	const path: Ref[] = [];
	for (let step = 1; step < distance; step++) {
		const square = along(state, royal, direction, step);
		// The ray already reached the far end, so every square along it exists.
		if (square !== null) { path.push(square); }
	}
	return path;
}

/** Knights, pawns and brawns, which arrive in one bound rather than along a ray. */
function stepping(state: State, royal: Ref, attacker: Color, view: Perspective,
	found: Attack[], first: boolean): boolean {
	let any = false;

	for (let index = 0; index < KNIGHT_OFFSETS.length; index++) {
		const offset = KNIGHT_OFFSETS[index];
		const l = state.offsetLine(royal.l, offset[0]);
		if (l === null) { continue; }
		const t = royal.t + offset[1];
		const x = royal.x + offset[2], y = royal.y + offset[3];
		const occupant = at(state, l, t, x, y);
		if (occupant !== EMPTY
			&& Piece.color(occupant) === attacker
			&& Piece.type(occupant) === Piece.black_knight
			&& view.source(l, t)) {
			found.push({ from: ref(l, t, x, y), to: royal, path: [] });
			any = true;
			if (first) { return true; }
		}
	}

	// A pawn's captures are not symmetric, so its ray is walked backwards: the square
	// an enemy pawn would have to stand on to take this royal.
	for (const type of [Piece.black_pawn, Piece.black_brawn]) {
		const piece = Piece.of(type, attacker);
		for (const direction of captures(piece)) {
			const l = state.offsetLine(royal.l, -direction[0]);
			if (l === null) { continue; }
			const t = royal.t - direction[1];
			const x = royal.x - direction[2], y = royal.y - direction[3];
			if (at(state, l, t, x, y) === piece && view.source(l, t)) {
				found.push({ from: ref(l, t, x, y), to: royal, path: [] });
				any = true;
				if (first) { return true; }
			}
		}
	}
	return any;
}

function along(state: State, from: Ref, direction: Direction, distance: number): Ref | null {
	const l = state.offsetLine(from.l, direction[0] * distance);
	if (l === null) { return null; }
	return ref(
		l,
		from.t + direction[1] * distance,
		from.x + direction[2] * distance,
		from.y + direction[3] * distance);
}

function at(state: State, l: number, t: number, x: number, y: number): number {
	if (x < 0 || x >= state.size || y < 0 || y >= state.size) { return EMPTY; }
	const board = state.board(l, t);
	if (board === null) { return EMPTY; }
	return board.squares[x * state.size + y];
}

/** How far a piece slides in each family of directions, worked out once per type. */
const reach = new Map<number, number[]>();

function reaches(piece: number, family: number, distance: number): boolean {
	const type = Piece.type(piece);
	let table = reach.get(type);
	if (table === undefined) {
		const rules = rulesFor(piece);
		table = SLIDING.map(directions => {
			const rule = rules.find(candidate => candidate.directions === directions);
			return rule === undefined ? -1 : rule.maxDistance;
		});
		reach.set(type, table);
	}
	const limit = table[family];
	return limit === 0 || (limit > 0 && distance <= limit);
}

const captureCache = new Map<number, readonly Direction[]>();

function captures(piece: number): readonly Direction[] {
	let directions = captureCache.get(piece);
	if (directions === undefined) {
		const rule = rulesFor(piece).find(candidate => candidate.capture === CaptureMode.only);
		directions = rule === undefined ? [] : rule.directions;
		captureCache.set(piece, directions);
	}
	return directions;
}
