/// <reference lib="webworker" />
import { GameState } from 'src/app/types/GameState';
import { Move as TurnDto } from 'src/app/types/Move';
import { Verdict, judge } from './checkmate';
import { moveFromDto, stateFromDto } from './dto';
import { Color } from './piece';
import { applyTurn } from './turn';

export interface JudgeRequest {
	id: number;
	startingState: GameState;
	moves: TurnDto[];
	color: Color;
}

export interface JudgeReply {
	id: number;
	verdict: Verdict;
	nodes: number;
	ms: number;
}

/**
 * Decides whether a colour has any turn left, with nothing held back. Off the main
 * thread there is no reason to stop early, so a position that the quick search would
 * have given up on is followed all the way to an answer. Whoever asked stops it by
 * terminating the worker, which is the only thing that interrupts a search in
 * progress.
 */
addEventListener('message', ({ data }: MessageEvent<JudgeRequest>) => {
	const state = stateFromDto(data.startingState);
	data.moves.forEach(turn => applyTurn(state, turn.Pieces.map(moveFromDto)));
	const judged = judge(state, data.color, {
		budget: Number.POSITIVE_INFINITY,
		until: Number.POSITIVE_INFINITY
	});
	const reply: JudgeReply = {
		id: data.id, verdict: judged.verdict, nodes: judged.nodes, ms: judged.ms
	};
	postMessage(reply);
});
