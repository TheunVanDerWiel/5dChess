import { CaptureMode, Direction, MoveRule, rulesFor } from './geometry';
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
 * The reading for a turn still being played: attacks the rest of the turn can do
 * nothing about. A board awaiting the attacker can be neither moved on nor landed on
 * by the defender, and moves never alter boards that already exist, so an attacker on
 * such a head, its target and everything between them stay exactly as they are. All
 * that can still change is the present, and `floor` is the earliest it could end up.
 */
export function settledBy(state: State, color: Color, floor: number): Perspective {
	const target = (l: number, t: number) => colorToMove(t) === color;
	return { target, source: (l, t) => target(l, t) && t <= floor && state.isHead(l, t) };
}

/**
 * The attacks a colour has to answer this turn: what the opponent could take if the
 * colour passed. That makes "you are in check" mean "do something about it this turn".
 *
 * A pass carries every board the colour is obliged to move on forward unchanged, and
 * this plays one out rather than pretending those boards already belong to the
 * opponent. The difference is the half-move the pass adds: a piece travelling back
 * in time from the new board arrives a half-move later than it would from the old
 * one, on a board of the other colour, and that is often where the royal stands.
 *
 * Squares on the boards the pass created are reported on the boards they were copied
 * from, which is where the pieces actually stand.
 */
export function threatsTo(state: State, defender: Color): Attack[] {
	return passing(state, defender, passed => {
		const back = (square: Ref) => passed.includes(square.l) && state.isHead(square.l, square.t)
			? ref(square.l, square.t - 1, square.x, square.y)
			: square;
		return attacksOn(state, defender, movableBy(state, opponent(defender)))
			.map(attack => ({ from: back(attack.from), to: back(attack.to), path: attack.path.map(back) }));
	});
}

/** Whether the colour is in check: whether passing would leave a royal to be taken. */
export function isInCheck(state: State, defender: Color): boolean {
	return passing(state, defender, () => isAttacked(state, defender, movableBy(state, opponent(defender))));
}

/** Looks at the position as the colour would leave it by passing, then puts it back. */
function passing<T>(state: State, color: Color, look: (passed: number[]) => T): T {
	const passed = state.requiredLines(color);
	passed.forEach(line => state.pushBoard(line));
	try {
		return look(passed);
	} finally {
		passed.forEach(line => state.popBoard(line));
	}
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
 * Every way the defender's royals could be captured. A missing board stops a ray
 * exactly as a piece does: a move cannot pass through a board that was never played.
 */
export function attacksOn(state: State, defender: Color, view: Perspective): Attack[] {
	return collect(state, defender, view, false);
}

/** Whether any royal of the defender could be captured. Stops at the first one. */
export function isAttacked(state: State, defender: Color, view: Perspective): boolean {
	return collect(state, defender, view, true).length > 0;
}

/**
 * Walks every capture the attacker could make and keeps the ones that land on a
 * royal. This starts from the attackers rather than the royals because of where
 * each can stand: a piece only sets out from the latest board of a timeline, so
 * there are a handful of boards to look at, while a royal stands on every board of
 * its own history and could be taken on any of them.
 */
function collect(state: State, defender: Color, view: Perspective, first: boolean): Attack[] {
	const attacker = opponent(defender);
	const size = state.size;
	const found: Attack[] = [];
	for (const line of state.timelines) {
		const head = line.boards[line.boards.length - 1];
		if (!view.source(line.index, head.t)) { continue; }
		for (let x = 0; x < size; x++) {
			for (let y = 0; y < size; y++) {
				const piece = head.squares[x * size + y];
				if (piece === EMPTY || Piece.color(piece) !== attacker) { continue; }
				const from = ref(line.index, head.t, x, y);
				if (strikes(state, from, piece, defender, view, found, first) && first) { return found; }
			}
		}
	}
	return found;
}

/**
 * Rays outward from one attacker, one per capturing direction, stopping at the first
 * obstacle. The walk is kept to plain numbers and only builds squares once it has
 * found something, since a scan runs at every step of a search.
 */
function strikes(state: State, from: Ref, piece: number, defender: Color, view: Perspective,
	found: Attack[], first: boolean): boolean {
	const size = state.size;
	let any = false;
	for (const rule of capturing(piece)) {
		for (let index = 0; index < rule.directions.length; index++) {
			const direction = rule.directions[index];
			let l = from.l, t = from.t, x = from.x, y = from.y;
			for (let distance = 1; rule.maxDistance === 0 || distance <= rule.maxDistance; distance++) {
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
				if (Piece.color(occupant) === defender && Piece.isRoyal(occupant) && view.target(l, t)) {
					const royal = ref(l, t, x, y);
					found.push({ from, to: royal, path: trail(state, royal, direction, distance) });
					any = true;
					if (first) { return true; }
				}
				break;
			}
		}
	}
	return any;
}

/** The empty squares a ray crossed before it hit something, counted from the royal. */
function trail(state: State, royal: Ref, direction: Direction, distance: number): Ref[] {
	const back: Direction = [-direction[0], -direction[1], -direction[2], -direction[3]];
	const path: Ref[] = [];
	for (let step = 1; step < distance; step++) {
		const square = along(state, royal, back, step);
		// The ray already reached the far end, so every square along it exists.
		if (square !== null) { path.push(square); }
	}
	return path;
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

/** The rules a piece can capture by, worked out once per piece. */
const captureRules = new Map<number, MoveRule[]>();

function capturing(piece: number): MoveRule[] {
	let rules = captureRules.get(piece);
	if (rules === undefined) {
		rules = rulesFor(piece).filter(rule => rule.capture !== CaptureMode.never);
		captureRules.set(piece, rules);
	}
	return rules;
}
