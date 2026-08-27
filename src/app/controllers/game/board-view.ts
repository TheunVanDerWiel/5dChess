import { Color, EMPTY, Piece } from 'src/app/engine/piece';
import { Ref, State, ref } from 'src/app/engine/state';
import { AppliedMove } from 'src/app/engine/turn';

/**
 * A read model of the multiverse laid out for one player. The engine always stores
 * canonical coordinates; everything a player sees is flipped to their perspective
 * here, so no other code has to know whose screen it is.
 */

export interface ViewSquare {
	piece: Piece | null;
	square: Ref;
	/** The classes marking this square's part in the move that made its board, or ''. */
	move: string;
}

export interface ViewBoard {
	square: Ref;
	t: number;
	/** Which side is to move on this board, used to colour its border. */
	border: 'black' | 'white';
	rows: ViewSquare[][];
}

export interface ViewRow {
	index: number;
	/** Placeholder cells for the turns before this timeline branched into existence. */
	lead: null[];
	/** The board this timeline was branched off, or null if it was there from the start. */
	origin: { l: number, t: number } | null;
	boards: ViewBoard[];
}

/** A curve drawn behind the boards, from a parent board to the timeline it began. */
export interface Origin {
	/** An SVG path, in the coordinates the boards are laid out in. */
	d: string;
}

/** A line drawn over the boards, in the coordinates the boards are laid out in. */
export interface Arrow {
	x1: number;
	y1: number;
	x2: number;
	y2: number;
	kind: 'move' | 'threat';
}

export interface BoardView {
	columns: null[];
	present: number;
	rows: ViewRow[];
}

export function buildView(state: State, perspective: Color, played: readonly AppliedMove[] = []): BoardView {
	const size = state.size;
	const flip = perspective === Color.black;
	const marks = markMoves(played);
	// A player's own advance points up the screen, so white reads the multiverse
	// from the negative side down and black from the positive side down.
	const lines = state.timelines.slice()
		.sort((a, b) => flip ? b.index - a.index : a.index - b.index);

	let columns = 0;
	const rows: ViewRow[] = lines.map(line => {
		columns = Math.max(columns, line.startT + line.boards.length);
		return {
			index: line.index,
			lead: new Array<null>(line.startT).fill(null),
			// A timeline begins one half-move after the board it was branched off.
			origin: line.parent === null ? null : { l: line.parent, t: line.startT - 1 },
			boards: line.boards.map(board => ({
				square: ref(line.index, board.t, 0, 0),
				t: board.t,
				border: (board.t % 2 === 0 ? 'white' : 'black') as 'black' | 'white',
				rows: readBoard(state, line.index, board.t, flip, marks)
			}))
		};
	});

	return { columns: new Array<null>(columns).fill(null), present: state.present(), rows };
}

function readBoard(state: State, l: number, t: number, flip: boolean, marks: Map<string, string>): ViewSquare[][] {
	const size = state.size;
	const rows: ViewSquare[][] = [];
	for (let row = 0; row < size; row++) {
		const cells: ViewSquare[] = [];
		for (let column = 0; column < size; column++) {
			const square = ref(l, t, flip ? size - 1 - row : row, flip ? size - 1 - column : column);
			const piece = state.at(square);
			cells.push({
				piece: piece === EMPTY ? null : piece,
				square,
				move: marks.get(key(square.l, square.t, square.x, square.y)) ?? ''
			});
		}
		rows.push(cells);
	}
	return rows;
}

/**
 * Where every move played can be read off the boards it left behind. A move never
 * alters a board, so it is marked on the boards it produced: the piece is gone from
 * the square it left on the board one half-move later, and stands on the square it
 * reached on the board its arrival produced.
 *
 * For a move that crossed to another board that arrival board is either the
 * destination timeline continued, or, where the move branched, the first board of
 * the timeline it brought into existence. Both sit one half-move after the board
 * that was moved to, so only which timeline they belong to has to be told apart.
 */
function markMoves(played: readonly AppliedMove[]): Map<string, string> {
	const marks = new Map<string, string>();
	for (const applied of played) {
		const { from, to } = applied.move;
		const sameBoard = from.l === to.l && from.t === to.t;
		const kind = sameBoard ? 'move-regular' : 'move-multiverse';
		const arrival = sameBoard ? from.l : applied.created ?? to.l;
		marks.set(key(from.l, from.t + 1, from.x, from.y), kind + ' move-from');
		marks.set(key(arrival, to.t + 1, to.x, to.y), kind + ' move-to');
	}
	return marks;
}

function key(l: number, t: number, x: number, y: number): string {
	return `${l}:${t}:${x}:${y}`;
}
