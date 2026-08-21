import { Color, EMPTY, Square } from './piece';

/** A square anywhere in the multiverse: timeline index, absolute time, rank, file. */
export interface Ref {
	l: number;
	t: number;
	x: number;
	y: number;
}

export function ref(l: number, t: number, x: number, y: number): Ref {
	return { l, t, x, y };
}

export function sameRef(a: Ref, b: Ref): boolean {
	return a.l === b.l && a.t === b.t && a.x === b.x && a.y === b.y;
}

/**
 * A single board. `t` is the absolute half-move index: t = 0 is the opening position
 * with white to move, and every move produces a board one half-move later.
 */
export interface Board {
	readonly t: number;
	squares: Int16Array;
}

export interface Timeline {
	/** Signed timeline index; 0 is the original timeline. */
	index: number;
	/** Absolute time of boards[0]. */
	startT: number;
	/** Timeline this one branched off, or null for the original. */
	parent: number | null;
	boards: Board[];
}

/**
 * A pawn that has just stepped twice, and may be taken as though it stepped once.
 * Only the spatial double step exists, so the skipped square always lies on the
 * board the pawn ended up on.
 */
export interface EnPassant {
	/** The empty square a capture is played to. */
	target: Ref;
	/** The pawn that a capture on `target` removes. */
	victim: Ref;
	/** The colour entitled to capture, i.e. the opponent of the pawn's owner. */
	captor: Color;
	/** Time of the board the pawn left; only the immediate reply may capture. */
	createdAt: number;
}

/** Which colour is to move on a board at the given absolute time. */
export function colorToMove(t: number): Color {
	return (t % 2 === 0 ? Color.white : Color.black);
}

export class State {
	/** Timelines ordered ascending by index. */
	private lines: Timeline[];

	/**
	 * Pawns that stepped twice. Records are never cleared: each one names the time it
	 * was made at, and only a capture from one half-move later can use it.
	 */
	public enPassant: EnPassant[] = [];

	constructor(public readonly size: number, lines: Timeline[]) {
		this.lines = lines.slice().sort((a, b) => a.index - b.index);
	}

	get minIndex(): number {
		return this.lines[0].index;
	}

	get maxIndex(): number {
		return this.lines[this.lines.length - 1].index;
	}

	get timelines(): readonly Timeline[] {
		return this.lines;
	}

	line(index: number): Timeline | null {
		// Indices are contiguous, so the array position follows from the minimum.
		const position = index - this.minIndex;
		if (position < 0 || position >= this.lines.length) { return null; }
		return this.lines[position];
	}

	board(l: number, t: number): Board | null {
		const line = this.line(l);
		if (line === null) { return null; }
		const position = t - line.startT;
		if (position < 0 || position >= line.boards.length) { return null; }
		return line.boards[position];
	}

	head(l: number): Board | null {
		const line = this.line(l);
		if (line === null) { return null; }
		return line.boards[line.boards.length - 1];
	}

	headT(l: number): number {
		const line = this.line(l);
		if (line === null) { return Number.NaN; }
		return line.startT + line.boards.length - 1;
	}

	isHead(l: number, t: number): boolean {
		return this.headT(l) === t;
	}

	/** The contents of a square, or EMPTY when the square or its board is absent. */
	at(location: Ref): Square {
		const board = this.board(location.l, location.t);
		if (board === null) { return EMPTY; }
		return board.squares[location.x * this.size + location.y];
	}

	set(location: Ref, piece: Square): void {
		const board = this.board(location.l, location.t);
		if (board === null) { return; }
		board.squares[location.x * this.size + location.y] = piece;
	}

	inBounds(x: number, y: number): boolean {
		return x >= 0 && x < this.size && y >= 0 && y < this.size;
	}

	/**
	 * The largest absolute timeline index that is active. A player always holds one
	 * activatable spare timeline beyond the count the opponent has matched.
	 */
	activeLimit(): number {
		let positive = 0;
		let negative = 0;
		for (const line of this.lines) {
			if (line.index > 0) { positive++; }
			if (line.index < 0) { negative++; }
		}
		return Math.min(positive, negative) + 1;
	}

	isActive(index: number): boolean {
		return Math.abs(index) <= this.activeLimit();
	}

	/** The earliest head board among the active timelines. */
	present(): number {
		const limit = this.activeLimit();
		let earliest = Number.POSITIVE_INFINITY;
		for (const line of this.lines) {
			if (Math.abs(line.index) > limit) { continue; }
			earliest = Math.min(earliest, line.startT + line.boards.length - 1);
		}
		return earliest;
	}

	/** Timelines the given colour must move on to advance the present. */
	requiredLines(color: Color): number[] {
		const present = this.present();
		if (colorToMove(present) !== color) { return []; }
		const limit = this.activeLimit();
		return this.lines
			.filter(line => Math.abs(line.index) <= limit && this.headT(line.index) === present)
			.map(line => line.index);
	}

	/** Every timeline whose head board the given colour is entitled to move on. */
	playableLines(color: Color): number[] {
		return this.lines
			.filter(line => colorToMove(this.headT(line.index)) === color)
			.map(line => line.index);
	}

	/**
	 * The board one half-move earlier on the same line of descent, following the
	 * branch back into its parent when the timeline starts later.
	 */
	previous(l: number, t: number): Ref | null {
		const time = t - 1;
		let index = l;
		for (;;) {
			const line = this.line(index);
			if (line === null) { return null; }
			if (time >= line.startT) {
				return time <= this.headT(index) ? ref(index, time, 0, 0) : null;
			}
			if (line.parent === null) { return null; }
			index = line.parent;
		}
	}

	/** Appends a copy of a timeline's head board, advanced by one half-move. */
	pushBoard(l: number): Board {
		const line = this.line(l);
		if (line === null) { throw new Error(`No timeline ${l}`); }
		const previous = line.boards[line.boards.length - 1];
		const board: Board = { t: previous.t + 1, squares: previous.squares.slice() };
		line.boards.push(board);
		return board;
	}

	popBoard(l: number): void {
		const line = this.line(l);
		if (line === null) { throw new Error(`No timeline ${l}`); }
		line.boards.pop();
	}

	/**
	 * Starts a new timeline branching off the board at (l, t), which becomes its
	 * parent. White branches to the positive side, black to the negative side.
	 */
	addTimeline(l: number, t: number, color: Color): Timeline {
		const source = this.board(l, t);
		if (source === null) { throw new Error(`No board at (${l}, ${t})`); }
		const index = color === Color.white ? this.maxIndex + 1 : this.minIndex - 1;
		const line: Timeline = {
			index,
			startT: t + 1,
			parent: l,
			boards: [{ t: t + 1, squares: source.squares.slice() }]
		};
		if (color === Color.white) {
			this.lines.push(line);
		} else {
			this.lines.unshift(line);
		}
		return line;
	}

	removeTimeline(index: number): void {
		if (index === this.maxIndex) {
			this.lines.pop();
		} else if (index === this.minIndex) {
			this.lines.shift();
		} else {
			throw new Error(`Timeline ${index} is not at either end`);
		}
	}

	clone(): State {
		const copy = new State(this.size, this.lines.map(line => ({
			index: line.index,
			startT: line.startT,
			parent: line.parent,
			boards: line.boards.map(board => ({ t: board.t, squares: board.squares.slice() }))
		})));
		copy.enPassant = this.enPassant.slice();
		return copy;
	}
}
