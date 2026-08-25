import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { Observable, Subject, of, throwError } from 'rxjs';

import { Game } from './game';
import { Game as GameType, GameStatus, GameUpdate } from 'src/app/types/Game';
import { Board, GameState, TimeLine } from 'src/app/types/GameState';
import { GameService } from 'src/app/services/game-service';
import { GameNotification } from 'src/app/services/game-notification';
import { JudgeService } from 'src/app/services/judge-service';
import { LocalStorageService } from 'src/app/services/local-storage-service';
import { JudgeReply } from 'src/app/engine/judge.worker';
import { Piece } from 'src/app/engine/piece';

/** An empty board of the given size, as the wire format holds it. */
function emptyBoard(size: number): (Piece | null)[][] {
	const squares: (Piece | null)[][] = [];
	for (let x = 0; x < size; x++) {
		const column: (Piece | null)[] = [];
		for (let y = 0; y < size; y++) { column.push(null); }
		squares.push(column);
	}
	return squares;
}

/** A board with nothing on it but the two kings, which is enough to be assessed. */
function startingState(): GameState {
	const squares = emptyBoard(4);
	squares[0][0] = Piece.white_king;
	squares[3][3] = Piece.black_king;
	return new GameState([new TimeLine(0, [new Board(squares)], undefined)]);
}

/** A back rank mate: the white king is cornered and the rooks have it covered. */
function matedState(): GameState {
	const squares = emptyBoard(8);
	squares[7][4] = Piece.white_king;
	squares[1][4] = Piece.black_rook;
	squares[0][3] = Piece.black_rook;
	squares[0][5] = Piece.black_rook;
	return new GameState([new TimeLine(0, [new Board(squares)], undefined)]);
}

/** Lets the component's deferred work, which it schedules on a timer, run. */
function settle(): Promise<void> {
	return new Promise(resolve => setTimeout(resolve));
}

class JudgeStub {
	public asks = 0;
	public cancels = 0;
	private replies = new Subject<JudgeReply>();

	ask(): number {
		this.cancels++;
		return ++this.asks;
	}

	answers(): Observable<JudgeReply> {
		return this.replies.asObservable();
	}

	cancel(): void {
		this.cancels++;
	}
}

class NotificationStub {
	public updates = new Subject<GameUpdate>();
	public connects = 0;
	public closes = 0;

	connect(): void { this.connects++; }
	getMessages(): Observable<GameUpdate> { return this.updates.asObservable(); }
	close(): void { this.closes++; }
	acknowledge(): void {}
}

describe('Game', () => {
	let component: Game;
	let fixture: ComponentFixture<Game>;
	let judge: JudgeStub;
	let notifications: NotificationStub;
	let game: GameType;
	let games: { getGame: () => Observable<GameType>, forfeit: () => Observable<boolean> };
	let scrolls: (boolean | ScrollIntoViewOptions | undefined)[];

	beforeEach(async () => {
		// Nothing is laid out here, so the browser's own scrolling is stood in for
		// and the calls recorded: what can be told apart is what was asked for.
		scrolls = [];
		Element.prototype.scrollIntoView = function (options?: boolean | ScrollIntoViewOptions) {
			scrolls.push(options);
		};
		judge = new JudgeStub();
		notifications = new NotificationStub();
		game = new GameType(3, 1, 1, startingState(), 1, [], GameStatus.in_progress, null);
		games = { getGame: () => of(game), forfeit: () => of(true) };

		await TestBed.configureTestingModule({
			imports: [Game],
			providers: [
				{ provide: ActivatedRoute, useValue: { params: of({ gameId: 3 }) } },
				provideRouter([]),
				{ provide: GameService, useValue: games },
				{ provide: GameNotification, useValue: notifications },
				{ provide: JudgeService, useValue: judge },
				{ provide: LocalStorageService, useValue: { getItem: () => 'player-one', setItem: () => {} } },
			]
		}).compileComponents();

		fixture = TestBed.createComponent(Game);
		component = fixture.componentInstance;
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('judges the position once the game is loaded', async () => {
		component.ngOnInit();
		await settle();
		expect(judge.asks).toBe(1);
	});

	it('leaves the running search alone when a poll brings no news', async () => {
		component.ngOnInit();
		await settle();
		expect(judge.asks).toBe(1);
		const cancels = judge.cancels;

		// Three polls of the same position, as the game is polled every few seconds.
		for (let poll = 0; poll < 3; poll++) {
			notifications.updates.next(new GameUpdate([], game.Status, game.ActivePlayer, game.WinnerPlayer));
			await settle();
		}

		expect(judge.asks).toBe(1);
		expect(judge.cancels).toBe(cancels);
	});

	it('judges again once the opponent has played', async () => {
		game.ActivePlayer = 2;
		component.ngOnInit();
		await settle();
		expect(judge.asks).toBe(0);

		notifications.updates.next(new GameUpdate([], GameStatus.in_progress, 1, null));
		await settle();

		expect(judge.asks).toBe(1);
	});

	it('notices that the game ended while the player waited', async () => {
		game.ActivePlayer = 2;
		component.ngOnInit();
		await settle();

		notifications.updates.next(new GameUpdate([], GameStatus.forfeited, 2, 1));
		await settle();

		expect(component.isOver()).toBe(true);
	});

	it('stops watching a game that has ended', async () => {
		game.ActivePlayer = 2;
		component.ngOnInit();
		await settle();
		expect(notifications.closes).toBe(0);

		notifications.updates.next(new GameUpdate([], GameStatus.finished, 2, 1));
		await settle();

		expect(notifications.closes).toBe(1);
	});

	it('marks the royals that were left in check when the game ended', async () => {
		game.StartingState = matedState();
		game.Status = GameStatus.finished;
		game.WinnerPlayer = 2;
		component.ngOnInit();
		fixture.detectChanges();
		await settle();
		await settle();

		expect(component.arrows.some(arrow => arrow.kind === 'threat')).toBe(true);
	});

	it('opens on the present when the game is loaded', async () => {
		component.ngOnInit();
		fixture.detectChanges();
		await settle();

		// Straight there, and in the middle: there is no journey to follow across a
		// multiverse the player has not seen yet.
		expect(scrolls).toContainEqual({ block: 'center', inline: 'center', behavior: 'auto' });
	});

	it('brings the present into view when the turn comes back', async () => {
		game.ActivePlayer = 2;
		component.ngOnInit();
		fixture.detectChanges();
		await settle();
		scrolls = [];

		notifications.updates.next(new GameUpdate([], GameStatus.in_progress, 1, null));
		fixture.detectChanges();
		await settle();

		// Sideways only, so the timelines being read stay where they are.
		expect(scrolls).toContainEqual({ block: 'nearest', inline: 'center', behavior: 'smooth' });
	});

	it('stays put when a poll brings no news', async () => {
		game.ActivePlayer = 2;
		component.ngOnInit();
		fixture.detectChanges();
		await settle();
		scrolls = [];

		notifications.updates.next(new GameUpdate([], game.Status, 2, null));
		fixture.detectChanges();
		await settle();

		expect(scrolls).toEqual([]);
	});

	it('gives up when the server takes the forfeit', async () => {
		component.ngOnInit();
		await settle();

		component.confirmForfeit();
		await settle();

		expect(component.game?.Status).toBe(GameStatus.forfeited);
		expect(component.error).toBeNull();
	});

	it('reports a forfeit the server would not take', async () => {
		// A game that was never in progress cannot be given up on, and the answer
		// says so rather than failing outright.
		games.forfeit = () => of(false);
		component.ngOnInit();
		await settle();

		component.confirmForfeit();
		await settle();

		expect(component.game?.Status).toBe(GameStatus.in_progress);
		expect(component.error).toBe('An error occurred. Refresh the page and try again.');
	});

	it('reports a forfeit that never reached the server', async () => {
		games.forfeit = () => throwError(() => new Error('offline'));
		component.ngOnInit();
		await settle();

		component.confirmForfeit();
		await settle();

		expect(component.game?.Status).toBe(GameStatus.in_progress);
		expect(component.error).toBe('An error occurred. Refresh the page and try again.');
	});

	it('never watches a game that was already over when it was opened', async () => {
		game.Status = GameStatus.finished;
		game.WinnerPlayer = 1;
		component.ngOnInit();
		await settle();

		expect(notifications.connects).toBe(0);
	});
});
