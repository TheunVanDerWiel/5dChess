import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UserService } from 'src/app/services/user-service';
import { GameService } from 'src/app/services/game-service';
import { Router } from '@angular/router';
import { LocalStorageService } from 'src/app/services/local-storage-service';

@Component({
	selector: 'app-home',
	imports: [
		CommonModule,
		FormsModule
	],
	templateUrl: './home.html',
	styleUrl: './home.less',
})
export class Home implements OnInit {
	public userKnown: boolean | undefined;
	public mode: number | undefined;
	public gameId: number | undefined;
	public typeId: number | undefined;

	public MODE_NEW = 1;
	public MODE_JOIN = 2;
	public GAME_TYPES = [
		{ id: 0, name: 'Random' },
		{ id: 1, name: 'Standard', recommended: true },
		{ id: 10, parent: 1, name: 'Regular', recommended: true },
		{ id: 11, parent: 1, name: 'Half Reflected' },
		{ id: 12, parent: 1, name: 'Defended Pawn' },
		{ id: 13, parent: 1, name: 'Princess' },
		{ id: 14, parent: 1, name: 'Turn Zero' },
		{ id: 15, parent: 1, name: 'Two Timelines' },
		{ id: 16, parent: 1, name: 'Reversed Royalty' },
		{ id: 2, name: 'Simple', recommended: true },
		{ id: 20, parent: 2, name: 'No Bishops', recommended: true },
		{ id: 21, parent: 2, name: 'No Knights' },
		{ id: 22, parent: 2, name: 'No Rooks' },
		{ id: 23, parent: 2, name: 'No Queens' },
		{ id: 24, parent: 2, name: 'Knights vs. Bishops' },
		{ id: 25, parent: 2, name: 'Simple Set' },
		{ id: 3, name: 'Small' },
		{ id: 30, parent: 3, name: 'Regular' },
		{ id: 31, parent: 3, name: 'Flipped' },
		{ id: 32, parent: 3, name: 'Centered' },
		{ id: 33, parent: 3, name: 'Open' },
		{ id: 4, name: 'Very small' },
		{ id: 40, parent: 4, name: 'Regular' },
		{ id: 41, parent: 4, name: 'Open' },
		{ id: 5, name: 'Misc', recommended: true },
		{ id: 50, parent: 5, name: 'Invasions', recommended: true },
		{ id: 51, parent: 5, name: 'Formations' },
		{ id: 52, parent: 5, name: 'Tactician' },
		{ id: 53, parent: 5, name: 'Strategos' },
		{ id: 54, parent: 5, name: 'Battleground' },
		{ id: 55, parent: 5, name: 'Skirmish' },
		{ id: 56, parent: 5, name: 'Fragments' },
		{ id: 57, parent: 5, name: 'Marauders' },
		{ id: 6, name: 'Special' },
		{ id: 60, parent: 6, name: 'Excessive' },
		{ id: 61, parent: 6, name: 'Global Warming' },
		{ id: 62, parent: 6, name: 'King of Kings' },
		{ id: 63, parent: 6, name: 'Royal Queen Showdown' },
		{ id: 7, name: 'Focussed' },
		{ id: 70, parent: 7, name: 'Knights' },
		{ id: 71, parent: 7, name: 'Bishops' },
		{ id: 72, parent: 7, name: 'Rooks' },
		{ id: 73, parent: 7, name: 'Queens' },
		{ id: 74, parent: 7, name: 'Pawns' },
		{ id: 75, parent: 7, name: 'Kings' },
		{ id: 76, parent: 7, name: 'Unicorns' },
		{ id: 77, parent: 7, name: 'Dragons' },
		{ id: 78, parent: 7, name: 'Brawns' }
	];
	
	private router = inject(Router);
	private localStorage = inject(LocalStorageService);
	private userService = inject(UserService);
	private gameService = inject(GameService);

	ngOnInit(): void {
		var userId = this.localStorage.getItem('userId');
		if (userId === null) {
			userId = '';
			var characters = '0123456789abcdefghijklmnopqrstuvwxyz', charChoices = characters.length;
			for (var i = 0; i < 64; i++) {
				userId += characters.charAt(Math.floor(Math.random()*charChoices));
			}
			this.localStorage.setItem('userId', userId);
			userId = this.localStorage.getItem('userId');
		}
		this.userKnown = userId !== null;
	}
	
	public start(typeId: number) {
		if (this.GAME_TYPES.filter(t => t.parent == typeId).length > 0) {
			this.typeId = typeId;
			return;
		}
	}
	
	public join() {
		this.router.navigateByUrl("/game/"+this.gameId);
	}
}
