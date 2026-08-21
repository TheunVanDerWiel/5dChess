import { Component } from '@angular/core';

/**
 * The piece outlines, defined once per page as SVG symbols. Anything that draws a
 * piece references a symbol by the id `getPieceIcon` produces.
 */
@Component({
	selector: 'app-piece-sprite',
	templateUrl: './piece-sprite.html'
})
export class PieceSprite {}
