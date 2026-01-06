import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { GameState, TimeLine, TimeLineOrigin, Board } from 'src/app/types/GameState';
import { Game as GameType, Piece, Color } from 'src/app/types/Game';
import { LocalStorageService } from 'src/app/services/local-storage-service';
import { GameService } from 'src/app/services/game-service';
import { BoardReference, Move, BoardMove } from 'src/app/types/Move';

@Component({
	selector: 'app-game',
	imports: [
		RouterLink,
		CommonModule
	],
	templateUrl: './game.html',
	styleUrl: './game.less',
})
export class Game implements OnInit, OnDestroy {
	public showMenu = false;
	public state: GameState | undefined;
	public game: GameType | undefined;
	public move = new Move([]);
	public selectedSquare: BoardReference | null = null;
	public validTargetSquares: BoardReference[] = [];
	public zoom = 4;
	public boardSize = 0;
	public grid = { steps: 0, currentStep: 0 };
	public userId: string | null = null;
	
	private subscriptions = new Subscription();
	private moveMatrix = [
		// Possible moves in 1, 2, 3, and 4 dimensions
		[[-1,0,0,0],[1,0,0,0],[0,-2,0,0],[0,0,-1,0],[0,0,1,0],[0,0,0,-1],[0,0,0,1]],
		[[-1,-2,0,0],[-1,2,0,0],[-1,0,-1,0],[-1,0,1,0],[-1,0,0,-1],[-1,0,0,1],[1,-2,0,0],[1,2,0,0],[1,0,-1,0],[1,0,1,0],[1,0,0,-1],[1,0,0,1],[0,-2,-1,0],[0,-2,1,0],[0,-2,0,-1],[0,-2,0,1],[0,0,-1,-1],[0,0,-1,1],[0,0,1,-1],[0,0,1,1]],
		[[-1,-2,-1,0],[-1,-2,1,0],[-1,-2,0,-1],[-1,-2,0,1],[-1,2,-1,0],[-1,2,1,0],[-1,2,0,-1],[-1,2,0,1],[-1,0,-1,-1],[-1,0,-1,1],[-1,0,1,-1],[-1,0,1,1],[1,-2,-1,0],[1,-2,1,0],[1,-2,0,-1],[1,-2,0,1],[1,2,-1,0],[1,2,1,0],[1,2,0,-1],[1,2,0,1],[1,0,-1,-1],[1,0,-1,1],[1,0,1,-1],[1,0,1,1]],
		[[-1,-2,-1,-1],[-1,-2,-1,1],[-1,-2,1,-1],[-1,-2,1,1],[-1,2,-1,-1],[-1,2,-1,1],[-1,2,1,-1],[-1,2,1,1],[1,-2,-1,-1],[1,-2,-1,1],[1,-2,1,-1],[1,-2,1,1],[1,2,-1,-1],[1,2,-1,1],[1,2,1,-1],[1,2,1,1]]
	];
	
	private router = inject(Router);
	private route = inject(ActivatedRoute);
	private gameService = inject(GameService);
	private localStorage = inject(LocalStorageService);
    
    ngOnInit(): void {
        // Check if user is a player of the game
        this.userId = this.localStorage.getItem('userId');
        if (this.userId === null) {
			this.router.navigateByUrl('/');
		}
		this.subscriptions.add(this.route.params.subscribe(routeParams => {
			var gameId = routeParams['gameId'];
			if (!gameId) {
				this.router.navigateByUrl('/');
			}

	        // Load game
			this.subscriptions.add(this.gameService.getGame(gameId, this.userId!).subscribe(game => {
				this.state = JSON.parse(JSON.stringify(game.StartingState));
				this.game = game;
				if (this.getUserColor() == Color.black) {
					this.reverseState();
				}
				this.initializeState();
				game.Moves.forEach(m => m.Pieces.forEach(p => this.updateState(p)));
			}, error => {
				this.router.navigateByUrl('/');
			}));
		}));
    }

    ngOnDestroy(): void {
        this.subscriptions.unsubscribe();
    }
	
	public getIcon(piece: Piece, x: number, y: number): string {
		var color = Piece.color(piece) == 1-(x+y)%2 ? 'far ' : 'fas ';
		switch (Piece.type(piece)) {
			case Piece.black_pawn:
				return color+'fa-chess-pawn';
			case Piece.black_rook:
				return color+'fa-chess-rook';
			case Piece.black_knight:
				return color+'fa-chess-knight';
			case Piece.black_bishop:
				return color+'fa-chess-bishop';
			case Piece.black_queen:
				return color+'fa-chess-queen';
			case Piece.black_king:
				return color+'fa-chess-king';
		}
		return "fa-empty";
	}
	
	public getHighlight(timeline: number, board: number, x: number, y: number): string {
		if (this.selectedSquare !== null) {
			if (BoardReference.equals(this.selectedSquare, timeline, board, x, y)) {
				return "border-selected";
			}
			if (BoardReference.contains(this.validTargetSquares, timeline, board, x, y)) {
				return "border-selectable";
			}
		}
		return "";
	}
	
	public getUserColor(): Color {
		return this.game?.StartingPlayer == 1 ? Color.white : Color.black;
	}
	
	public isPlayerTurn(): boolean {
		if (!this.game) { return false; }
		return this.game.ActivePlayer == 1;
	}
	
    public select(timeline: number, board: number, x: number, y: number) {
		if (this.zoom < 4) {
			this.selectBoard(timeline, board);
		} else {
			this.selectSquare(timeline, board, x, y);
		}
	}
	
	public deselect() {
		this.selectedSquare = null;
	}
	
	public isMoveComplete(): boolean {
		if (!this.state) { return false; }
		// Check all active boards have a move
		for (var i = 0; i < this.state.TimeLines.length; i++) {
			if (this.state.TimeLines[i].Boards.length + (this.state.TimeLines[i].Origin?.Time || 0) <= this.grid.currentStep+1) {
				return false;
			}
		}
		return true;
	}
	
	public confirm() {
		if (!this.game || !this.userId || !this.isMoveComplete()) { return; }
		this.subscriptions.add(this.gameService.confirmMove(this.game.Id, this.userId, this.move).subscribe(success => {
			if (!this.game) { return; }
			this.game.Moves.push(this.move);
			this.game.ActivePlayer = 3-this.game.ActivePlayer;
			this.move = new Move([]);
			this.determineActiveStep();
		}, error => {
			// TODO error handling
		}));
	}
	
	public undo() {
		if (!this.state) { return; }
		if (this.move.Pieces.length == 0) { return; }
		var move = this.move.Pieces[this.move.Pieces.length-1];
		if (move.FromLocation.TimeLine == move.ToLocation.TimeLine && move.FromLocation.Board == move.ToLocation.Board) {
			// Move on the same board
			this.state.TimeLines[move.FromLocation.TimeLine].Boards.splice(this.state.TimeLines[move.FromLocation.TimeLine].Boards.length-1, 1);
		} else {
			// Move from one board to another
			this.state.TimeLines[move.FromLocation.TimeLine].Boards.splice(this.state.TimeLines[move.FromLocation.TimeLine].Boards.length-1, 1);
			this.state.TimeLines[move.ToLocation.TimeLine].Boards.splice(this.state.TimeLines[move.ToLocation.TimeLine].Boards.length-1, 1);
			if (this.state.TimeLines[move.ToLocation.TimeLine].Boards.length == 0) {
				// This was the originating move on the timeline; remove it
				this.state.TimeLines.splice(move.ToLocation.TimeLine, 1);
			}
		}
		this.selectedSquare = null;
		this.move.Pieces.splice(this.move.Pieces.length-1, 1);
		this.determineActiveStep();
	}

	public forfeit() {
		
	}

	private initializeState() {
		if (!this.state) { return; }
		this.boardSize = 24*this.state.TimeLines[0].Boards[0].Squares.length+32;
		this.determineActiveStep();
	}
	
	private determineActiveStep() {
		if (!this.state) { return; }
		this.grid.steps = Math.max(...this.state.TimeLines.map(t => t.Boards.length));
		
		// Take timeline count diff into account, ignoring surplus timelines
		var timelines = this.state.TimeLines;
		var diff = timelines[timelines.length-1].Index + timelines[0].Index;
		if (diff < -1) {
			timelines = timelines.splice(0, (diff*-1)-1);
		} else if (diff > 1) {
			timelines = timelines.splice(timelines.length-diff, diff-1);
		}
		
		this.grid.currentStep = Math.min(...timelines.map(t => t.Boards.length + (t.Origin?.Time || 0) - 1));
		if (this.grid.currentStep%2 == this.getUserColor()) {
			this.grid.currentStep--;
		}
	}

	private reverseState() {
		if (!this.state) { return; }
		this.state.TimeLines.reverse();
		this.state.TimeLines.forEach(t => {
			if (!!t.Origin) {
				t.Origin.Origin *= -1;
			}
			t.Boards.forEach(b => {
				b.Squares.reverse();
				b.Squares.forEach(r => r.reverse());
			});
		});
	}

	private selectBoard(timeline: number, board: number) {
		this.zoom = 4;
		var el = document.querySelector('.content');
		if (!!el) {
			el.scrollTo({ top: timeline*this.boardSize, left: board*this.boardSize});
		}
	}

	private selectSquare(timeline: number, board: number, x: number, y: number) {
		if (!this.state) { return; }
		if (this.selectedSquare == null) {
			if (this.isBoardActive(timeline, board) && this.state.TimeLines[timeline].Boards[board].Squares[x][y] !== null) {
				this.selectedSquare = new BoardReference(timeline, board, x, y);
				this.determineValidTargetSquares();
			}
		} else {
			if (BoardReference.equals(this.selectedSquare, timeline, board, x, y)) {
				this.deselect();
			} else if (BoardReference.contains(this.validTargetSquares, timeline, board, x, y)) {
				var piece = this.getPieceAt(this.selectedSquare);
				if (piece !== null && Piece.color(piece) != this.getUserColor()) {
					this.move.Pieces.push(new BoardMove(this.selectedSquare, new BoardReference(timeline, board, x, y)));
					this.updateState(this.move.Pieces[this.move.Pieces.length-1]);
					this.selectedSquare = null;
					this.determineActiveStep();
				}
			}
		}
	}
	
	private isBoardActive(timeline: number, board: number): boolean {
		if (!this.state || !this.game) { return false; }
		// Board must be the last board of the timeline & the last turn wasn't by the player
		return board == this.state.TimeLines[timeline].Boards.length-1
			&& ((this.state.TimeLines[timeline].Origin?.Time ?? 0) + this.state.TimeLines[timeline].Boards.length)%2 != this.getUserColor();
	}
	
	private determineValidTargetSquares() {
		this.validTargetSquares = [];
		if (!this.state || !this.selectedSquare) { return; }
		var piece = this.state.TimeLines[this.selectedSquare.TimeLine].Boards[this.selectedSquare.Board].Squares[this.selectedSquare.X][this.selectedSquare.Y];
		if (piece === null) { return; }
		switch (Piece.type(piece)) {
			case Piece.black_pawn:
				var direction = Piece.color(piece) == this.getUserColor() ? -1 : 1;
				this.repeatMovesUntilBlocked([[[direction,0,0,0],[0,0,direction,0]]], this.isStartingPosition(this.selectedSquare) ? 2 : 1, false);
				this.repeatMovesUntilBlocked([[[direction,-2,0,0],[direction,2,0,0],[0,0,direction,-1],[0,0,direction,1]]], 1, true);
				break;
			case Piece.black_rook:
				this.repeatMovesUntilBlocked([this.moveMatrix[0]]);
				break;
			case Piece.black_knight:
				this.repeatMovesUntilBlocked([
					[[-2,-2,0,0],[-2,2,0,0],[-2,0,-1,0],[-2,0,1,0],[-2,0,0,-1],[-2,0,0,1],[2,-2,0,0],[2,2,0,0],[2,0,-1,0],[2,0,1,0],[2,0,0,-1],[2,0,0,1]],
					[[-1,-4,0,0],[1,-4,0,0],[0,-4,-1,0],[0,-4,1,0],[0,-4,0,-1],[0,-4,0,1],[-1,4,0,0],[1,4,0,0],[0,4,-1,0],[0,4,1,0],[0,4,0,-1],[0,4,0,1]],
					[[-1,0,-2,0],[1,0,-2,0],[0,-2,-2,0],[0,2,-2,0],[0,0,-2,-1],[0,0,-2,1],[-1,0,2,0],[1,0,2,0],[0,-2,2,0],[0,2,2,0],[0,0,2,-1],[0,0,2,1]],
					[[-1,0,0,-2],[1,0,0,-2],[0,-2,0,-2],[0,2,0,-2],[0,0,-1,-2],[0,0,1,-2],[-1,0,0,2],[1,0,0,2],[0,-2,0,2],[0,2,0,2],[0,0,-1,2],[0,0,1,2]]
				], 1);
				break;
			case Piece.black_bishop:
				this.repeatMovesUntilBlocked([this.moveMatrix[1]]);
				break;
			case Piece.black_queen:
				this.repeatMovesUntilBlocked(this.moveMatrix);
				break;
			case Piece.black_king:
				this.repeatMovesUntilBlocked(this.moveMatrix, 1);
				// TODO castling
				break;
			case Piece.black_brawn:
				var direction = Piece.color(piece) == this.getUserColor() ? -1 : 1;
				this.repeatMovesUntilBlocked([[[direction,0,0,0],[0,0,direction,0]]], this.isStartingPosition(this.selectedSquare) ? 2 : 1, false);
				this.repeatMovesUntilBlocked([[[direction,-2,0,0],[direction,2,0,0],[direction,0,0,-1],[direction,0,0,1],[0,-2,direction,0],[0,2,direction,0],[0,0,direction,-1],[0,0,direction,1]]], 1, true);
				break;
			case Piece.black_unicorn:
				this.repeatMovesUntilBlocked([this.moveMatrix[2]]);
				break;
			case Piece.black_dragon:
				this.repeatMovesUntilBlocked([this.moveMatrix[3]]);
				break;
			case Piece.black_princess:
				this.repeatMovesUntilBlocked([this.moveMatrix[0],this.moveMatrix[1]]);
				break;
			case Piece.black_royal_queen:
				this.repeatMovesUntilBlocked(this.moveMatrix);
				break;
			case Piece.black_common_king:
				this.repeatMovesUntilBlocked(this.moveMatrix, 1);
				break;
			default: break;
		}
	}
	
	private repeatMovesUntilBlocked(moves: number[][][], maxDistance = -1, ifIsCapture: boolean | null = null) {
		if (!this.selectedSquare) { return; }
		var piece = this.getPieceAt(this.selectedSquare);
		if (piece === null) { return; }
		var color = Piece.color(piece);
		for (var i = 0; i < moves.length; i++) {
			for (var j = 0; j < moves[i].length; j++) {
				var distance = 1, blocked = false;
				while (!blocked) {
					var target = this.offsetBoardReference(this.selectedSquare, moves[i][j], distance);
					if (target === undefined) {
						blocked = true;
					} else {
						var targetPiece = this.getPieceAt(target);
						if ((ifIsCapture !== true && targetPiece === null) || (ifIsCapture !== false && targetPiece !== null && Piece.color(targetPiece) != color)) {
							this.validTargetSquares.push(target);
						}
						if (targetPiece !== null || (maxDistance > 0 && distance++ >= maxDistance)) {
							blocked = true;
						}
					}
				}
			}
		}
	}
	
	private offsetBoardReference(origin: BoardReference, direction: number[], distance: number): BoardReference | undefined {
		var timeline = origin.TimeLine + distance * direction[0];
		if (!this.state || timeline < 0 || timeline >= this.state.TimeLines.length) { return undefined; }
		var board = origin.Board + (this.state.TimeLines[origin.TimeLine].Origin?.Time ?? 0) + (distance * direction[1]) - (this.state.TimeLines[timeline].Origin?.Time ?? 0);
		if (board < 0 || board >= this.state.TimeLines[timeline].Boards.length) { return undefined; }
		var x = origin.X + distance * direction[2], y = origin.Y + distance * direction[3],
			numSquares = this.state.TimeLines[timeline].Boards[board].Squares.length;
		if (x < 0 || x >= numSquares || y < 0 || y >= numSquares) { return undefined; }
		return new BoardReference(timeline, board, x, y);
	}
	
	private getPieceAt(origin: BoardReference): Piece | null {
		return this.state?.TimeLines[origin.TimeLine]?.Boards[origin.Board]?.Squares[origin.X][origin.Y] ?? null;
	}
	
	private isStartingPosition(position: BoardReference): boolean {
		if (!this.state) { return false; }
		var timeline = position.TimeLine, board = position.Board, piece = this.getPieceAt(position);
		while (board >= 0 || this.state.TimeLines[timeline].Origin !== undefined) {
			if (this.getPieceAt(new BoardReference(timeline, board, position.X, position.Y)) !== piece) {
				return false;
			}
			board -= 2;
			while (board < 0 && this.state.TimeLines[timeline].Origin !== undefined) {
				board += this.state.TimeLines[timeline].Origin!.Time;
				timeline += this.state.TimeLines[timeline].Origin!.Origin;
				board -= (this.state.TimeLines[timeline].Origin?.Time ?? 0);
			}
		}
		return true;
	}
    
    private updateState(move: BoardMove) {
		// TODO en passant capturing
		// TODO castling
		if (!this.state) { return; }
		if (move.FromLocation.TimeLine == move.ToLocation.TimeLine && move.FromLocation.Board == move.ToLocation.Board) {
			// Move on the same board
			this.addBoardClone(this.state.TimeLines[move.FromLocation.TimeLine]);
		} else {
			// Move from one board to another
			if (move.FromLocation.TimeLine == move.ToLocation.TimeLine) {
				// Timetravel move
				var index = this.isPlayerTurn() ? 0 : this.state.TimeLines.length;
				var board = this.state.TimeLines[move.ToLocation.TimeLine].Boards[move.ToLocation.Board];
				this.state.TimeLines.splice(index, 0, new TimeLine(
					index == 0 ? this.state.TimeLines[0].Index-1 : this.state.TimeLines[this.state.TimeLines.length-1].Index+1, 
					[JSON.parse(JSON.stringify(board))], 
					new TimeLineOrigin(move.ToLocation.Board+1, index == 0 ? move.ToLocation.TimeLine+1 : move.ToLocation.TimeLine*-1)));
				move = new BoardMove(
					new BoardReference(move.FromLocation.TimeLine+(index == 0 ? 1 : 0), move.FromLocation.Board, move.FromLocation.X, move.FromLocation.Y), 
					new BoardReference(index, -1, move.ToLocation.X, move.ToLocation.Y));
				this.addBoardClone(this.state.TimeLines[move.FromLocation.TimeLine]);
			} else {
				// Multiverse move
				this.addBoardClone(this.state.TimeLines[move.FromLocation.TimeLine]);
				this.addBoardClone(this.state.TimeLines[move.ToLocation.TimeLine]);
			}
		}
		// Set the moved piece to the new location
		this.state.TimeLines[move.ToLocation.TimeLine].Boards[move.ToLocation.Board+1].Squares[move.ToLocation.X][move.ToLocation.Y] = this.state.TimeLines[move.FromLocation.TimeLine].Boards[move.FromLocation.Board+1].Squares[move.FromLocation.X][move.FromLocation.Y];
		// Empty the old location
		this.state.TimeLines[move.FromLocation.TimeLine].Boards[move.FromLocation.Board+1].Squares[move.FromLocation.X][move.FromLocation.Y] = null
	}
	
	private addBoardClone(timeline: TimeLine) {
		timeline.Boards.push(JSON.parse(JSON.stringify(timeline.Boards[timeline.Boards.length-1])));
		this.grid.steps = Math.max(this.grid.steps, (timeline.Origin?.Time || 0)+timeline.Boards.length);
	}
}
