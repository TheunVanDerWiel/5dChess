import { Component, Input, OnDestroy, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { GameState } from 'src/app/types/GameState';
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
			this.subscriptions.add(this.gameService.getGame(this.gameId!, this.userId!).subscribe(game => {
				this.state = game.StartingState;
				game.Moves.forEach(m => this.updateState(m));
			}));
		}));
        
    }

    ngOnDestroy(): void {
        this.subscriptions.unsubscribe();
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
