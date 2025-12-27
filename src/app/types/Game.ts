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
	white_pawn = 0,
	white_brawn = 6,
	white_rook = 1,
	white_unicorn = 7,
	white_dragon = 8,
	white_knight = 2,
	white_bishop = 3,
	white_king = 4,
	white_common_king = 9,
	white_queen = 5,
	white_princess = 10,
	white_royal_queen = 11,
	black_pawn = 16,
	black_brawn = 22,
	black_rook = 17,
	black_unicorn = 23,
	black_dragon = 24,
	black_knight = 18,
	black_bishop = 19,
	black_king = 20,
	black_common_king = 25,
	black_queen = 21,
	black_princess = 26,
	black_royal_queen = 27
}

export namespace Piece {
	export function color(piece: Piece): number {
		return piece & 16;
	}
	
	export function type(piece: Piece): Piece {
		return piece & 15;
	}
}