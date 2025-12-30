import { Component, Input, OnDestroy, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { GameState, TimeLine, TimeLineOrigin, Board } from 'src/app/types/GameState';
import { Piece } from 'src/app/types/Game';
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
	public move = new Move([]);
	public selectedSquare: BoardReference | null = null;
	public zoom = 4;
	public boardSize = 0;
	public grid = { steps: 0, currentStep: 0 };
	
	private subscriptions = new Subscription();
	private userId: string | null = null;
	
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
			this.gameId = routeParams['gameId'];
			if (!this.gameId) {
				this.router.navigateByUrl('/');
			}

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
			this.state = new GameState([
				new TimeLine(0, [board], undefined)
			]);
			this.reverseState();
			this.initializeState();
			
	        // Load game
			this.subscriptions.add(this.gameService.getGame(this.gameId!, this.userId!).subscribe(game => {
				this.state = game.StartingState;
				if (game.Player == 2) {
					this.reverseState();
				}
				this.initializeState();
				game.Moves.forEach(m => m.Pieces.forEach(p => this.updateState(p)));
			}));
		}));
    }

    ngOnDestroy(): void {
        this.subscriptions.unsubscribe();
    }
	
	public getIcon(piece: Piece, x: number, y: number) {
		var color = Piece.color(piece) == (x+y)%2 ? 'far ' : 'fas ';
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
	
    public select(timeline: number, board: number, x: number, y: number) {
		if (this.zoom < 4) {
			this.selectBoard(timeline, board);
		} else {
			this.selectSquare(timeline, board, x, y);
		}
	}
	
	public confirm() {
		this.move = new Move([]);
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
		this.move.Pieces.splice(this.move.Pieces.length-1, 1);
	}

	public forfeit() {
		
	}

	private initializeState() {
		if (!this.state) { return; }
		this.boardSize = 24*this.state.TimeLines[0].Boards[0].Squares.length+32;
		this.grid.steps = Math.max(...this.state.TimeLines.map(t => t.Boards.length));
		this.determineActiveStep();
	}
	
	private determineActiveStep() {
		
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
			if (this.state.TimeLines[timeline].Boards[board].Squares[x][y] !== null) {
				this.selectedSquare = new BoardReference(timeline, board, x, y);
			}
		} else {
			this.move.Pieces.push(new BoardMove(this.selectedSquare, new BoardReference(timeline, board, x, y)));
			this.updateState(this.move.Pieces[this.move.Pieces.length-1]);
			this.selectedSquare = null;
		}
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
