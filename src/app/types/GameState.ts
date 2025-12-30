import { Piece } from "./Game";

export class GameState {
	constructor(public TimeLines: TimeLine[]) {}
}

export class TimeLine {
	constructor(public Index: number, public Boards: Board[], public Origin: TimeLineOrigin | undefined) {}
}

export class Board {
	constructor(public Squares: (Piece | null)[][]) {}
}

export class TimeLineOrigin {
	constructor(public Time: number, public Origin: number) {}
}