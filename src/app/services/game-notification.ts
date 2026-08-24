import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject, Subscription, catchError, map, of, switchMap, timer } from 'rxjs';
import { GameUpdate } from 'src/app/types/Game';
import { environment } from 'src/environments/environment';

/**
 * Watches a game for the opponent's turns. The API is polled rather than pushed over
 * a socket, because the host does not keep long-lived connections alive.
 */
@Injectable({
    providedIn: 'root',
})
export class GameNotification {
	/** How often to ask whether the opponent has moved, in milliseconds. */
	private static readonly INTERVAL = 3000;

	private url = environment.apiBaseUrl + 'games';

	private http = inject(HttpClient);
	private updates = new Subject<GameUpdate>();
	private polling: Subscription | undefined;
	/** How many turns of this game the client has already seen. */
	private seen = 0;

	public connect(gameId: number, userId: string, currentMove: number) {
		this.close();
		this.seen = currentMove;
		this.polling = timer(GameNotification.INTERVAL, GameNotification.INTERVAL).pipe(
			// switchMap drops a poll that is still in flight when the next one is due.
			switchMap(() => {
				// Remember which turn the answer will start at: the player may submit a
				// turn of their own while this request is in flight, and the response
				// would then carry a turn the board has already been given.
				const from = this.seen;
				return this.http
					.get<GameUpdate>(`${this.url}/${gameId}/moves/${from}?userId=${userId}`)
					.pipe(map(update => ({ from, update })), catchError(() => of({ from, update: null })));
			})
		).subscribe(answer => {
			if (answer.update === null) { return; }
			const fresh = answer.update.Moves.filter((move, offset) => answer.from + offset >= this.seen);
			this.seen = Math.max(this.seen, answer.from + answer.update.Moves.length);
			this.updates.next({ ...answer.update, Moves: fresh });
		});
	}

	public getMessages(): Observable<GameUpdate> {
		return this.updates.asObservable();
	}

	public close() {
		this.polling?.unsubscribe();
		this.polling = undefined;
	}

	/** Keeps the poller from replaying a turn the client made itself. */
	public acknowledge(turns: number) {
		this.seen = turns;
	}
}
