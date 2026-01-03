import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { GameState, TimeLine, TimeLineOrigin, Board } from 'src/app/types/GameState';
import { Piece, Color } from 'src/app/types/Game';
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
	public gameId: number | undefined;
	public state: GameState | undefined;
	public moves: Move[] = [];
	public move = new Move([]);
	public selectedSquare: BoardReference | null = null;
	public validTargetSquares: BoardReference[] = [];
	public zoom = 4;
	public boardSize = 0;
	public grid = { steps: 0, currentStep: 0 };
	public user: { id: string | null, color: Color } = { id: null, color: Color.black };
	
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
        this.user.id = this.localStorage.getItem('userId');
        if (this.user.id === null) {
			this.router.navigateByUrl('/');
		}
		this.subscriptions.add(this.route.params.subscribe(routeParams => {
			this.gameId = routeParams['gameId'];
			if (!this.gameId) {
				this.router.navigateByUrl('/');
			}

	        // Load game
			this.subscriptions.add(this.gameService.getGame(this.gameId!, this.user.id!).subscribe(game => {
				this.state = game.StartingState;
				this.moves = game.Moves;
				if (game.StartingPlayer == 1) {
					this.user.color = Color.white;
				} else {
					this.reverseState();
				}
				this.initializeState();
				this.moves.forEach(m => m.Pieces.forEach(p => this.updateState(p)));
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
	
	public isPlayerTurn(): boolean {
		return this.moves.length%2 == (1-this.user.color);
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
		if (!this.isMoveComplete()) { return; }
		// TODO send to server/other player
		this.moves.push(this.move);
		this.move = new Move([]);
		this.determineActiveStep();
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
		// TODO take timeline count diff into account, ignoring surplus timelines
		this.grid.currentStep = Math.min(...this.state.TimeLines.map(t => t.Boards.length + (t.Origin?.Time || 0) - 1));
		if (this.grid.currentStep%2 == this.user.color) {
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
				if (piece !== null && Piece.color(piece) == this.user.color) {
					this.move.Pieces.push(new BoardMove(this.selectedSquare, new BoardReference(timeline, board, x, y)));
					this.updateState(this.move.Pieces[this.move.Pieces.length-1]);
					this.selectedSquare = null;
					this.determineActiveStep();
				}
			}
		}
	}
	
	private isBoardActive(timeline: number, board: number): boolean {
		if (!this.state) { return false; }
		// Board must be the last board of the timeline & the last turn wasn't by the player
		return board == this.state.TimeLines[timeline].Boards.length-1
			&& ((this.state.TimeLines[timeline].Origin?.Time ?? 0) + this.state.TimeLines[timeline].Boards.length)%2 == this.user.color;
	}
	
	private determineValidTargetSquares() {
		this.validTargetSquares = [];
		if (!this.state || !this.selectedSquare) { return; }
		var piece = this.state.TimeLines[this.selectedSquare.TimeLine].Boards[this.selectedSquare.Board].Squares[this.selectedSquare.X][this.selectedSquare.Y];
		if (piece === null) { return; }
		switch (Piece.type(piece)) {
			case Piece.black_pawn:
				var direction = Piece.color(piece) == this.user.color ? -1 : 1;
				this.repeatMovesUntilBlocked([[[direction,0,0,0],[0,0,direction,0]]],
					this.isStartingPosition(this.selectedSquare) ? 2 : 1,
					false);
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
				break;
			case Piece.black_brawn:
				var direction = Piece.color(piece) == this.user.color ? -1 : 1;
				this.repeatMovesUntilBlocked([[[direction,0,0,0],[0,0,direction,0]]],
					this.isStartingPosition(this.selectedSquare) ? 2 : 1,
					false);
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
		return true;
	}
    
    private updateState(move: BoardMove) {
		if (!this.state) { return; }
		if (move.FromLocation.TimeLine == move.ToLocation.TimeLine && move.FromLocation.Board == move.ToLocation.Board) {
			// Move on the same board
			this.addBoardClone(this.state.TimeLines[move.FromLocation.TimeLine]);
		} else {
			// Move from one board to another
			if (move.FromLocation.TimeLine == move.ToLocation.TimeLine) {
				// Timetravel move
				var index = 0; // TODO determine if it should be added at the front or the back
				var board = this.state.TimeLines[move.ToLocation.TimeLine].Boards[move.ToLocation.Board];
				this.state.TimeLines.splice(index, 0, new TimeLine(
					this.state.TimeLines[index].Index+(index == 0 ? -1 : 1), 
					[JSON.parse(JSON.stringify(board))], 
					new TimeLineOrigin(move.ToLocation.Board+1, move.ToLocation.TimeLine)));
				move = new BoardMove(
					new BoardReference(move.FromLocation.TimeLine+(move.FromLocation.TimeLine < index ? 0 : 1), move.FromLocation.Board, move.FromLocation.X, move.FromLocation.Y), 
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
