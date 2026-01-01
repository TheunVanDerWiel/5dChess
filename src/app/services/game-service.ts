import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { Game, GameStatus, Piece } from 'src/app/types/Game';
import { GameState, TimeLine, Board } from 'src/app/types/GameState';
import { HttpClient } from '@angular/common/http';
import { environment } from 'src/environments/environment';

@Injectable({
	providedIn: 'root',
})
export class GameService {
	private url = environment.apiBaseUrl + 'games';

	private http = inject(HttpClient);

	getGame(gameId: number, userId: string): Observable<Game> {
		// TODO: cleanup after testing
		var board = new Board([
			[Piece.white_rook,Piece.white_knight,Piece.white_bishop,Piece.white_queen,Piece.white_king,Piece.white_bishop,Piece.white_knight,Piece.white_rook],
			[Piece.white_pawn,Piece.white_pawn,Piece.white_pawn,Piece.white_pawn,Piece.white_pawn,Piece.white_pawn,Piece.white_pawn,Piece.white_pawn],
			[null,null,null,null,null,null,null,null],
			[null,null,null,null,null,null,null,null],
			[null,null,null,null,null,null,null,null],
			[null,null,null,null,null,null,null,null],
			[Piece.black_pawn,Piece.black_pawn,Piece.black_pawn,Piece.black_pawn,Piece.black_pawn,Piece.black_pawn,Piece.black_pawn,Piece.black_pawn],
			[Piece.black_rook,Piece.black_knight,Piece.black_bishop,Piece.black_queen,Piece.black_king,Piece.black_bishop,Piece.black_knight,Piece.black_rook]
		]);
		var state = new GameState([
			new TimeLine(0, [board], undefined)
		]);
		return of(new Game(1, state, 1, [], GameStatus.in_progress, null));
		
		return this.http.get<Game>(`${this.url}/${gameId}?userId=${userId}`);
	}

	create(userId: string, type: number): Observable<Game> {
		return this.http.post<Game>(this.url, { userId: userId, type: type });
	}

	join(gameId: number, userId: string): Observable<Game> {
		return this.http.get<Game>(`${this.url}/${gameId}/join/${userId}`);
	}
}
