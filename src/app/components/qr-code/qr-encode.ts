/**
 * Enough of ISO/IEC 18004 to turn a short string into a grid of QR modules.
 *
 * Byte mode only: the ids and links drawn here are mixed case, which the more
 * compact alphanumeric mode cannot hold. The order below follows the standard's
 * own: a bit stream, split into Reed-Solomon blocks, laid into a grid around the
 * function patterns, and finally covered by whichever mask scores best.
 */

/** How much of a code may be lost and still be read. */
export enum Ecc {
	low = 0,
	medium = 1,
	quartile = 2,
	high = 3
}

/** Error correction codewords per block, by level and then version. */
const ECC_CODEWORDS_PER_BLOCK: number[][] = [
	// Version 0 does not exist; the unused slot keeps the rest at their own number.
	[-1,  7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
	[-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
	[-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
	[-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30]
];

/** How many blocks the codewords are split over, by level and then version. */
const ECC_BLOCKS: number[][] = [
	[-1, 1, 1, 1, 1, 1, 2, 2, 2, 2,  4,  4,  4,  4,  4,  6,  6,  6,  6,  7,  8,  8,  9,  9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
	[-1, 1, 1, 1, 2, 2, 4, 4, 4, 5,  5,  5,  8,  9,  9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
	[-1, 1, 1, 2, 2, 4, 4, 6, 6, 8,  8,  8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
	[-1, 1, 1, 2, 4, 4, 4, 5, 6, 8,  8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 57, 60, 63, 66, 70, 74, 77, 81, 85]
];

/** The two bits each level is written into the format information as. */
const FORMAT_BITS = [1, 0, 3, 2];

/** The weights the standard gives the four things a mask is judged on. */
const PENALTY_RUN = 3;
const PENALTY_BLOCK = 3;
const PENALTY_FINDER_LOOKALIKE = 40;
const PENALTY_IMBALANCE = 10;

/**
 * The modules of a code holding `text`, as rows from top to bottom, each running
 * left to right. True is dark. No quiet zone is included; whatever draws the grid
 * has to leave that margin itself.
 */
export function encodeQr(text: string, ecc: Ecc = Ecc.medium): boolean[][] {
	var bytes = Array.from(new TextEncoder().encode(text));
	var version = chooseVersion(bytes.length, ecc);
	var codewords = addEcc(toDataCodewords(bytes, version, ecc), version, ecc);
	return new Grid(version, ecc, codewords).modules;
}

/** The smallest version `length` bytes fit in at this level. */
function chooseVersion(length: number, ecc: Ecc): number {
	for (var version = 1; version <= 40; version++) {
		var countBits = version < 10 ? 8 : 16;
		if (4 + countBits + length * 8 <= numDataCodewords(version, ecc) * 8) {
			return version;
		}
	}
	throw new Error('Too much data for a QR code: ' + length + ' bytes');
}

/** Modules a version has to spare once the function patterns are taken out. */
function numRawDataModules(version: number): number {
	var result = (16 * version + 128) * version + 64;
	if (version >= 2) {
		var alignments = Math.floor(version / 7) + 2;
		result -= (25 * alignments - 10) * alignments - 55;
		if (version >= 7) { result -= 36; }
	}
	return result;
}

/** Codewords left for the message itself, once error correction has its share. */
function numDataCodewords(version: number, ecc: Ecc): number {
	return Math.floor(numRawDataModules(version) / 8)
		- ECC_CODEWORDS_PER_BLOCK[ecc][version] * ECC_BLOCKS[ecc][version];
}

/** The message as codewords: a header, the bytes, and padding out to capacity. */
function toDataCodewords(bytes: number[], version: number, ecc: Ecc): number[] {
	var bits: number[] = [];
	appendBits(bits, 0x4, 4);                               // byte mode
	appendBits(bits, bytes.length, version < 10 ? 8 : 16);  // character count
	for (const byte of bytes) { appendBits(bits, byte, 8); }

	var capacity = numDataCodewords(version, ecc) * 8;
	appendBits(bits, 0, Math.min(4, capacity - bits.length));  // terminator
	appendBits(bits, 0, (8 - bits.length % 8) % 8);            // up to a whole codeword
	// The two padding bytes the standard names, alternating until the version is full.
	for (var pad = 0xEC; bits.length < capacity; pad ^= 0xEC ^ 0x11) {
		appendBits(bits, pad, 8);
	}

	var codewords: number[] = [];
	for (var i = 0; i < bits.length; i += 8) {
		var codeword = 0;
		for (var j = 0; j < 8; j++) { codeword = codeword << 1 | bits[i + j]; }
		codewords.push(codeword);
	}
	return codewords;
}

function appendBits(bits: number[], value: number, length: number): void {
	for (var i = length - 1; i >= 0; i--) { bits.push(value >>> i & 1); }
}

/**
 * The data split into blocks, each given its error correction codewords, and the
 * blocks then interleaved. Interleaving is what lets a code survive a smudge:
 * damage in one place is spread over every block instead of destroying one.
 */
function addEcc(data: number[], version: number, ecc: Ecc): number[] {
	var numBlocks = ECC_BLOCKS[ecc][version];
	var eccLength = ECC_CODEWORDS_PER_BLOCK[ecc][version];
	var rawCodewords = Math.floor(numRawDataModules(version) / 8);
	// The blocks cannot always be the same size; the short ones come first.
	var shortBlocks = numBlocks - rawCodewords % numBlocks;
	var shortLength = Math.floor(rawCodewords / numBlocks);

	var divisor = rsDivisor(eccLength);
	var blocks: number[][] = [];
	for (var i = 0, at = 0; i < numBlocks; i++) {
		var block = data.slice(at, at + shortLength - eccLength + (i < shortBlocks ? 0 : 1));
		at += block.length;
		var remainder = rsRemainder(block, divisor);
		// Squared off to the long length, so the interleaving below can walk them together.
		if (i < shortBlocks) { block.push(0); }
		blocks.push(block.concat(remainder));
	}

	var result: number[] = [];
	for (var i = 0; i < blocks[0].length; i++) {
		for (var j = 0; j < blocks.length; j++) {
			// Leave out the padding that was only there to square the blocks off.
			if (i != shortLength - eccLength || j >= shortBlocks) { result.push(blocks[j][i]); }
		}
	}
	return result;
}

/** The Reed-Solomon generator polynomial of the given degree, lowest term last. */
export function rsDivisor(degree: number): number[] {
	var result = new Array(degree).fill(0);
	result[degree - 1] = 1;
	// Multiplied out one root at a time: (x - a^0)(x - a^1)...(x - a^(degree-1)).
	for (var i = 0, root = 1; i < degree; i++, root = rsMultiply(root, 0x02)) {
		for (var j = 0; j < result.length; j++) {
			result[j] = rsMultiply(result[j], root);
			if (j + 1 < result.length) { result[j] ^= result[j + 1]; }
		}
	}
	return result;
}

/** The error correction codewords for one block. */
function rsRemainder(data: number[], divisor: number[]): number[] {
	var result: number[] = divisor.map(() => 0);
	for (const byte of data) {
		var factor = byte ^ (result.shift() as number);
		result.push(0);
		divisor.forEach((coefficient, i) => result[i] ^= rsMultiply(coefficient, factor));
	}
	return result;
}

/** Multiplication in GF(2^8), reduced by the field polynomial the standard names. */
export function rsMultiply(x: number, y: number): number {
	var result = 0;
	for (var i = 7; i >= 0; i--) {
		result = (result << 1) ^ ((result >>> 7) * 0x11D);
		result ^= ((y >>> i) & 1) * x;
	}
	return result;
}

function getBit(value: number, index: number): boolean {
	return ((value >>> index) & 1) != 0;
}

/**
 * A grid part way through being drawn. `used` marks the modules that belong to a
 * function pattern, which the data has to step over and the mask must not touch.
 */
class Grid {
	public readonly size: number;
	public readonly modules: boolean[][];
	private readonly used: boolean[][];

	constructor(private version: number, private ecc: Ecc, codewords: number[]) {
		this.size = version * 4 + 17;
		this.modules = Grid.blank(this.size);
		this.used = Grid.blank(this.size);

		this.drawFunctionPatterns();
		this.drawCodewords(codewords);
		this.applyBestMask();
	}

	private static blank(size: number): boolean[][] {
		return Array.from({ length: size }, () => new Array(size).fill(false));
	}

	/** Everything a reader looks for before it looks at any data. */
	private drawFunctionPatterns(): void {
		for (var i = 0; i < this.size; i++) {
			this.setFunction(6, i, i % 2 == 0);
			this.setFunction(i, 6, i % 2 == 0);
		}
		this.drawFinder(3, 3);
		this.drawFinder(this.size - 4, 3);
		this.drawFinder(3, this.size - 4);

		var positions = this.alignmentPositions();
		for (var i = 0; i < positions.length; i++) {
			for (var j = 0; j < positions.length; j++) {
				// Three of the crossings are already taken up by the finder patterns.
				var corner = (i == 0 && j == 0)
					|| (i == 0 && j == positions.length - 1)
					|| (i == positions.length - 1 && j == 0);
				if (!corner) { this.drawAlignment(positions[i], positions[j]); }
			}
		}

		// Reserved for now with an arbitrary mask; rewritten once one is chosen.
		this.drawFormatBits(0);
		this.drawVersionBits();
	}

	private drawFinder(x: number, y: number): void {
		for (var dy = -4; dy <= 4; dy++) {
			for (var dx = -4; dx <= 4; dx++) {
				// Concentric rings, with the separator as the outermost light one.
				var ring = Math.max(Math.abs(dx), Math.abs(dy));
				if (this.inside(x + dx, y + dy)) {
					this.setFunction(x + dx, y + dy, ring != 2 && ring != 4);
				}
			}
		}
	}

	private drawAlignment(x: number, y: number): void {
		for (var dy = -2; dy <= 2; dy++) {
			for (var dx = -2; dx <= 2; dx++) {
				this.setFunction(x + dx, y + dy, Math.max(Math.abs(dx), Math.abs(dy)) != 1);
			}
		}
	}

	/** The rows alignment patterns sit on, which are also the columns they sit on. */
	private alignmentPositions(): number[] {
		if (this.version == 1) { return []; }
		var count = Math.floor(this.version / 7) + 2;
		var step = this.version == 32 ? 26
			: Math.ceil((this.version * 4 + 4) / (count * 2 - 2)) * 2;
		var result = [6];
		for (var pos = this.size - 7; result.length < count; pos -= step) {
			result.splice(1, 0, pos);
		}
		return result;
	}

	/** The level and the mask, written twice over so either copy can be lost. */
	private drawFormatBits(mask: number): void {
		var data = FORMAT_BITS[this.ecc] << 3 | mask;
		var remainder = data;
		for (var i = 0; i < 10; i++) {
			remainder = (remainder << 1) ^ ((remainder >>> 9) * 0x537);
		}
		var bits = ((data << 10) | remainder) ^ 0x5412;

		for (var i = 0; i <= 5; i++) { this.setFunction(8, i, getBit(bits, i)); }
		this.setFunction(8, 7, getBit(bits, 6));
		this.setFunction(8, 8, getBit(bits, 7));
		this.setFunction(7, 8, getBit(bits, 8));
		for (var i = 9; i < 15; i++) { this.setFunction(14 - i, 8, getBit(bits, i)); }

		for (var i = 0; i < 8; i++) { this.setFunction(this.size - 1 - i, 8, getBit(bits, i)); }
		for (var i = 8; i < 15; i++) { this.setFunction(8, this.size - 15 + i, getBit(bits, i)); }
		this.setFunction(8, this.size - 8, true);
	}

	/** From version 7 on the size is spelled out, rather than counted off the grid. */
	private drawVersionBits(): void {
		if (this.version < 7) { return; }
		var remainder = this.version;
		for (var i = 0; i < 12; i++) {
			remainder = (remainder << 1) ^ ((remainder >>> 11) * 0x1F25);
		}
		var bits = (this.version << 12) | remainder;

		for (var i = 0; i < 18; i++) {
			var dark = getBit(bits, i);
			var far = this.size - 11 + i % 3, near = Math.floor(i / 3);
			this.setFunction(far, near, dark);
			this.setFunction(near, far, dark);
		}
	}

	/** The codewords, snaked up and down two column wide strips from the right. */
	private drawCodewords(codewords: number[]): void {
		var at = 0;
		for (var right = this.size - 1; right >= 1; right -= 2) {
			// The vertical timing pattern is stepped over rather than split around.
			if (right == 6) { right = 5; }
			for (var step = 0; step < this.size; step++) {
				for (var column = 0; column < 2; column++) {
					var x = right - column;
					var upward = ((right + 1) & 2) == 0;
					var y = upward ? this.size - 1 - step : step;
					if (!this.used[y][x] && at < codewords.length * 8) {
						this.modules[y][x] = getBit(codewords[at >>> 3], 7 - (at & 7));
						at++;
					}
				}
			}
		}
	}

	/** Whichever of the eight masks leaves the code easiest to read. */
	private applyBestMask(): void {
		var best = 0, bestPenalty = Infinity;
		for (var mask = 0; mask < 8; mask++) {
			this.applyMask(mask);
			this.drawFormatBits(mask);
			var penalty = this.penalty();
			if (penalty < bestPenalty) {
				best = mask;
				bestPenalty = penalty;
			}
			this.applyMask(mask);  // exclusive or is its own undo
		}
		this.applyMask(best);
		this.drawFormatBits(best);
	}

	private applyMask(mask: number): void {
		for (var y = 0; y < this.size; y++) {
			for (var x = 0; x < this.size; x++) {
				if (this.used[y][x]) { continue; }
				var invert: boolean;
				switch (mask) {
					case 0: invert = (x + y) % 2 == 0; break;
					case 1: invert = y % 2 == 0; break;
					case 2: invert = x % 3 == 0; break;
					case 3: invert = (x + y) % 3 == 0; break;
					case 4: invert = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 == 0; break;
					case 5: invert = x * y % 2 + x * y % 3 == 0; break;
					case 6: invert = (x * y % 2 + x * y % 3) % 2 == 0; break;
					default: invert = ((x + y) % 2 + x * y % 3) % 2 == 0; break;
				}
				this.modules[y][x] = this.modules[y][x] !== invert;
			}
		}
	}

	/**
	 * How badly a masked grid reads, by the four rules in the standard: long runs
	 * of one colour, solid blocks, anything a reader could take for a finder
	 * pattern, and dark and light being far from evenly split.
	 */
	private penalty(): number {
		var result = 0;

		for (var y = 0; y < this.size; y++) {
			result += this.linePenalty(x => this.modules[y][x]);
		}
		for (var x = 0; x < this.size; x++) {
			result += this.linePenalty(y => this.modules[y][x]);
		}

		for (var y = 0; y < this.size - 1; y++) {
			for (var x = 0; x < this.size - 1; x++) {
				var color = this.modules[y][x];
				if (color == this.modules[y][x + 1] && color == this.modules[y + 1][x]
					&& color == this.modules[y + 1][x + 1]) {
					result += PENALTY_BLOCK;
				}
			}
		}

		var dark = 0;
		for (const row of this.modules) {
			for (const module of row) { if (module) { dark++; } }
		}
		var total = this.size * this.size;
		// Every 5% the dark share strays from half costs the same again.
		var offBy = Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1;
		return result + offBy * PENALTY_IMBALANCE;
	}

	/** What one row or column costs, for the two rules that read along a line. */
	private linePenalty(at: (index: number) => boolean): number {
		var result = 0, color = false, run = 0;
		var history = [0, 0, 0, 0, 0, 0, 0];
		for (var i = 0; i < this.size; i++) {
			if (at(i) == color) {
				run++;
				if (run == 5) { result += PENALTY_RUN; }
				else if (run > 5) { result++; }
			} else {
				this.addRun(run, history);
				if (!color) { result += this.finderLookalikes(history) * PENALTY_FINDER_LOOKALIKE; }
				color = at(i);
				run = 1;
			}
		}
		// The run still open when the line ends, and the light border past it.
		if (color) {
			this.addRun(run, history);
			run = 0;
		}
		this.addRun(run + this.size, history);
		return result + this.finderLookalikes(history) * PENALTY_FINDER_LOOKALIKE;
	}

	/**
	 * Whether the last runs read as the 1:1:3:1:1 of a finder pattern, from either
	 * side. Such stretches are what the third rule is there to discourage.
	 */
	private finderLookalikes(history: number[]): number {
		var unit = history[1];
		var core = unit > 0 && history[2] == unit && history[3] == unit * 3
			&& history[4] == unit && history[5] == unit;
		return (core && history[0] >= unit * 4 && history[6] >= unit ? 1 : 0)
			+ (core && history[6] >= unit * 4 && history[0] >= unit ? 1 : 0);
	}

	private addRun(run: number, history: number[]): void {
		// The edge of the grid counts as light, so the first run reaches out past it.
		if (history[0] == 0) { run += this.size; }
		history.pop();
		history.unshift(run);
	}

	private setFunction(x: number, y: number, dark: boolean): void {
		this.modules[y][x] = dark;
		this.used[y][x] = true;
	}

	private inside(x: number, y: number): boolean {
		return x >= 0 && x < this.size && y >= 0 && y < this.size;
	}
}
