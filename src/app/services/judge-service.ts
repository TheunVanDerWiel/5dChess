import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { JudgeReply, JudgeRequest } from 'src/app/engine/judge.worker';
import { Color } from 'src/app/engine/piece';
import { GameState } from 'src/app/types/GameState';
import { Move } from 'src/app/types/Move';

/**
 * Runs the checkmate search away from the main thread, so it can take as long as it
 * needs. A game that ends in checkmate should end, rather than sitting in limbo
 * because the search gave up, so nothing here is time limited: it either answers or
 * is abandoned when the player turns out to have a move after all.
 */
@Injectable({
	providedIn: 'root',
})
export class JudgeService {
	private worker: Worker | undefined;
	private replies = new Subject<JudgeReply>();
	private asked = 0;

	/**
	 * Asks whether the colour has any turn left, abandoning whatever was running.
	 * The position is sent as the opening plus the moves played, so that the worker
	 * rebuilds it exactly, down to what a pawn may take in passing.
	 */
	public ask(startingState: GameState, moves: Move[], color: Color): number {
		this.cancel();
		const id = ++this.asked;
		if (typeof Worker === 'undefined') { return id; }
		this.worker = new Worker(new URL('../engine/judge.worker', import.meta.url));
		this.worker.onmessage = ({ data }: MessageEvent<JudgeReply>) => this.replies.next(data);
		const request: JudgeRequest = { id, startingState, moves, color };
		this.worker.postMessage(request);
		return id;
	}

	public answers(): Observable<JudgeReply> {
		return this.replies.asObservable();
	}

	/** Stops a search in progress. Terminating is the only thing that interrupts one. */
	public cancel() {
		this.worker?.terminate();
		this.worker = undefined;
	}
}
