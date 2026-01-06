import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { Game, GameStatus, Piece } from 'src/app/types/Game';
import { GameState, TimeLine, Board } from 'src/app/types/GameState';
import { Move } from 'src/app/types/Move';
import { HttpClient } from '@angular/common/http';
import { environment } from 'src/environments/environment';

@Injectable({
	providedIn: 'root',
})
export class GameService {
	private url = environment.apiBaseUrl + 'games';

	private http = inject(HttpClient);

	getGames(userId: string): Observable<Game> {
		return this.http.get<Game>(`${this.url}?userId=${userId}`);
	}

	getGame(gameId: number, userId: string): Observable<Game> {
		return this.http.get<Game>(`${this.url}/${gameId}?userId=${userId}`);
	}

	create(userId: string, type: number): Observable<number> {
		return this.http.post<number>(this.url, { UserId: userId, Type: type });
	}

	join(gameId: number, userId: string): Observable<boolean> {
		return this.http.post<boolean>(`${this.url}/${gameId}`, { UserId: userId });
	}
	
	confirmMove(gameId: number, userId: string, move: Move): Observable<boolean> {
		return this.http.put<boolean>(`${this.url}/${gameId}`, { UserId: userId, Move: move });
	}
}
