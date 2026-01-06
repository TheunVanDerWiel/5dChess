<?php
namespace Net\VanDerWiel\Entities;

use Net\VanDerWiel\Core\EntityList;

class GameList extends EntityList {
	protected function getTable() { return Game::TABLE; }
	protected function getFields() { return Game::FIELDS; }
	protected function createInstance($data) {
		$game = new Game($this->db);
		$game->fromData($data);
		return $game;
	}
}
?>