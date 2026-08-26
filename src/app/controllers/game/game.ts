import { Component, OnDestroy, OnInit, inject, HostListener } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { Game as GameType, GameStatus, GameUpdate, Color, Piece } from 'src/app/types/Game';
import { Move } from 'src/app/types/Move';
import { LocalStorageService } from 'src/app/services/local-storage-service';
import { GameService } from 'src/app/services/game-service';
import { GameNotification } from 'src/app/services/game-notification';
import { Ref, State, colorToMove, sameRef } from 'src/app/engine/state';
import { Move as EngineMove, targets } from 'src/app/engine/movegen';
import { AppliedMove, applyMove, applyTurn, isTurnComplete, undoMove, undoTurn } from 'src/app/engine/turn';
import { moveFromDto, moveToDto, stateFromDto } from 'src/app/engine/dto';
import { promotes, promotionChoices } from 'src/app/engine/promotion';
import { attacksOn, isAttacked, movableAfter } from 'src/app/engine/attacks';
import { Verdict } from 'src/app/engine/checkmate';
import { opponent } from 'src/app/engine/piece';
import { pieceName, pieceSlug } from 'src/app/engine/piece';
import { PieceSprite } from 'src/app/components/piece-sprite/piece-sprite';
import { Arrow, BoardView, Origin, buildView } from './board-view';
import { JudgeService } from 'src/app/services/judge-service';
import { JudgeReply } from 'src/app/engine/judge.worker';
import { USER_ID_PARAM } from 'src/app/services/user-id';

@Component({
	selector: 'app-game',
	imports: [
		RouterLink,
		CommonModule,
		PieceSprite
	],
	templateUrl: './game.html',
	styleUrl: './game.less',
})
export class Game implements OnInit, OnDestroy {
	/** How long a search may run before the player is told it is still going. */
	private static readonly SEARCH_NOTICE = 1000;
	/** What each zoom level scales the board by, matching the stylesheet. */
	private static readonly ZOOM_SCALE = [0.5, 0.75, 1, 1.5, 2];
	/** Length of an arrow head, matching the markers in the template. */
	private static readonly ARROW_HEAD = 12;
	/** Length of the head on an origin curve, matching its marker in the template. */
	private static readonly ORIGIN_HEAD = 10;


	public showMenu = false;
	public view: BoardView | undefined;
	public game: GameType | undefined;
	public selected: Ref | null = null;
	public validTargets: Ref[] = [];
	/** Set while a pawn waits for the player to say what it becomes. */
	public promotion: { move: EngineMove, choices: Piece[] } | null = null;
	/** Set while the player is being asked whether they really mean to give up. */
	public confirmingForfeit = false;
	/** Set when something the player asked for did not reach the game, or null. */
	public error: string | null = null;
	/** Whether one of the player's royals could be taken if they left things as they are. */
	public inCheck = false;
	/** Whether the engine is still working out if a turn exists at all. */
	public searching = false;
	public zoom = 4;
	public boardSize = 0;
	/**
	 * Empty space past the last board, so that it can be brought to the middle of the
	 * screen instead of stopping against the right hand edge.
	 */
	public trailing = { right: 0, bottom: 0 };
	/** Lines drawn over the boards: journeys across boards, and threats to royals. */
	public arrows: Arrow[] = [];
	/** Curves drawn behind the boards, marking where each timeline was branched off. */
	public origins: Origin[] = [];
	/** Whether the selected piece is only being looked at, not moved. */
	public previewing = false;
	public userId: string | null = null;
	/**
	 * What links back to the menu have to carry: the id itself when the browser will
	 * not store it, so that the address bar keeps holding it, and nothing otherwise.
	 */
	public carried: { [name: string]: string } = {};

	/** The moves played so far this turn, and what it takes to take them back. */
	private pending: EngineMove[] = [];
	private applied: AppliedMove[] = [];
	private state: State | undefined;
	private destroyed = false;
	/** Which judgement the answer is currently being waited on for. */
	private judging = 0;
	/** How many turns had been played when the running search was started. */
	private judgingAt = -1;
	/** The position the game was set up with, which decides the promotion choices. */
	private start: State | undefined;
	private subscriptions = new Subscription();

	private router = inject(Router);
	private route = inject(ActivatedRoute);
	private gameService = inject(GameService);
	private moveService = inject(GameNotification);
	private judgeService = inject(JudgeService);
	private localStorage = inject(LocalStorageService);

	ngOnInit(): void {
		// Check if user is a player of the game. A browser that will not store the id
		// leaves it in the address bar instead, so that is where it is looked for next.
		var stored: string | null = this.localStorage.getItem('userId');
		this.userId = stored ?? this.route.snapshot.queryParamMap.get(USER_ID_PARAM);
		if (this.userId === null) {
			this.router.navigateByUrl('/');
		} else if (stored === null) {
			this.carried = { [USER_ID_PARAM]: this.userId };
		}
		this.subscriptions.add(this.judgeService.answers().subscribe(reply => this.receiveVerdict(reply)));
		this.subscriptions.add(this.route.params.subscribe(routeParams => {
			var gameId = routeParams['gameId'];
			if (!gameId) {
				this.leave();
			}

			this.loadGame(gameId);
		}));
	}

	ngOnDestroy(): void {
		this.destroyed = true;
		this.judgeService.cancel();
		this.subscriptions.unsubscribe();
		this.moveService.close();
	}

	/**
	 * The sprite symbol a piece is drawn with. A piece is outlined when its colour
	 * matches its square and filled otherwise, so it stays legible either way.
	 */
	public getPieceIcon(piece: Piece, x: number, y: number): string {
		var variant = Piece.color(piece) == 1 - (x + y) % 2 ? 'outline' : 'solid';
		return `#piece-${pieceSlug(piece)}-${variant}`;
	}

	public getHighlight(square: Ref): string {
		if (this.selected === null) { return ""; }
		if (sameRef(this.selected, square)) { return "border-selected"; }
		if (this.validTargets.some(target => sameRef(target, square))) {
			return this.previewing ? "border-preview" : "border-selectable";
		}
		return "";
	}

	public getUserColor(): Color {
		return this.game?.StartingPlayer == 1 ? Color.white : Color.black;
	}

	public isPlayerTurn(): boolean {
		if (!this.game) { return false; }
		return this.game.ActivePlayer == 1 && this.game.Status == GameStatus.in_progress;
	}

	public hasPendingMoves(): boolean {
		return this.pending.length > 0;
	}

	@HostListener('window:resize')
	public onResize() {
		this.measureTrailing();
	}

	/** Zooms a step, keeping whatever was in the middle of the screen in the middle. */
	public zoomBy(step: number) {
		var next = Math.min(5, Math.max(1, this.zoom + step));
		if (next == this.zoom) { return; }
		var pane = this.pane();
		var before = Game.ZOOM_SCALE[this.zoom - 1];
		var after = Game.ZOOM_SCALE[next - 1];
		// Where the middle of the screen is, in the board's own coordinates
		var middle = pane === null ? null : {
			x: (pane.scrollLeft + pane.clientWidth / 2) / before,
			y: (pane.scrollTop + pane.clientHeight / 2) / before
		};

		this.zoom = next;
		this.measureTrailing();
		setTimeout(() => {
			if (this.destroyed || pane === null || middle === null) { return; }
			pane.scrollTo({
				left: middle.x * after - pane.clientWidth / 2,
				top: middle.y * after - pane.clientHeight / 2
			});
		});
	}

	public select(square: Ref) {
		if (this.zoom < 4) {
			this.selectBoard(square);
		} else {
			this.selectSquare(square);
		}
	}

	public deselect() {
		this.selected = null;
		this.validTargets = [];
		this.previewing = false;
	}

	public getName(piece: Piece): string {
		return pieceName(piece);
	}

	public choosePromotion(type: Piece) {
		if (this.promotion === null) { return; }
		this.play({ ...this.promotion.move, promotion: type });
		this.promotion = null;
	}

	public cancelPromotion() {
		this.promotion = null;
		this.deselect();
	}

	public isMoveComplete(): boolean {
		if (!this.state) { return false; }
		var me = this.getUserColor();
		return isTurnComplete(this.state, me) && !isAttacked(this.state, me, movableAfter(this.state, opponent(me)));
	}

	public confirm() {
		if (!this.game || !this.userId || !this.isMoveComplete()) { return; }
		var move = new Move(this.pending.map(moveToDto));
		this.subscriptions.add(this.gameService.confirmMove(this.game.Id, this.userId, move).subscribe(success => {
			if (!this.game) { return; }
			this.game.Moves.push(move);
			this.game.ActivePlayer = 3 - this.game.ActivePlayer;
			this.moveService.acknowledge(this.game.Moves.length);
			// A whole turn went in, so there was one to find: nothing left to search for.
			this.judgeService.cancel();
			this.judging = 0;
			this.judgingAt = -1;
			this.searching = false;
			this.pending = [];
			this.applied = [];
			this.refresh();
		}, error => {
			this.reportFailure();
		}));
	}

	public undo() {
		if (!this.state || this.applied.length == 0) { return; }
		undoMove(this.state, this.applied[this.applied.length - 1]);
		this.applied.pop();
		this.pending.pop();
		this.deselect();
		this.refresh();
	}

	public forfeit() {
		this.confirmingForfeit = true;
	}

	public cancelForfeit() {
		this.confirmingForfeit = false;
	}

	public confirmForfeit() {
		this.confirmingForfeit = false;
		if (!this.game || !this.userId) { return; }
		this.subscriptions.add(this.gameService.forfeit(this.game.Id, this.userId).subscribe(success => {
			if (!this.game) { return; }
			// A refusal reads as an answer rather than as a failure: the game was not
			// one that could be given up on, so the board here is out of date.
			if (!success) { return this.reportFailure(); }
			this.game.Status = GameStatus.forfeited;
			this.game.WinnerPlayer = 2;
			this.stopWatchingIfOver();
		}, error => {
			this.reportFailure();
		}));
	}

	public dismissError() {
		this.error = null;
	}

	public isOver(): boolean {
		return this.game?.Status == GameStatus.finished || this.game?.Status == GameStatus.forfeited;
	}

	public outcome(): string {
		if (!this.game) { return ''; }
		var forfeited = this.game.Status == GameStatus.forfeited;
		if (this.game.WinnerPlayer == 1) {
			return forfeited ? 'Your opponent gave up. You win.' : 'Checkmate. You win.';
		}
		if (this.game.WinnerPlayer == 2) {
			return forfeited ? 'You gave up. Your opponent wins.' : 'Checkmate. Your opponent wins.';
		}
		return 'Stalemate. The game is a draw.';
	}

	public receiveUpdate(update: GameUpdate) {
		if (!this.game || !this.state) { return; }
		// The game is polled on a timer, so most answers carry no news at all. Acting
		// on one of those would rebuild the board and start the checkmate search over
		// every few seconds, so nothing happens here unless the answer says something
		// the board does not already show.
		var changed = update.Moves.length > 0
			|| update.Status != this.game.Status
			|| update.ActivePlayer != this.game.ActivePlayer
			|| update.WinnerPlayer != this.game.WinnerPlayer;
		if (!changed) { return; }
		var wasWaiting = !this.isPlayerTurn();
		update.Moves.forEach(turn => {
			applyTurn(this.state!, turn.Pieces.map(moveFromDto));
			this.game!.Moves.push(turn);
		});
		this.game.Status = update.Status;
		this.game.ActivePlayer = update.ActivePlayer;
		this.game.WinnerPlayer = update.WinnerPlayer;
		this.stopWatchingIfOver();
		this.refresh();
		this.scheduleAssessment();
		// The turn coming back is what the player was waiting for, so the present is
		// brought to them rather than leaving them to find where it has moved to.
		if (wasWaiting && this.isPlayerTurn()) { this.scrollToPresent(); }
	}

	/**
	 * Brings the boards of the present into view. Scheduled rather than done here,
	 * because the boards it names have yet to be laid out.
	 *
	 * A player arriving at the board is put in the middle of the present at once,
	 * since there is no journey across the multiverse to follow when they have not
	 * seen any of it yet. Mid-game only the sideways position is chased, and
	 * smoothly, so that whichever timelines they were reading stay where they are.
	 */
	private scrollToPresent(arriving = false) {
		setTimeout(() => {
			if (this.destroyed) { return; }
			var board = document.querySelector('td.active');
			board?.scrollIntoView({
				block: arriving ? 'center' : 'nearest',
				inline: 'center',
				behavior: arriving ? 'auto' : 'smooth'
			});
		});
	}

	/**
	 * A game that has ended has nothing further to report, so it stops being asked.
	 * Called wherever the game may have reached its end, since it can end on the
	 * opponent's account as easily as on the player's own.
	 */
	private stopWatchingIfOver() {
		if (this.isOver()) { this.moveService.close(); }
	}

	private loadGame(gameId: number) {
		this.subscriptions.add(this.gameService.getGame(gameId, this.userId!).subscribe(game => {
			this.game = game;
			this.start = stateFromDto(game.StartingState);
			this.state = this.start.clone();
			game.Moves.forEach(turn => applyTurn(this.state!, turn.Pieces.map(moveFromDto)));
			this.boardSize = 24 * this.state.size + 32;
			this.refresh();
			this.measureTrailing();
			this.scheduleAssessment();
			// Where the game has got to is what the player came back for, so it opens
			// on the present rather than at the far corner of the multiverse. Without
			// a smooth scroll: there is no journey to follow on a board just arrived at.
			this.scrollToPresent(true);

			// Start polling for the opponent's turns, unless the game is already over.
			if (!this.isOver()) {
				this.moveService.connect(game.Id, this.userId!, game.Moves.length);
				this.subscriptions.add(this.moveService.getMessages().subscribe(update => this.receiveUpdate(update)));
			}
		}, error => {
			this.leave();
		}));
	}

	/** Back to the menu, taking the id along if the address bar is all that holds it. */
	private leave() {
		this.router.navigate(['/'], { queryParams: this.carried });
	}

	private pane(): HTMLElement | null {
		return document.querySelector('main');
	}

	/**
	 * Works out how much empty space to leave past the last board. The table is
	 * scaled by a transform, so the padding is measured in the board's own
	 * coordinates and comes out the right size on screen once it has been scaled.
	 *
	 * The space is only worth having while the grid outgrows the screen. Once it
	 * all fits there is nothing to scroll towards, and the padding would be dead
	 * space that grows as the boards get smaller: it is half a screen wide at any
	 * zoom, so the further out the view is pulled the more it dwarfs the boards.
	 */
	private measureTrailing() {
		var pane = this.pane();
		if (pane === null || this.boardSize == 0) { return; }
		var scale = Game.ZOOM_SCALE[this.zoom - 1];
		// Measured off the view rather than the table, because this runs before the
		// new zoom has been laid out. The header row and column are left out, so a
		// grid that only just fits still counts as overflowing and keeps its space.
		var spread = (this.view?.columns.length ?? 0) * this.boardSize * scale;
		var depth = (this.view?.rows.length ?? 0) * this.boardSize * scale;
		this.trailing = {
			right: spread <= pane.clientWidth ? 0
				: Math.max(0, (pane.clientWidth / scale - this.boardSize) / 2),
			bottom: depth <= pane.clientHeight ? 0
				: Math.max(0, (pane.clientHeight / scale - this.boardSize) / 2)
		};
	}

	/** Rebuilds the read model after the position changed. */
	private refresh() {
		if (!this.state) { return; }
		this.view = buildView(this.state, this.getUserColor());
		// The boards have to be laid out before anything can be drawn over them.
		setTimeout(() => {
			if (this.destroyed) { return; }
			this.drawArrows();
			this.drawOrigins();
		});
	}

	/**
	 * Works out the curves that say where each timeline came from: one from the board
	 * a timeline was branched off to the first board of the timeline itself.
	 *
	 * They leave the parent board through the edge facing the new timeline and come
	 * back in at its left hand side, so that a curve spends what it can of itself in
	 * the space between boards. The rest passes behind them, which is what the
	 * stylesheet puts these underneath the boards for: a branch made many timelines
	 * away would otherwise be drawn across every board in between.
	 */
	private drawOrigins() {
		this.origins = [];
		if (!this.view) { return; }
		var wrapper = document.querySelector('.content');
		if (wrapper === null) { return; }
		var pane = wrapper;
		var base = pane.getBoundingClientRect();
		var scale = Game.ZOOM_SCALE[this.zoom - 1];

		var box = (l: number, t: number) => {
			var board = pane.querySelector('[data-board="' + l + ':' + t + '"] > .board');
			if (board === null) { return null; }
			var rect = board.getBoundingClientRect();
			return {
				left: (rect.left - base.left) / scale,
				right: (rect.right - base.left) / scale,
				top: (rect.top - base.top) / scale,
				bottom: (rect.bottom - base.top) / scale
			};
		};

		for (const row of this.view.rows) {
			if (row.origin === null || row.boards.length == 0) { continue; }
			var from = box(row.origin.l, row.origin.t);
			var to = box(row.index, row.boards[0].t);
			if (from === null || to === null) { continue; }
			var start = {
				x: (from.left + from.right) / 2,
				// Down towards the new timeline, which is drawn beyond every other one.
				y: to.top > from.bottom ? from.bottom : from.top
			};
			// Short of the board by the length of the head, which is anchored by its
			// base and points the way the curve is going: left to the board's edge,
			// and the tip lands on it rather than behind it.
			var end = { x: to.left - Game.ORIGIN_HEAD, y: (to.top + to.bottom) / 2 };
			// Away from the parent board at a right angle, and back into the new one
			// at a right angle, so the curve reads as leaving one and joining the other.
			var reach = 0.65;
			var c1 = { x: start.x, y: start.y + (end.y - start.y) * reach };
			var c2 = { x: end.x - (end.x - start.x) * reach, y: end.y };
			this.origins.push({
				d: `M${start.x} ${start.y}C${c1.x} ${c1.y} ${c2.x} ${c2.y} ${end.x} ${end.y}`
			});
		}
	}

	/**
	 * Works out the lines drawn over the boards: one for every move that crossed from
	 * one board to another, and one for every piece currently threatening a royal.
	 *
	 * Positions come from the rendered squares rather than from board arithmetic,
	 * which keeps this honest about margins, borders and the gaps between cells. They
	 * are then divided back out of the zoom, because the overlay sits inside the
	 * element the zoom scales and so shares its unscaled coordinates.
	 */
	private drawArrows() {
		this.arrows = [];
		if (!this.state || !this.game) { return; }
		var wrapper = document.querySelector('.content');
		if (wrapper === null) { return; }
		var pane = wrapper;
		var base = pane.getBoundingClientRect();
		var scale = Game.ZOOM_SCALE[this.zoom - 1];
		var boards = new Map<string, NodeListOf<Element>>();

		var centre = (square: Ref): { x: number, y: number } | null => {
			if (!this.state) { return null; }
			var key = square.l + ':' + square.t;
			var squares = boards.get(key);
			if (squares === undefined) {
				var board = pane.querySelector('[data-board="' + key + '"]');
				if (board === null) { return null; }
				squares = board.querySelectorAll('.square');
				boards.set(key, squares);
			}
			var size = this.state.size;
			var flipped = this.getUserColor() == Color.black;
			var row = flipped ? size - 1 - square.x : square.x;
			var column = flipped ? size - 1 - square.y : square.y;
			var cell = squares[row * size + column];
			if (cell === undefined) { return null; }
			var box = cell.getBoundingClientRect();
			return {
				x: (box.left + box.width / 2 - base.left) / scale,
				y: (box.top + box.height / 2 - base.top) / scale
			};
		};

		var add = (from: Ref, to: Ref, kind: 'move' | 'threat') => {
			var start = centre(from), end = centre(to);
			if (start === null || end === null) { return; }
			// The line stops where the head begins. Both are translucent, so a line
			// running on underneath would show through the head and darken it. The
			// head is anchored by its base, so it still reaches the square itself.
			var run = { x: end.x - start.x, y: end.y - start.y };
			var length = Math.hypot(run.x, run.y);
			var shaft = length <= Game.ARROW_HEAD ? 0 : (length - Game.ARROW_HEAD) / length;
			this.arrows.push({
				x1: start.x,
				y1: start.y,
				x2: start.x + run.x * shaft,
				y2: start.y + run.y * shaft,
				kind
			});
		};

		var played = this.game.Moves.map(turn => turn.Pieces.map(moveFromDto)).concat([this.pending]);
		for (const turn of played) {
			for (const move of turn) {
				// A move within one board needs no arrow: it is plain to see.
				if (move.from.l == move.to.l && move.from.t == move.to.t) { continue; }
				add(move.from, move.to, 'move');
			}
		}

		// Threats are drawn while the player still has to answer them, and again once
		// the game is over, where they show which royals were left in check by the
		// last move played.
		if (this.isPlayerTurn() || this.isOver()) {
			var defender = this.sideToMove();
			for (const attack of attacksOn(this.state, defender, movableAfter(this.state, opponent(defender)))) {
				add(attack.from, attack.to, 'threat');
			}
		}
	}

	/**
	 * The colour whose move it is: the player's own while they are to play, and the
	 * opponent's otherwise. On a game that ended in checkmate this is the side that
	 * was mated, since it ended on their turn with nothing left to play.
	 */
	private sideToMove(): Color {
		var me = this.getUserColor();
		return this.game?.ActivePlayer == 1 ? me : opponent(me);
	}

	/**
	 * Works out whether the player is under attack and whether they have any turn at
	 * all. Only asked at the start of their turn: mid-turn the position is half
	 * played and says nothing useful, since a turn is only judged once it is whole.
	 */
	/**
	 * Deciding whether a turn exists can take a moment on a large multiverse, so the
	 * board is painted first and the verdict follows.
	 */
	private scheduleAssessment() {
		setTimeout(() => {
			if (this.destroyed) { return; }
			this.assess();
		});
	}

	private assess() {
		if (!this.state || !this.game || this.isOver()
			|| !this.isPlayerTurn() || this.pending.length > 0) {
			this.inCheck = false;
			this.searching = false;
			return;
		}

		// A search already running for this very position is left to get on with it.
		// Starting over would mean a long one never got far enough to answer, and the
		// notice that it is still going would blink away with every fresh start.
		if (this.judging != 0 && this.judgingAt == this.game.Moves.length) { return; }

		this.searching = false;
		var me = this.getUserColor();
		this.inCheck = isAttacked(this.state, me, movableAfter(this.state, opponent(me)));
		// Whether a turn exists at all is handed to the worker, which keeps at it for
		// as long as it takes rather than giving up and leaving the game in limbo.
		this.judgingAt = this.game.Moves.length;
		this.judging = this.judgeService.ask(this.game.StartingState, this.game.Moves, me);
		this.noticeSlowSearch(this.judging);
	}

	/**
	 * Nearly every position is settled before the player has finished reading the
	 * board, so the search only announces itself once it has been going a while.
	 */
	private noticeSlowSearch(id: number) {
		setTimeout(() => {
			if (this.destroyed || this.judging != id) { return; }
			this.searching = true;
		}, Game.SEARCH_NOTICE);
	}

	private receiveVerdict(reply: JudgeReply) {
		if (reply.id != this.judging || !this.isPlayerTurn() || this.isOver()) { return; }
		this.judging = 0;
		this.judgingAt = -1;
		this.searching = false;
		if (reply.verdict == Verdict.trapped) {
			// Nothing to play: checkmate if that is because of an attack, otherwise
			// a stalemate, which is a draw. Anything half arranged on the board was
			// never going to become a legal turn, so put it back first.
			this.takeBackTurn();
			this.declareStuck(!this.inCheck);
		}
	}

	/** Returns the board to how it stood when the turn began. */
	private takeBackTurn() {
		if (!this.state || this.applied.length == 0) { return; }
		undoTurn(this.state, this.applied);
		this.applied = [];
		this.pending = [];
		this.promotion = null;
		this.deselect();
		this.refresh();
	}

	private declareStuck(drawn: boolean) {
		if (!this.game || !this.userId) { return; }
		this.subscriptions.add(this.gameService.finish(this.game.Id, this.userId, drawn).subscribe(success => {
			if (!this.game) { return; }
			// The game had already ended by the time the search caught up, so what is
			// on screen is not the game as it stands.
			if (!success) { return this.reportFailure(); }
			this.game.Status = GameStatus.finished;
			this.game.WinnerPlayer = drawn ? null : 2;
			this.stopWatchingIfOver();
		}, error => {
			this.reportFailure();
		}));
	}

	/**
	 * Says that the game did not take what it was sent. Nothing here can put that
	 * right: the board on screen has moved on from the game the server is keeping,
	 * so the only way forward is to fetch it again.
	 */
	private reportFailure() {
		this.error = 'An error occurred. Refresh the page and try again.';
	}

	/**
	 * Zooming in on a board has to happen in two steps. Zoom is a scale transform, so
	 * changing it resizes everything, and where the board ends up is only known once
	 * the pane has been laid out again. So: set the zoom, let it redraw, then let the
	 * browser scroll the board into the middle rather than working the offsets out
	 * ourselves against a scale factor and a header row.
	 */
	private selectBoard(square: Ref) {
		this.zoom = 4;
		this.measureTrailing();
		setTimeout(() => {
			if (this.destroyed) { return; }
			var board = document.querySelector(`[data-board="${square.l}:${square.t}"]`);
			board?.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' });
		});
	}

	private selectSquare(square: Ref) {
		if (!this.state) { return; }
		if (this.selected === null) {
			if (this.canMoveFrom(square)) {
				this.selected = square;
				this.previewing = false;
				this.validTargets = targets(this.state, square);
			} else if (this.canInspect(square)) {
				this.selected = square;
				this.previewing = true;
				this.validTargets = targets(this.state, square);
			}
			return;
		}
		if (sameRef(this.selected, square)) {
			this.deselect();
			return;
		}
		if (!this.validTargets.some(target => sameRef(target, square))) { return; }
		// A preview is there to be read, not acted on.
		if (this.previewing) { return; }

		var move: EngineMove = { from: this.selected, to: square };
		if (this.start !== undefined && promotes(this.state, this.state.at(this.selected), square)) {
			// Hold the move back until the player says what the pawn becomes.
			this.promotion = { move, choices: promotionChoices(this.start, this.getUserColor()) };
			return;
		}
		this.play(move);
	}

	private play(move: EngineMove) {
		if (!this.state) { return; }
		this.applied.push(applyMove(this.state, move));
		this.pending.push(move);
		this.deselect();
		this.refresh();
	}

	/**
	 * A piece can start a move when it belongs to the player, sits on the latest board
	 * of its timeline, and that board is still waiting on the player's move.
	 */
	/**
	 * Whether a piece can be looked at without being moved. While waiting on the
	 * other player, their pieces can be picked up to see where they could go.
	 */
	private canInspect(square: Ref): boolean {
		if (!this.state || this.isPlayerTurn() || this.isOver()) { return false; }
		if (!this.state.isHead(square.l, square.t)) { return false; }
		if (colorToMove(square.t) == this.getUserColor()) { return false; }
		var piece = this.state.at(square);
		return piece !== -1 && Piece.color(piece) != this.getUserColor();
	}

	private canMoveFrom(square: Ref): boolean {
		if (!this.state || !this.isPlayerTurn()) { return false; }
		if (!this.state.isHead(square.l, square.t)) { return false; }
		if (colorToMove(square.t) != this.getUserColor()) { return false; }
		var piece = this.state.at(square);
		return piece !== -1 && Piece.color(piece) == this.getUserColor();
	}
}
