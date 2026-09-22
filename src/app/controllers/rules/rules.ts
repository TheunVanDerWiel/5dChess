import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CaptureMode, TIME_STEP, rulesFor } from 'src/app/engine/geometry';
import { Color, Piece, pieceName } from 'src/app/engine/piece';
import { PieceSprite, getPieceIcon } from 'src/app/components/piece-sprite/piece-sprite';
import { USER_ID_PARAM } from 'src/app/services/user-id';

/** Squares along each side of a diagram board. */
const SIZE = 5;

/** Where the moving piece stands on its board. */
const CENTRE = 2;

/** How far a sliding piece is followed; far enough to leave every diagram board. */
const REACH = SIZE;

/** Timelines shown, relative to the piece's own. */
const LINES = [-1, 0, 1];

/** Turns shown, relative to the present. The timelines are drawn level, so none has a board ahead of it. */
const TURNS = [-2, -1, 0];

interface DiagramSquare {
	x: number;
	y: number;
	/** Empty, or a highlight class for a square the piece can reach. */
	mark: string;
}

interface DiagramBoard {
	l: number;
	t: number;
	home: boolean;
	rows: DiagramSquare[][];
}

interface PieceInfo {
	type: Piece;
	name: string;
	summary: string;
	details: string[];
	diagram: DiagramBoard[][];
}

/**
 * Every square a white piece standing in the middle of the present board can reach
 * across a small slice of an otherwise empty multiverse, laid out as timelines by
 * turns. Derived from the engine's own movement rules so the two never disagree.
 */
function buildDiagram(type: Piece): DiagramBoard[][] {
	var marks = new Map<string, string>();
	var piece = Piece.of(type, Color.white);
	for (const rule of rulesFor(piece)) {
		var limit = rule.maxDistance === 0 ? REACH : rule.maxDistance;
		for (const [dl, dt, dx, dy] of rule.directions) {
			for (let distance = 1; distance <= limit; distance++) {
				var key = [dl * distance, dt * distance / TIME_STEP, CENTRE + dx * distance, CENTRE + dy * distance].join(':');
				var mark = rule.capture === CaptureMode.only ? 'mark-capture' : rule.capture === CaptureMode.never ? 'mark-quiet' : 'mark-move';
				// A square reached both ways, only moving and only capturing, allows either.
				var known = marks.get(key);
				marks.set(key, known === undefined || known === mark ? mark : 'mark-move');
			}
		}
	}
	return LINES.map(l => TURNS.map(t => ({
		l: l,
		t: t,
		home: l == 0 && t == 0,
		rows: Array.from({ length: SIZE }, (_, x) => Array.from({ length: SIZE }, (_, y) => ({
			x: x,
			y: y,
			mark: marks.get([l, t, x, y].join(':')) ?? ''
		})))
	})));
}

function describe(type: Piece, summary: string, details: string[]): PieceInfo {
	return { type: type, name: pieceName(type), summary: summary, details: details, diagram: buildDiagram(type) };
}

@Component({
	selector: 'app-rules',
	imports: [
		CommonModule,
		RouterLink,
		PieceSprite
	],
	templateUrl: './rules.html',
	styleUrl: './rules.less',
})
export class Rules implements OnInit {

	private route = inject(ActivatedRoute);

	public readonly CENTRE = CENTRE;
	public readonly WHITE = Color.white;
	public readonly BLACK = Color.black;

	/** A user id that only lives in the address bar has to travel back with us. */
	public carried: { [name: string]: string } = {};

	public readonly STANDARD: PieceInfo[] = [
		describe(Piece.black_king, 'One step in any direction, along any mix of the four axes.', [
			'The king is royal: if it can be captured, you are in check, and you may not submit a turn that leaves any of your royal pieces in check.',
			'Castling works on a single board, just like in normal chess.'
		]),
		describe(Piece.black_queen, 'Slides any distance in any direction a rook, bishop, unicorn or dragon can.', [
			'The strongest piece on the board, and the one a pawn usually promotes to.'
		]),
		describe(Piece.black_rook, 'Slides any distance along exactly one axis.', [
			'Along a rank or file, like normal. Through time, it moves straight back to the same square a number of turns ago; forward in time is out of reach, since that would need a step across timelines as well. Across timelines, it moves to the same square on another timeline at the same turn.'
		]),
		describe(Piece.black_bishop, 'Slides any distance along exactly two axes at once, one step on each per step.', [
			'On a single board that is the usual diagonal. It can also, for example, go one file sideways for every turn back in time, or one rank for every timeline it crosses.'
		]),
		describe(Piece.black_knight, 'Jumps two steps along one axis and one step along another.', [
			'It jumps over anything in between, so it cannot be blocked. Two turns back and one square sideways is just as valid as the familiar L-shape on one board.'
		]),
		describe(Piece.black_pawn, 'Walks one step forward, captures one step diagonally forward.', [
			'Forward means towards the opponent: up the board for white, and also across timelines, towards the negative timelines for white and the positive ones for black.',
			'Without capturing it may step one rank forward, or one timeline forward to the same square. On its very first move it may take two steps forward on the board.',
			'It captures one rank forward and one file sideways on its board, or one timeline forward and one turn earlier or later.',
			'En passant and promotion work on a single board just like in normal chess.'
		])
	];

	public readonly FAIRY: PieceInfo[] = [
		describe(Piece.black_unicorn, 'Slides any distance along exactly three axes at once.', [
			'A "triagonal": every step moves one square along three of the four axes at the same time. On a single board it cannot move at all.'
		]),
		describe(Piece.black_dragon, 'Slides any distance along all four axes at once.', [
			'A "quadragonal": every step changes rank, file, turn and timeline together. It always leaves the board it stands on.'
		]),
		describe(Piece.black_princess, 'Moves like a rook or a bishop.', [
			'A queen without the unicorn and dragon moves.'
		]),
		describe(Piece.black_brawn, 'A pawn with extra captures.', [
			'It walks, promotes and takes en passant exactly like a pawn.',
			'On top of the pawn captures it may capture one timeline forward and one file sideways, or one rank forward and one turn earlier or later.'
		]),
		describe(Piece.black_royal_queen, 'Moves like a queen, but is royal.', [
			'Losing it is just as fatal as losing the king, so it has to be protected like one.'
		]),
		describe(Piece.black_common_king, 'Moves like a king, but is not royal.', [
			'It can be captured like any other piece without ending the game, and it cannot castle.'
		])
	];

	public ngOnInit() {
		var userId = this.route.snapshot.queryParamMap.get(USER_ID_PARAM);
		if (userId) {
			this.carried = { [USER_ID_PARAM]: userId };
		}
	}

	public getPieceIcon(type: Piece, color: Color, x: number, y: number): string {
		return getPieceIcon(Piece.of(type, color), x, y);
	}

	/** Jumps to a section without the router treating the fragment as a route. */
	public scrollTo(event: Event, id: string) {
		event.preventDefault();
		document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
	}

	public lineLabel(l: number): string {
		return l == 0 ? 'L' : l < 0 ? 'L' + l : 'L+' + l;
	}

	public turnLabel(t: number): string {
		return t == 0 ? 'T' : 'T' + t;
	}
}
