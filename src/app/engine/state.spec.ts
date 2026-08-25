import { Color, EMPTY } from './piece';
import { State, Timeline } from './state';

/** Timelines at the given indices, each holding `count` empty boards from `startT`. */
function lines(indices: number[], startT = 0, count = 1): State {
	return new State(8, indices.map(index => {
		const timeline: Timeline = { index, startT, parent: null, boards: [] };
		for (let i = 0; i < count; i++) {
			timeline.boards.push({ t: startT + i, squares: new Int16Array(64).fill(EMPTY) });
		}
		return timeline;
	}));
}

describe('finding a timeline by index', () => {
	it('finds every timeline of an odd start', () => {
		const state = lines([-1, 0, 1]);
		for (const index of [-1, 0, 1]) {
			expect(state.line(index)?.index).toBe(index);
		}
	});

	it('finds both timelines of an even start, which has no index 0', () => {
		const state = lines([-1, 1]);
		expect(state.line(-1)?.index).toBe(-1);
		expect(state.line(1)?.index).toBe(1);
	});

	it('reports the missing index 0 of an even start as absent', () => {
		expect(lines([-1, 1]).line(0)).toBeNull();
	});

	it('still finds branches added on either side of an even start', () => {
		const state = lines([-1, 1]);
		state.addTimeline(1, 0, Color.white);
		state.addTimeline(-1, 0, Color.black);
		for (const index of [-2, -1, 1, 2]) {
			expect(state.line(index)?.index).toBe(index);
		}
		expect(state.line(0)).toBeNull();
	});

	it('reports indices beyond either end as absent', () => {
		const state = lines([-1, 1]);
		expect(state.line(-2)).toBeNull();
		expect(state.line(2)).toBeNull();
	});
});

describe('counting timelines apart', () => {
	it('counts one step at a time along an odd start', () => {
		const state = lines([-1, 0, 1]);
		expect(state.offsetLine(-1, 1)).toBe(0);
		expect(state.offsetLine(0, 1)).toBe(1);
		expect(state.offsetLine(1, -2)).toBe(-1);
		expect(state.offsetLine(0, 0)).toBe(0);
	});

	it('treats -1 and 1 as neighbours when there is no 0 between them', () => {
		const state = lines([-1, 1]);
		expect(state.offsetLine(-1, 1)).toBe(1);
		expect(state.offsetLine(1, -1)).toBe(-1);
	});

	it('skips the missing 0 on a longer count', () => {
		const state = lines([-2, -1, 1, 2]);
		expect(state.offsetLine(-2, 3)).toBe(2);
		expect(state.offsetLine(2, -2)).toBe(-1);
	});

	it('runs out at the outermost timeline', () => {
		const state = lines([-1, 1]);
		expect(state.offsetLine(1, 1)).toBeNull();
		expect(state.offsetLine(-1, -1)).toBeNull();
	});

	it('counts from nowhere when the timeline does not exist', () => {
		expect(lines([-1, 1]).offsetLine(0, 1)).toBeNull();
	});
});

describe('boards on a timeline of an even start', () => {
	it('reads the head of a positive timeline', () => {
		const state = lines([-1, 1], 0, 3);
		expect(state.headT(1)).toBe(2);
		expect(state.head(1)?.t).toBe(2);
		expect(state.board(1, 1)?.t).toBe(1);
	});
});
