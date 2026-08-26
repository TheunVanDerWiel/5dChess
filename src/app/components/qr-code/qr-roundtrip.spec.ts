import { Ecc, encodeQr } from './qr-encode';

// Enough of a reader to check that a code says what it was given. It is written
// from the geometry rather than out of the encoder, so that a slip in either the
// masking or the order the modules are laid down in shows up as a mismatch. Only
// version 3 is handled, which is where the links this component draws land.

function functionMap(size: number): boolean[][] {
	var used = Array.from({ length: size }, () => new Array(size).fill(false));
	var mark = (x: number, y: number) => { if (x >= 0 && x < size && y >= 0 && y < size) { used[y][x] = true; } };
	// Finders with their separators, top left, top right, bottom left.
	for (const [cx, cy] of [[3, 3], [size - 4, 3], [3, size - 4]]) {
		for (var dy = -4; dy <= 4; dy++) { for (var dx = -4; dx <= 4; dx++) { mark(cx + dx, cy + dy); } }
	}
	// Timing.
	for (var i = 0; i < size; i++) { mark(6, i); mark(i, 6); }
	// Alignment: version 3 has a single one where rows 6 and 22 cross.
	for (var dy = -2; dy <= 2; dy++) { for (var dx = -2; dx <= 2; dx++) { mark(22 + dx, 22 + dy); } }
	// Format information, both copies, and the module always left dark.
	for (var i = 0; i <= 8; i++) { mark(8, i); mark(i, 8); }
	for (var i = 0; i < 8; i++) { mark(size - 1 - i, 8); }
	for (var i = 8; i < 15; i++) { mark(8, size - 15 + i); }
	return used;
}

function readMask(modules: boolean[][]): number {
	var bits = 0;
	for (var i = 0; i <= 5; i++) { bits |= (modules[i][8] ? 1 : 0) << i; }
	bits |= (modules[7][8] ? 1 : 0) << 6;
	bits |= (modules[8][8] ? 1 : 0) << 7;
	bits |= (modules[8][7] ? 1 : 0) << 8;
	for (var i = 9; i < 15; i++) { bits |= (modules[8][14 - i] ? 1 : 0) << i; }
	return ((bits ^ 0x5412) >>> 10) & 0x7;
}

function masked(mask: number, x: number, y: number): boolean {
	switch (mask) {
		case 0: return (x + y) % 2 == 0;
		case 1: return y % 2 == 0;
		case 2: return x % 3 == 0;
		case 3: return (x + y) % 3 == 0;
		case 4: return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 == 0;
		case 5: return x * y % 2 + x * y % 3 == 0;
		case 6: return (x * y % 2 + x * y % 3) % 2 == 0;
		default: return ((x + y) % 2 + x * y % 3) % 2 == 0;
	}
}

function decode(modules: boolean[][]): string {
	var size = modules.length;
	var used = functionMap(size);
	var mask = readMask(modules);

	var bits: number[] = [];
	for (var right = size - 1; right >= 1; right -= 2) {
		if (right == 6) { right = 5; }
		for (var step = 0; step < size; step++) {
			for (var column = 0; column < 2; column++) {
				var x = right - column;
				var y = ((right + 1) & 2) == 0 ? size - 1 - step : step;
				if (used[y][x]) { continue; }
				bits.push((modules[y][x] !== masked(mask, x, y)) ? 1 : 0);
			}
		}
	}

	var take = (count: number) => {
		var value = 0;
		for (var i = 0; i < count; i++) { value = value << 1 | bits.shift()!; }
		return value;
	};
	if (take(4) != 0x4) { throw new Error('not byte mode'); }
	var length = take(8);
	var bytes: number[] = [];
	for (var i = 0; i < length; i++) { bytes.push(take(8)); }
	return new TextDecoder().decode(new Uint8Array(bytes));
}

describe('round trip', () => {
	it('reads back what it was given', () => {
		var text = 'https://example.com/?userId=abc';
		expect(decode(encodeQr(text, Ecc.medium))).toBe(text);
	});
});
