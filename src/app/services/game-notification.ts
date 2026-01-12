import { Injectable } from '@angular/core';
import { WebSocketSubject, webSocket } from 'rxjs/webSocket';
import { Observable, throwError } from 'rxjs';
import { Move } from 'src/app/types/Move';
import { environment } from 'src/environments/environment';

@Injectable({
    providedIn: 'root',
})
export class GameNotification {
	private url = environment.apiBaseUrl + 'games';
	
	private socket: WebSocketSubject<Move> | undefined;
	
	public connect(gameId: number, currentMove: number) {
		this.socket = webSocket(`${this.url}/${gameId}/moves/${currentMove}`);
	}
	
	public getMessages(): Observable<Move> {
		if (!this.socket) {
			return throwError(() => new Error("Connection error"));
		}
		return this.socket.asObservable();
	}
	
	public close() {
		this.socket?.complete();
	}
}
