import { GameState } from "./GameState";
import { Move } from "./Move";

export { Color, Piece, EMPTY } from 'src/app/engine/piece';

export class Game {
	constructor(public Id: number, public StartingPlayer: number, public StartingState: GameState, public ActivePlayer: number, public Moves: Move[], public Status: GameStatus, public WinnerPlayer: number | null) {}
}

/** Enough about a game to list it on the main menu. */
export class GameSummary {
	constructor(public Id: number, public Status: GameStatus, public ActivePlayer: number,
		public WinnerPlayer: number | null, public Turns: number, public Waiting: boolean) {}
}

/** What the server reports when the client asks what it has missed. */
export class GameUpdate {
	constructor(public Moves: Move[], public Status: GameStatus, public ActivePlayer: number, public WinnerPlayer: number | null) {}
}

export enum GameStatus {
	starting = 'starting',
	in_progress = 'in_progress',
	finished = 'finished',
	forfeited = 'forfeited',
}
