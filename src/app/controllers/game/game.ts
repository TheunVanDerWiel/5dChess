import { Component, Input, OnDestroy, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { GameState, Split, Board } from 'src/app/types/GameState';
import { Piece } from 'src/app/types/Game';
import { LocalStorageService } from 'src/app/services/local-storage-service';
import { GameService } from 'src/app/services/game-service';
import { BoardReference, Move } from 'src/app/types/Move';

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
	public unconfirmedState: GameState | null = null;
	public selectedSquare: BoardReference | null = null;
	
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
			
	        // Load game
			this.state = new GameState([[null, new Split(1), new Board([])],[new Board([[Piece.white_rook,Piece.white_knight,Piece.white_bishop,Piece.white_queen,Piece.white_king,Piece.white_bishop,Piece.white_knight,Piece.white_rook],[Piece.white_pawn,Piece.white_pawn,Piece.white_pawn,Piece.white_pawn,Piece.white_pawn,Piece.white_pawn,Piece.white_pawn,Piece.white_pawn],[],[],[],[],[],[]]), new Board([]), new Board([])]])
			this.subscriptions.add(this.gameService.getGame(this.gameId!, this.userId!).subscribe(game => {
				this.state = game.StartingState;
				game.Moves.forEach(m => this.updateState(m));
			}));
		}));
        
    }

    ngOnDestroy(): void {
        this.subscriptions.unsubscribe();
    }
	
	public castBoard(board: any): Board {
		return board as Board;
	}
	
	public getIcon(piece: Piece) {
		var color = Piece.color(piece) == 0 ? 'fa-regular ' : 'fa-solid ';
		switch (Piece.type(piece)) {
			case Piece.white_pawn:
				return color+'fa-chess-pawn';
			case Piece.white_rook:
				return color+'fa-chess-rook';
			case Piece.white_knight:
				return color+'fa-chess-knight';
			case Piece.white_bishop:
				return color+'fa-chess-bishop';
			case Piece.white_queen:
				return color+'fa-chess-queen';
			case Piece.white_king:
				return color+'fa-chess-king';
		}
		return "";
	}
    
    public select(timeline: number, board: number, x: number, y: number) {
		
	}
	
	public confirm() {
		
	}
	
	public undo() {
		
	}

	public forfeit() {
		
	}
    
    private updateState(move: Move) {
		
	}
}
