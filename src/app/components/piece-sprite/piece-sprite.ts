import { Component } from '@angular/core';
import { Piece, pieceSlug } from 'src/app/engine/piece';

/**
 * The piece outlines, defined once per page as SVG symbols. Anything that draws a
 * piece references a symbol by the id `getPieceIcon` produces.
 */
@Component({
	selector: 'app-piece-sprite',
	templateUrl: './piece-sprite.html'
})
export class PieceSprite {}

/**
 * The sprite symbol a piece is drawn with. A piece is outlined when its colour
 * matches its square and filled otherwise, so it stays legible either way.
 */
export function getPieceIcon(piece: Piece, x: number, y: number): string {
	var variant = Piece.color(piece) == 1 - (x + y) % 2 ? 'outline' : 'solid';
	return `#piece-${pieceSlug(piece)}-${variant}`;
}
