export class Move {
	constructor(public Pieces: BoardMove[]) {}
}

export class BoardMove {
	constructor(public FromLocation: BoardReference, public ToLocation: BoardReference) {}
}

export class BoardReference {
	constructor(public TimeLine: number, public Board: number, public X: number, public Y: number) {}
}