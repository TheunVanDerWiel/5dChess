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
	/** Time is the absolute time of the timeline's first board; Parent is the timeline it branched off. */
	constructor(public Time: number, public Parent: number) {}
}
