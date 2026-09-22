/**
 * The query parameter a shared invitation carries its game in. Opening the main menu
 * with it joins that game, the same as typing the id into Join game.
 */
export const JOIN_PARAM = 'join';

/**
 * The link that invites someone into a game. It deliberately carries nothing but the
 * game: the sharer's own id must never travel along with it.
 */
export function joinUrl(gameId: number): string {
	return document.baseURI.split(/[?#]/)[0] + '?' + JOIN_PARAM + '=' + gameId;
}
