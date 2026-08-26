import { Component, computed, input } from '@angular/core';
import { Ecc, encodeQr } from './qr-encode';

/**
 * A QR code for a short piece of text, drawn as SVG so that it stays sharp at
 * whatever size the page gives it.
 */
@Component({
	selector: 'app-qr-code',
	templateUrl: './qr-code.html',
	styleUrl: './qr-code.less'
})
export class QrCode {
	/**
	 * A middling level of error correction. Enough that a camera still reads the
	 * code off a screen at an angle, without growing it more than that needs.
	 */
	private static readonly ECC = Ecc.medium;
	/** The blank margin readers need to pick the code out of what surrounds it. */
	private static readonly QUIET_ZONE = 4;

	/** What a scanner should read off the code. */
	public data = input.required<string>();
	/** What the code is, for anyone who cannot see it. */
	public label = input('QR code');

	private modules = computed(() => encodeQr(this.data(), QrCode.ECC));

	/** The side of the drawing in modules, code and quiet zone together. */
	public extent = computed(() => this.modules().length + QrCode.QUIET_ZONE * 2);

	/** Every dark module as one square in a single path, one module to the unit. */
	public path = computed(() => {
		var squares: string[] = [];
		var modules = this.modules();
		for (var y = 0; y < modules.length; y++) {
			for (var x = 0; x < modules[y].length; x++) {
				if (modules[y][x]) {
					squares.push(`M${x + QrCode.QUIET_ZONE},${y + QrCode.QUIET_ZONE}h1v1h-1z`);
				}
			}
		}
		return squares.join('');
	});
}
