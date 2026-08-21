export class Move {
	constructor(public Pieces: BoardMove[]) {}
}

export class BoardMove {
	constructor(public FromLocation: BoardReference, public ToLocation: BoardReference, public Promotion?: number) {}
}

/** A square in canonical coordinates: signed timeline index and absolute time. */
export class BoardReference {
	constructor(public Line: number, public Time: number, public X: number, public Y: number) {}
}
