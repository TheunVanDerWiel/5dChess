/**
 * The query parameter a player's id travels in. It is how a scanned code hands an
 * id to another device, and the only place the id can be kept at all in a browser
 * that will not store anything: there the address bar has to be carried from page
 * to page, and bookmarked to survive being closed.
 */
export const USER_ID_PARAM = 'userId';
