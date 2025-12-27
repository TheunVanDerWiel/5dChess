import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Game } from 'src/app/types/Game';
import { HttpClient } from '@angular/common/http';
import { environment } from 'src/environments/environment';

@Injectable({
	providedIn: 'root',
})
export class GameService {
	private url = environment.apiBaseUrl + 'games';

	private http = inject(HttpClient);

	getGame(gameId: number, userId: string): Observable<Game> {
		return this.http.get<Game>(`${this.url}/${gameId}?userId=${userId}`);
	}

	create(userId: string, type: number): Observable<Game> {
		return this.http.post<Game>(this.url, { userId: userId, type: type });
	}

	join(gameId: number, userId: string): Observable<Game> {
		return this.http.get<Game>(`${this.url}/${gameId}/join/${userId}`);
	}
}
