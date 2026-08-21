import { EMPTY, Piece } from './piece';
import { Move } from './movegen';
import { Board, State, Timeline, ref } from './state';
import { GameState, TimeLine as TimeLineDto, Board as BoardDto, TimeLineOrigin } from 'src/app/types/GameState';
import { BoardMove, BoardReference } from 'src/app/types/Move';

/**
 * Reads the wire format. `Origin` is absent on the original timeline, which then
 * starts at time 0; every other timeline carries its start time and its parent.
 */
export function stateFromDto(dto: GameState): State {
	const size = dto.TimeLines[0].Boards[0].Squares.length;
	const lines: Timeline[] = dto.TimeLines.map(line => {
		const startT = line.Origin?.Time ?? 0;
		const boards: Board[] = line.Boards.map((board, offset) => {
			const squares = new Int16Array(size * size).fill(EMPTY);
			for (let x = 0; x < size; x++) {
				for (let y = 0; y < size; y++) {
					const piece = board.Squares[x][y];
					squares[x * size + y] = piece === null ? EMPTY : piece;
				}
			}
			return { t: startT + offset, squares };
		});
		return { index: line.Index, startT, parent: line.Origin?.Parent ?? null, boards };
	});
	return new State(size, lines);
}

export function stateToDto(state: State): GameState {
	return new GameState(state.timelines.map(line => new TimeLineDto(
		line.index,
		line.boards.map(board => {
			const squares: (Piece | null)[][] = [];
			for (let x = 0; x < state.size; x++) {
				const row: (Piece | null)[] = [];
				for (let y = 0; y < state.size; y++) {
					const piece = board.squares[x * state.size + y];
					row.push(piece === EMPTY ? null : piece);
				}
				squares.push(row);
			}
			return new BoardDto(squares);
		}),
		line.parent === null ? undefined : new TimeLineOrigin(line.startT, line.parent)
	)));
}

export function moveFromDto(dto: BoardMove): Move {
	return {
		from: ref(dto.FromLocation.Line, dto.FromLocation.Time, dto.FromLocation.X, dto.FromLocation.Y),
		to: ref(dto.ToLocation.Line, dto.ToLocation.Time, dto.ToLocation.X, dto.ToLocation.Y),
		promotion: dto.Promotion as Piece | undefined
	};
}

export function moveToDto(move: Move): BoardMove {
	return new BoardMove(
		new BoardReference(move.from.l, move.from.t, move.from.x, move.from.y),
		new BoardReference(move.to.l, move.to.t, move.to.x, move.to.y),
		move.promotion
	);
}
