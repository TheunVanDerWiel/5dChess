import { Piece } from "./Game";

export class GameState {
	constructor(public TimeLines: (Board | Split | null)[][]) {}
}

export class Board {
	constructor(public Squares: (Piece | null)[][]) {}
}

export class Split {
	constructor(public Source: number) {}
}