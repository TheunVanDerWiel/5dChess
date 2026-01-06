<?php
namespace Net\VanDerWiel\Entities;

use Net\VanDerWiel\Core\Entity;

class Game extends Entity {
	const TABLE = "game";
	const FIELDS = array("player1", "player2", "starting_state", "starting_player", "moves", "active_player", "status", "winner_player");
	
	public $Player1;
	public $Player2;
	public $StartingState;
	public $StartingPlayer;
	public $Moves;
	public $ActivePlayer;
	public $Status;
	public $WinnerPlayer;
	
	protected function getTable() { return Game::TABLE; }
	protected function getFields() { return Game::FIELDS; }
	protected function getDBData() {
		return array($this->Player1, $this->Player2, $this->StartingState, $this->StartingPlayer, $this->Moves, $this->ActivePlayer, $this->Status, $this->WinnerPlayer);
	}
	public function fromData($data) {
		$this->Player1 = $data[Game::FIELDS[0]];
		$this->Player2 = $data[Game::FIELDS[1]];
		$this->StartingState = $data[Game::FIELDS[2]];
		$this->StartingPlayer = $data[Game::FIELDS[3]];
		$this->Moves = $data[Game::FIELDS[4]];
		$this->ActivePlayer = $data[Game::FIELDS[5]];
		$this->Status = $data[Game::FIELDS[6]];
		$this->WinnerPlayer = $data[Game::FIELDS[7]];
		return parent::fromData($data);
	}
	
	public function toUserJson($userId) {
	    // All player references are relative to the user (1 = self, 2 = opponent)
	    return array(
	        "Id"=> $this->Id,
	        "StartingPlayer" => $userId == $this->Player1 ? $this->StartingPlayer : 2-$this->StartingPlayer,
	        "StartingState"=> json_decode($this->StartingState),
	        "ActivePlayer"=> $userId == $this->Player1 ? $this->ActivePlayer : 2-$this->ActivePlayer,
	        "Moves"=> json_decode($this->Moves),
	        "Status"=> $this->Status,
	        "WinnerPlayer"=> $userId == $this->Player1 ? $this->WinnerPlayer : 2-$this->WinnerPlayer
	    );
	}
}
?>