import { Color, EMPTY, Piece } from 'src/app/engine/piece';
import { Ref, State, ref } from 'src/app/engine/state';

/**
 * A read model of the multiverse laid out for one player. The engine always stores
 * canonical coordinates; everything a player sees is flipped to their perspective
 * here, so no other code has to know whose screen it is.
 */

export interface ViewSquare {
	piece: Piece | null;
	square: Ref;
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

export function buildView(state: State, perspective: Color): BoardView {
	const size = state.size;
	const flip = perspective === Color.black;
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
				rows: readBoard(state, line.index, board.t, flip)
			}))
		};
	});

	return { columns: new Array<null>(columns).fill(null), present: state.present(), rows };
}

function readBoard(state: State, l: number, t: number, flip: boolean): ViewSquare[][] {
	const size = state.size;
	const rows: ViewSquare[][] = [];
	for (let row = 0; row < size; row++) {
		const cells: ViewSquare[] = [];
		for (let column = 0; column < size; column++) {
			const square = ref(l, t, flip ? size - 1 - row : row, flip ? size - 1 - column : column);
			const piece = state.at(square);
			cells.push({ piece: piece === EMPTY ? null : piece, square });
		}
		rows.push(cells);
	}
	return rows;
}
