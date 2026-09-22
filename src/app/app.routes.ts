import { Routes } from '@angular/router';
import { Game } from './controllers/game/game';
import { Home } from './controllers/home/home';
import { Rules } from './controllers/rules/rules';

export const routes: Routes = [
	{ path: '', component: Home },
	{ path: 'game/:gameId', component: Game },
	{ path: 'rules', component: Rules },
];
