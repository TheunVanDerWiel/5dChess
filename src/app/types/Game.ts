import { GameState } from "./GameState";
import { Move } from "./Move";

export class Game {
	constructor(public StartingState: GameState, public StartingPlayer: number, public Moves: Move[], public ActivePlayer: number, public Status: GameStatus, public WinnerPlayer: number | null) {}
}

export enum GameStatus {
	starting = 'starting',
	in_progress = 'in_progress',
	finished = 'finished',
	forfeited = 'forfeited',
}

export enum Piece {
	white_pawn = 1,
	white_brawn = 7,
	white_rook = 2,
	white_unicorn = 8,
	white_dragon = 9,
	white_knight = 3,
	white_bishop = 4,
	white_king = 5,
	white_common_king = 10,
	white_queen = 6,
	white_princess = 11,
	white_royal_queen = 12,
	black_pawn = 13,
	black_brawn = 19,
	black_rook = 14,
	black_unicorn = 20,
	black_dragon = 21,
	black_knight = 15,
	black_bishop = 16,
	black_king = 17,
	black_common_king = 22,
	black_queen = 18,
	black_princess = 23,
	black_royal_queen = 24
}