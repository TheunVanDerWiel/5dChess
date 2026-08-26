import { Ecc, encodeQr, rsDivisor, rsMultiply } from './qr-encode';

/** The text the structural tests below are all run against, at 31 bytes. */
const SAMPLE = 'https://example.com/?userId=abc';

/** Whether a finder pattern, rings and all, sits with its centre here. */
function hasFinder(modules: boolean[][], x: number, y: number): boolean {
	for (var dy = -3; dy <= 3; dy++) {
		for (var dx = -3; dx <= 3; dx++) {
			var ring = Math.max(Math.abs(dx), Math.abs(dy));
			if (modules[y + dy][x + dx] != (ring != 2)) { return false; }
		}
	}
	return true;
}

describe('encodeQr', () => {
	it('grows the code only as far as the text needs', () => {
		// Versions are four modules apart, starting at 21 for version 1.
		expect(encodeQr('hi', Ecc.medium).length).toBe(21);
		expect(encodeQr('x'.repeat(64), Ecc.medium).length).toBe(37);
		// The same text fits a smaller code when less of it is spent on recovery.
		expect(encodeQr('x'.repeat(64), Ecc.low).length).toBe(33);
	});

	it('is square, and the same size in both directions', () => {
		var modules = encodeQr(SAMPLE, Ecc.medium);
		expect(modules.length).toBe(29);
		for (const row of modules) {
			expect(row.length).toBe(29);
		}
	});

	it('puts a finder pattern in three of the corners', () => {
		var modules = encodeQr(SAMPLE, Ecc.medium);
		var far = modules.length - 4;
		expect(hasFinder(modules, 3, 3)).toBe(true);
		expect(hasFinder(modules, far, 3)).toBe(true);
		expect(hasFinder(modules, 3, far)).toBe(true);
	});

	it('puts the alignment pattern where the version says', () => {
		// Version 3 has one, centred where its two marked rows cross.
		var modules = encodeQr(SAMPLE, Ecc.medium);
		for (var dy = -2; dy <= 2; dy++) {
			for (var dx = -2; dx <= 2; dx++) {
				var ring = Math.max(Math.abs(dx), Math.abs(dy));
				expect(modules[22 + dy][22 + dx]).toBe(ring != 1);
			}
		}
	});

	it('alternates the timing patterns between the finders', () => {
		var modules = encodeQr(SAMPLE, Ecc.medium);
		for (var i = 8; i < modules.length - 8; i++) {
			expect(modules[6][i]).toBe(i % 2 == 0);
			expect(modules[i][6]).toBe(i % 2 == 0);
		}
	});

	it('always leaves the module below the top left finder dark', () => {
		// The one module the standard fixes, whatever the version or the mask.
		var modules = encodeQr('hi', Ecc.medium);
		expect(modules[modules.length - 8][8]).toBe(true);
	});

	it('refuses text that no version can hold', () => {
		expect(() => encodeQr('x'.repeat(3000), Ecc.high)).toThrow();
	});
});

describe('Reed-Solomon arithmetic', () => {
	it('reduces by the field polynomial once it overflows a byte', () => {
		// a^7 times a is a^8, which in this field is a^4 + a^3 + a^2 + 1.
		expect(rsMultiply(0x80, 0x02)).toBe(0x1D);
		expect(rsMultiply(0x40, 0x02)).toBe(0x80);
		expect(rsMultiply(0x53, 0x01)).toBe(0x53);
	});

	it('builds the generator polynomial the standard publishes', () => {
		// The degree 7 polynomial, given as the powers of a its coefficients are.
		var expected = [87, 229, 146, 149, 238, 102, 21].map(power => {
			var value = 1;
			for (var i = 0; i < power; i++) { value = rsMultiply(value, 0x02); }
			return value;
		});
		expect(rsDivisor(7)).toEqual(expected);
	});
});
