import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { Home } from './home';
import { GameService } from 'src/app/services/game-service';
import { LocalStorageService } from 'src/app/services/local-storage-service';

/** Local storage as a browser that keeps things, or as one that refuses to. */
function storageStub(keeps: boolean) {
	var kept: { [key: string]: string } = {};
	return {
		getItem: (key: string) => kept[key] ?? null,
		setItem: (key: string, value: string) => { if (keeps) { kept[key] = value; } }
	};
}

describe('Home', () => {
	let component: Home;
	let fixture: ComponentFixture<Home>;
	let navigations: { commands: any[], extras: any }[];
	let joined: number[];
	/** Whether the server turns joining down, as it does for the game's own creator. */
	let refuseJoin = false;
	var joinStub = (gameId: number, userId: string) => {
		joined.push(gameId);
		return refuseJoin ? throwError(() => new Error('unauthorized')) : of(true);
	};

	/** Builds the page with a given query string and a given kind of browser. */
	async function setUp(params: { [key: string]: string }, keeps = true) {
		navigations = [];
		joined = [];
		await TestBed.configureTestingModule({
			imports: [Home],
			providers: [
				provideRouter([]),
				{ provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(params) } } },
				{ provide: LocalStorageService, useValue: storageStub(keeps) },
				{ provide: GameService, useValue: { getGames: () => of([]), join: joinStub } }
			]
		}).compileComponents();

		var router = TestBed.inject(Router);
		router.navigate = (commands: any[], extras: any) => {
			navigations.push({ commands: commands, extras: extras });
			return Promise.resolve(true);
		};

		fixture = TestBed.createComponent(Home);
		component = fixture.componentInstance;
		fixture.detectChanges();
		await fixture.whenStable();
	}

	afterEach(() => {
		refuseJoin = false;
		TestBed.resetTestingModule();
	});

	it('should create', async () => {
		await setUp({});
		expect(component).toBeTruthy();
	});

	it('makes up an id when the browser has none yet', async () => {
		await setUp({});
		expect(component.savedUserId).toHaveLength(64);
	});

	it('takes the id out of the address bar over anything stored', async () => {
		await setUp({ userId: 'from-a-scanned-code' });
		expect(component.savedUserId).toBe('from-a-scanned-code');
		expect(component.unstored).toBe(false);
	});

	it('clears the address bar once the id is safely stored', async () => {
		await setUp({ userId: 'from-a-scanned-code' });
		expect(navigations.at(-1)!.extras.queryParams).toEqual({});
	});

	it('keeps the id in the address bar when the browser will not store it', async () => {
		await setUp({}, false);
		expect(component.unstored).toBe(true);
		expect(navigations.at(-1)!.extras.queryParams).toEqual({ userId: component.savedUserId });
	});

	it('carries the id into a game while the address bar is holding it', async () => {
		await setUp({}, false);
		component.resume(7);
		expect(navigations.at(-1)!.commands).toEqual(['/game', 7]);
		expect(navigations.at(-1)!.extras.queryParams).toEqual({ userId: component.savedUserId });
	});

	it('leaves the id out of a game link when the browser is holding it', async () => {
		await setUp({}, true);
		component.resume(7);
		expect(navigations.at(-1)!.commands).toEqual(['/game', 7]);
		expect(navigations.at(-1)!.extras.queryParams).toEqual({});
	});

	it('joins and opens the game a shared link invites to', async () => {
		await setUp({ join: '42' });
		expect(joined).toEqual([42]);
		expect(navigations.at(-1)!.commands).toEqual(['/game', 42]);
	});

	it('opens the game anyway when joining is refused', async () => {
		refuseJoin = true;
		await setUp({ join: '42' });
		expect(navigations.at(-1)!.commands).toEqual(['/game', 42]);
	});

	it('ignores an invitation that names no game', async () => {
		await setUp({ join: 'nonsense' });
		expect(joined).toEqual([]);
	});

	it('builds a crossplay link that carries the saved id', async () => {
		await setUp({ userId: 'shared-id' });
		expect(component.crossplayUrl()).toBe(
			window.location.origin + window.location.pathname + '?userId=shared-id');
	});
});
