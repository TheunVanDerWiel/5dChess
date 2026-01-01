export class Move {
	constructor(public Pieces: BoardMove[]) {}
}

export class BoardMove {
	constructor(public FromLocation: BoardReference, public ToLocation: BoardReference) {}
}

export class BoardReference {
	constructor(public TimeLine: number, public Board: number, public X: number, public Y: number) {}
}

export namespace BoardReference {
	export function contains(list: BoardReference[], timeline: number, board: number, x: number, y: number): boolean {
		for (var i = 0; i < list.length; i++) {
			if (BoardReference.equals(list[i], timeline, board, x, y)) {
				return true;
			}
		}
		return false;
	}
	
	export function equals(ref: BoardReference, timeline: number, board: number, x: number, y: number): boolean {
		return ref.TimeLine == timeline && ref.Board == board && ref.X == x && ref.Y == y;
	}
}