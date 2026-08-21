<?php
namespace Net\VanDerWiel\Services;

use Psr\Http\Message\ServerRequestInterface as Request;
use Psr\Http\Message\ResponseInterface as Response;
use Slim\Routing\RouteCollectorProxy;
use Net\VanDerWiel\Middleware\BaseMiddleware;
use Net\VanDerWiel\Middleware\JsonValidationMiddleware;
use Net\VanDerWiel\models\Model;
use Net\VanDerWiel\Entities\GameList;
use Net\VanDerWiel\Entities\Game;
use Net\VanDerWiel\Enums\GameStatus;
use Net\VanDerWiel\Enums\GameType;

class GameServices extends BaseMiddleware {
	public function register() {
		$this->app->group('/api/games', function(RouteCollectorProxy $group) {
			/**
			 * Gets all games for a user
			 */
			$group->get('', function (Request $request, Response $respone, $args) {
			    $params = $request->getQueryParams();
			    if (!isset($params["userId"])) {
			        return $this->badRequest();
			    }
			    
			    $list = new GameList($this->db);
			    $list->retrieve("player1=? or player2=?", array($params["userId"], $params["userId"]));
			    
			    // A summary each: the full boards and move lists are far too much to
			    // hand over for a menu, and the other player's id is nobody's business
			    $summaries = array();
			    foreach ($list->all() as $game) {
			        $mine = $params["userId"] == $game->Player1;
			        $moves = json_decode($game->Moves);
			        $summaries[] = array(
			            "Id" => $game->getId(),
			            "Status" => $game->Status,
			            "ActivePlayer" => $mine ? $game->ActivePlayer : 3-$game->ActivePlayer,
			            "WinnerPlayer" => $mine || $game->WinnerPlayer === null ? $game->WinnerPlayer : 3-$game->WinnerPlayer,
			            "Turns" => is_array($moves) ? count($moves) : 0,
			            "Waiting" => $game->Player2 === null
			        );
			    }
			    return $this->ok($summaries);
			});
			
			
			/**
			 * Add a game
			 */
			$group->post('', function (Request $request, Response $response) {
			    $body = $request->getParsedBody();
				
				$game = new Game($this->db);
				$game->Player1 = $body["UserId"];
				switch ($body['Type']) {
				    case GameType::STANDARD_REGULAR->value:
				        $game->StartingState = '{"TimeLines":[{"Index":0,"Boards":[{"Squares":[[2,4,8,16,32,8,4,2],[0,0,0,0,0,0,0,0],[null,null,null,null,null,null,null,null],[null,null,null,null,null,null,null,null],[null,null,null,null,null,null,null,null],[null,null,null,null,null,null,null,null],[1,1,1,1,1,1,1,1],[3,5,9,17,33,9,5,3]]}]}]}'; break;
			        default:
			            return $this->badRequest(array("error" => "Unkown game type"));
				}
				$game->StartingPlayer = rand(1, 2);
				$game->Moves = "[]";
				$game->ActivePlayer = $game->StartingPlayer;
				$game->Status = GameStatus::STARTING->value;
				
				if (!$game->save()) {
				    return $this->internalServerError();
				}
				return $this->ok($game->getId());
			})->add(new JsonValidationMiddleware($this->app, $this->db, Model::GAME_ADD_REQUEST));
            
			
			$group->group('/{id}', function(RouteCollectorProxy $subGroup) {
				/**
				 * Get the details of a game
				 */
				$subGroup->get('', function (Request $request, Response $response, $args) {
				    $params = $request->getQueryParams();
				    if (!isset($params["userId"])) {
				        return $this->badRequest();
				    }
				    
				    $game = new Game($this->db);
				    if (!$game->retrieve($args['id']) || ($game->Player1 != $params["userId"] && $game->Player2 != $params["userId"])) {
						return $this->notFound();
					}
					
					return $this->ok($game->toUserJson($params["userId"]));
				});
				
				
				/**
				 * Join a game
				 */
				$subGroup->post('', function (Request $request, Response $response, $args) {
				    $body = $request->getParsedBody();
				    
				    $game = new Game($this->db);
				    if (!$game->retrieve($args['id'])
				        || ($game->Status == GameStatus::STARTING->value && $game->Player1 == $body["UserId"])
				        || ($game->Status != GameStatus::STARTING->value && $game->Player1 != $body["UserId"] && $game->Player2 != $body["UserId"])) {
				        return $this->unauthorized();
				    }
				    if ($game->Status != GameStatus::STARTING->value) {
				        // The user is already joined to this game
				        return $this->ok(false);
				    }
				    
				    $game->Status = GameStatus::IN_PROGRESS->value;
				    $game->Player2 = $body["UserId"];
				    if (!$game->save()) {
				        return $this->internalServerError();
				    }
				    
				    return $this->ok(true);
				})->add(new JsonValidationMiddleware($this->app, $this->db, Model::GAME_JOIN_REQUEST));
				    
				
				/**
				 * Make a move on a course
				 */
				$subGroup->put('', function (Request $request, Response $response, $args) {
				    $body = $request->getParsedBody();
				    
				    $game = new Game($this->db);
				    if (!$game->retrieve($args['id']) || $game->Status != GameStatus::IN_PROGRESS->value || ($game->Player1 != $body["UserId"] && $game->Player2 != $body["UserId"])) {
				        return $this->unauthorized();
				    }
				    
				    if (($body["UserId"] == $game->Player1 && $game->ActivePlayer != 1)
				        || ($body["UserId"] == $game->Player2 && $game->ActivePlayer != 2)) {
				        return $this->badRequest();
				    }
				    
				    $moves = json_decode($game->Moves);
				    $moves[] = $body["Move"];
				    $game->Moves = json_encode($moves);
				    $game->ActivePlayer = 3-$game->ActivePlayer;
				    if (!$game->save()) {
				        return $this->internalServerError();
				    }
				    
				    return $this->ok(true);
				})->add(new JsonValidationMiddleware($this->app, $this->db, Model::GAME_EDIT_REQUEST));
				
				
				/**
				 * Get every move made since the one the client last saw
				 */
				$subGroup->get('/moves/{currentMove}', function (Request $request, Response $response, $args) {
				    $params = $request->getQueryParams();
				    if (!isset($params["userId"])) {
				        return $this->badRequest();
				    }
				    
				    $game = new Game($this->db);
				    if (!$game->retrieve($args['id']) || ($game->Player1 != $params["userId"] && $game->Player2 != $params["userId"])) {
				        return $this->notFound();
				    }
				    
				    $moves = json_decode($game->Moves);
				    if (!is_array($moves)) {
				        $moves = array();
				    }
				    // All player references are relative to the user (1 = self, 2 = opponent)
				    $mine = $params["userId"] == $game->Player1;
				    return $this->ok(array(
				        "Moves" => array_values(array_slice($moves, max(0, (int)$args['currentMove']))),
				        "Status" => $game->Status,
				        "ActivePlayer" => $mine ? $game->ActivePlayer : 3-$game->ActivePlayer,
				        "WinnerPlayer" => $mine || $game->WinnerPlayer === null ? $game->WinnerPlayer : 3-$game->WinnerPlayer
				    ));
				});
				
				
				/**
				 * Report having no legal turn left: checkmate, or a draw if the
				 * player was not under attack
				 */
				$subGroup->post('/finish', function (Request $request, Response $response, $args) {
				    $body = $request->getParsedBody();
				    
				    $game = new Game($this->db);
				    if (!$game->retrieve($args['id']) || ($game->Player1 != $body["UserId"] && $game->Player2 != $body["UserId"])) {
				        return $this->unauthorized();
				    }
				    if ($game->Status != GameStatus::IN_PROGRESS->value) {
				        return $this->ok(false);
				    }
				    // Only the player to move can be the one with nowhere to go
				    if (($body["UserId"] == $game->Player1 && $game->ActivePlayer != 1)
				        || ($body["UserId"] == $game->Player2 && $game->ActivePlayer != 2)) {
				        return $this->badRequest();
				    }
				    
				    $game->Status = GameStatus::FINISHED->value;
				    $game->WinnerPlayer = $body["Drawn"] ? null : ($game->Player1 == $body["UserId"] ? 2 : 1);
				    if (!$game->save()) {
				        return $this->internalServerError();
				    }
				    
				    return $this->ok(true);
				})->add(new JsonValidationMiddleware($this->app, $this->db, Model::GAME_FINISH_REQUEST));
				
				
				/**
				 * Give up, handing the win to the other player
				 */
				$subGroup->post('/forfeit', function (Request $request, Response $response, $args) {
				    $body = $request->getParsedBody();
				    
				    $game = new Game($this->db);
				    if (!$game->retrieve($args['id']) || ($game->Player1 != $body["UserId"] && $game->Player2 != $body["UserId"])) {
				        return $this->unauthorized();
				    }
				    if ($game->Status != GameStatus::IN_PROGRESS->value) {
				        // Nothing left to give up on
				        return $this->ok(false);
				    }
				    
				    $game->Status = GameStatus::FORFEITED->value;
				    $game->WinnerPlayer = $game->Player1 == $body["UserId"] ? 2 : 1;
				    if (!$game->save()) {
				        return $this->internalServerError();
				    }
				    
				    return $this->ok(true);
				})->add(new JsonValidationMiddleware($this->app, $this->db, Model::GAME_JOIN_REQUEST));
			});
		});
	}
}
?>