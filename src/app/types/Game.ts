import { GameState } from "./GameState";
import { Move } from "./Move";

export class Game {
	constructor(public Player: number, public StartingState: GameState, public StartingPlayer: number, public Moves: Move[], public ActivePlayer: number, public Status: GameStatus, public WinnerPlayer: number | null) {}
}

export enum GameStatus {
	starting = 'starting',
	in_progress = 'in_progress',
	finished = 'finished',
	forfeited = 'forfeited',
}

export enum Piece {
	black_pawn = 0,
	white_pawn = 1,
	black_rook = 2,
	white_rook = 3,
	black_knight = 4,
	white_knight = 5,
	black_bishop = 8,
	white_bishop = 9,
	black_queen = 16,
	white_queen = 17,
	black_king = 32,
	white_king = 33,
	black_brawn = 64,
	white_brawn = 65,
	black_unicorn = 128,
	white_unicorn = 129,
	black_dragon = 256,
	white_dragon = 257,
	black_princess = 512,
	white_princess = 513,
	black_royal_queen = 1024,
	white_royal_queen = 1025,
	black_common_king = 2048,
	white_common_king = 2049
}

export namespace Piece {
	export function color(piece: Piece): number {
		return piece & 1;
	}
	
	export function type(piece: Piece): Piece {
		return (piece | 1) - 1;
	}
}