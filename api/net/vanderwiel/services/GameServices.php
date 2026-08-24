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
			            "Type" => $game->Type,
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
				
			    $type = $body['Type'];
			    if ($type == GameType::RANDOM->value) {
			        $types = GameType::getAllAsArray();
			        $type = $types[random_int(1, count($types)-1)];
			    }
			    
				$game = new Game($this->db);
				$game->Player1 = $body["UserId"];
				$game->Type = $type;
				switch ($type) {
				    case GameType::STANDARD_REGULAR->value:
				        $game->StartingState = '{"TimeLines":[{"Index":0,"Boards":[{"Squares":[[2,4,8,16,32,8,4,2],[0,0,0,0,0,0,0,0],[null,null,null,null,null,null,null,null],[null,null,null,null,null,null,null,null],[null,null,null,null,null,null,null,null],[null,null,null,null,null,null,null,null],[1,1,1,1,1,1,1,1],[3,5,9,17,33,9,5,3]]}]}]}'; break;
				    case GameType::STANDARD_DEFENDED_PAWN->value:
				        $game->StartingState = '{"TimeLines":[{"Index":0,"Boards":[{"Squares":[[2,16,8,4,32,8,4,2],[0,0,0,0,0,0,0,0],[null,null,null,null,null,null,null,null],[null,null,null,null,null,null,null,null],[null,null,null,null,null,null,null,null],[null,null,null,null,null,null,null,null],[1,1,1,1,1,1,1,1],[3,17,9,5,33,9,5,3]]}]}]}'; break;
				    case GameType::STANDARD_HALF_REFLECTED->value:
				        $game->StartingState = '{"TimeLines":[{"Index":0,"Boards":[{"Squares":[[2,4,8,32,16,8,4,2],[0,0,0,0,0,0,0,0],[null,null,null,null,null,null,null,null],[null,null,null,null,null,null,null,null],[null,null,null,null,null,null,null,null],[null,null,null,null,null,null,null,null],[1,1,1,1,1,1,1,1],[3,5,9,17,33,9,5,3]]}]}]}'; break;
				    case GameType::STANDARD_PRINCESS->value:
				        $game->StartingState = '{"TimeLines":[{"Index":0,"Boards":[{"Squares":[[2,4,8,512,32,8,4,2],[0,0,0,0,0,0,0,0],[null,null,null,null,null,null,null,null],[null,null,null,null,null,null,null,null],[null,null,null,null,null,null,null,null],[null,null,null,null,null,null,null,null],[1,1,1,1,1,1,1,1],[3,5,9,513,33,9,5,3]]}]}]}'; break;
				    case GameType::STANDARD_REVERSED_ROYALTY->value:
				        $game->StartingState = '{"TimeLines":[{"Index":0,"Boards":[{"Squares":[[2,4,8,1024,2048,8,4,2],[0,0,0,0,0,0,0,0],[null,null,null,null,null,null,null,null],[null,null,null,null,null,null,null,null],[null,null,null,null,null,null,null,null],[null,null,null,null,null,null,null,null],[1,1,1,1,1,1,1,1],[3,5,9,1025,2049,9,5,3]]}]}]}'; break;
				    case GameType::STANDARD_TURN_ZERO->value:
				        $game->StartingState = '{"TimeLines":[{"Index":0,"Boards":[{"Squares":[[2,4,8,16,32,8,4,2],[0,0,0,0,0,0,0,0],[null,null,null,null,null,null,null,null],[null,null,null,null,null,null,null,null],[null,null,null,null,null,null,null,null],[null,null,null,null,null,null,null,null],[1,1,1,1,1,1,1,1],[3,5,9,17,33,9,5,3]]},{"Squares":[[2,4,8,16,32,8,4,2],[0,0,0,0,0,0,0,0],[null,null,null,null,null,null,null,null],[null,null,null,null,null,null,null,null],[null,null,null,null,null,null,null,null],[null,null,null,null,null,null,null,null],[1,1,1,1,1,1,1,1],[3,5,9,17,33,9,5,3]]}]}]}'; break;
				    case GameType::STANDARD_TWO_TIMELINES->value:
				        $game->StartingState = '{"TimeLines":[{"Index":-1,"Boards":[{"Squares":[[2,4,8,16,32,8,4,2],[0,0,0,0,0,0,0,0],[null,null,null,null,null,null,null,null],[null,null,null,null,null,null,null,null],[null,null,null,null,null,null,null,null],[null,null,null,null,null,null,null,null],[1,1,1,1,1,1,1,1],[3,5,9,17,33,9,5,3]]}]},{"Index":1,"Boards":[{"Squares":[[2,4,8,16,32,8,4,2],[0,0,0,0,0,0,0,0],[null,null,null,null,null,null,null,null],[null,null,null,null,null,null,null,null],[null,null,null,null,null,null,null,null],[null,null,null,null,null,null,null,null],[1,1,1,1,1,1,1,1],[3,5,9,17,33,9,5,3]]}]}]}'; break;
				    case GameType::SMALL_REGULAR->value:
				        $game->StartingState = '{"TimeLines":[{"Index":0,"Boards":[{"Squares":[[32,16,8,4,2],[0,0,0,0,0],[null,null,null,null,null],[1,1,1,1,1],[17,33,9,5,3]]}]}]}'; break;
				    case GameType::SMALL_CENTERED->value:
				        $game->StartingState = '{"TimeLines":[{"Index":0,"Boards":[{"Squares":[[2,4,32,16,2],[0,0,0,0,0],[null,null,null,null,null],[1,1,1,1,1],[3,17,33,5,3]]}]}]}'; break;
				    case GameType::SMALL_FLIPPED->value:
				        $game->StartingState = '{"TimeLines":[{"Index":0,"Boards":[{"Squares":[[4,8,2,16,32],[0,0,0,0,0],[null,null,null,null,null],[1,1,1,1,1],[33,17,3,9,5]]}]}]}'; break;
				    case GameType::SMALL_OPEN->value:
				        $game->StartingState = '{"TimeLines":[{"Index":0,"Boards":[{"Squares":[[0,2,4,8,32],[null,null,null,0,0],[null,null,null,null,null],[1,1,null,null,null],[33,9,5,3,1]]}]}]}'; break;
				    case GameType::VERY_SMALL_REGULAR->value:
				        $game->StartingState = '{"TimeLines":[{"Index":0,"Boards":[{"Squares":[[32,2,8,4],[0,0,0,0],[1,1,1,1],[33,3,9,5]]}]}]}'; break;
				    case GameType::VERY_SMALL_OPEN->value:
				        $game->StartingState = '{"TimeLines":[{"Index":0,"Boards":[{"Squares":[[4,8,2,32],[null,null,null,0],[1,null,null,null],[33,3,9,5]]}]}]}'; break;
				    case GameType::FOCUSSED_BISHOPS->value:
				        $game->StartingState = '{"TimeLines":[{"Index":0,"Boards":[{"Squares":[[null,4,4,32,null],[null,null,null,null,null],[null,null,null,null,null],[null,null,null,null,null],[null,33,5,5,null]]}]}]}'; break;
				    case GameType::FOCUSSED_DRAGONS->value:
				        $game->StartingState = '{"TimeLines":[{"Index":0,"Boards":[{"Squares":[[null,null,256,256,32],[null,null,null,null,null],[null,null,null,null,null],[null,null,null,null,null],[33,257,257,null,null]]}]}]}'; break;
				    case GameType::FOCUSSED_KINGS->value:
				        $game->StartingState = '{"TimeLines":[{"Index":0,"Boards":[{"Squares":[[null,null,32],[null,null,null],[33,null,null]]}]}]}'; break;
				    case GameType::FOCUSSED_KNIGHTS->value:
				        $game->StartingState = '{"TimeLines":[{"Index":0,"Boards":[{"Squares":[[8,null,32,8,null],[null,null,null,null,null],[null,null,null,null,null],[null,null,null,null,null],[null,9,33,null,9]]}]}]}'; break;
				    case GameType::FOCUSSED_PAWNS->value:
				        $game->StartingState = '{"TimeLines":[{"Index":0,"Boards":[{"Squares":[[0,0,0,0,32],[null,null,null,null,null],[null,null,null,null,null],[null,null,null,null,null],[33,1,1,1,1]]}]}]}'; break;
				    case GameType::FOCUSSED_QUEENS->value:
				        $game->StartingState = '{"TimeLines":[{"Index":0,"Boards":[{"Squares":[[null,16,null,32,null,null],[null,null,null,null,null,null],[null,null,null,null,null,null],[null,null,null,null,null,null],[null,null,null,null,null,null],[null,null,33,null,17,null]]}]}]}'; break;
				    case GameType::FOCUSSED_ROOKS->value:
				        $game->StartingState = '{"TimeLines":[{"Index":0,"Boards":[{"Squares":[[null,2,32,null,2],[null,null,null,null,null],[null,null,null,null,null],[null,null,null,null,null],[3,null,33,3,null]]}]}]}'; break;
				    case GameType::FOCUSSED_UNICORNS->value:
				        $game->StartingState = '{"TimeLines":[{"Index":0,"Boards":[{"Squares":[[null,128,null,128,32],[null,null,null,null,null],[null,null,null,null,null],[null,null,null,null,null],[33,129,null,129,null]]}]}]}'; break;
				    case GameType::SIMPLE_KNIGHTS_VS_BISHOPS->value:
				        $game->StartingState = '{"TimeLines":[{"Index":0,"Boards":[{"Squares":[[2,8,16,32,8,2],[0,0,0,0,0,0],[null,null,null,null,null,null],[null,null,null,null,null,null],[1,1,1,1,1,1],[3,5,17,33,5,3]]}]}]}'; break;
				    case GameType::SIMPLE_NO_QUEENS->value:
				        $game->StartingState = '{"TimeLines":[{"Index":0,"Boards":[{"Squares":[[2,4,8,32,4,8,2],[0,0,0,0,0,0,0],[null,null,null,null,null,null,null],[null,null,null,null,null,null,null],[null,null,null,null,null,null,null],[1,1,1,1,1,1,1],[3,5,9,33,5,9,3]]}]}]}'; break;
				    case GameType::SIMPLE_NO_BISHOPS->value:
				        $game->StartingState = '{"TimeLines":[{"Index":0,"Boards":[{"Squares":[[2,4,16,32,4,2],[0,0,0,0,0,0],[null,null,null,null,null,null],[null,null,null,null,null,null],[1,1,1,1,1,1],[3,5,17,33,5,3]]}]}]}'; break;
				    case GameType::SIMPLE_NO_KNIGHTS->value:
				        $game->StartingState = '{"TimeLines":[{"Index":0,"Boards":[{"Squares":[[2,8,16,32,8,2],[0,0,0,0,0,0],[null,null,null,null,null,null],[null,null,null,null,null,null],[1,1,1,1,1,1],[3,9,17,33,9,3]]}]}]}'; break;
				    case GameType::SIMPLE_NO_ROOKS->value:
				        $game->StartingState = '{"TimeLines":[{"Index":0,"Boards":[{"Squares":[[4,8,16,32,8,4],[0,0,0,0,0,0],[null,null,null,null,null,null],[null,null,null,null,null,null],[1,1,1,1,1,1],[5,9,17,33,9,5]]}]}]}'; break;
				    case GameType::SIMPLE_SIMPLE_SET->value:
				        return $this->badRequest(array("error" => "Unkown game type"));
				    case GameType::SPECIAL_EXCESSIVE->value:
				        return $this->badRequest(array("error" => "Unkown game type"));
				    case GameType::SPECIAL_GLOBAL_WARMING->value:
				        return $this->badRequest(array("error" => "Unkown game type"));
				    case GameType::SPECIAL_KING_OF_KINGS->value:
				        return $this->badRequest(array("error" => "Unkown game type"));
				    case GameType::SPECIAL_ROYAL_QUEEN_SHOWDOWN->value:
				        return $this->badRequest(array("error" => "Unkown game type"));
				    case GameType::MISC_BATTLEGROUND->value:
				        $game->StartingState = '{"TimeLines":[{"Index":-1,"Boards":[{"Squares":[[2,2,32,2,2],[4,4,16,4,4],[0,0,0,0,0],[null,null,null,null,null],[1,1,1,1,1]]}]},{"Index":0,"Boards":[{"Squares":[[8,8,8,8,8],[0,0,0,0,0],[null,null,null,null,null],[1,1,1,1,1],[9,9,9,9,9]]}]},{"Index":1,"Boards":[{"Squares":[[0,0,0,0,0],[null,null,null,null,null],[1,1,1,1,1],[5,5,17,5,5],[9,9,33,9,9]]}]}]}'; break;
				    case GameType::MISC_FORMATIONS->value:
				        $game->StartingState = '{"TimeLines":[{"Index":-1,"Boards":[{"Squares":[[0,0,0,0,0],[null,null,null,null,null],[null,null,null,null,null],[null,null,null,null,null],[null,null,33,null,null]]}]},{"Index":1,"Boards":[{"Squares":[[null,null,32,null,null],[null,null,null,null,null],[null,null,null,null,null],[null,null,null,null,null],[1,1,1,1,1]]}]}]}'; break;
				    case GameType::MISC_FRAGMENTS->value:
				        return $this->badRequest(array("error" => "Unkown game type"));
				    case GameType::MISC_INVASIONS->value:
				        return $this->badRequest(array("error" => "Unkown game type"));
				    case GameType::MISC_MARAUDERS->value:
				        return $this->badRequest(array("error" => "Unkown game type"));
				    case GameType::MISC_SKIRMISH->value:
				        return $this->badRequest(array("error" => "Unkown game type"));
				    case GameType::MISC_STRATEGOS->value:
				        $game->StartingState = '{"TimeLines":[{"Index":-1,"Boards":[{"Squares":[[4,8,32,128,2],[0,0,0,0,0],[null,null,null,null,null],[null,null,null,null,null],[null,null,null,null,null]]}]},{"Index":1,"Boards":[{"Squares":[[null,null,null,null,null],[null,null,null,null,null],[null,null,null,null,null],[1,1,1,1,1],[3,129,33,9,5]]}]}]}'; break;
				    case GameType::MISC_TACTICIAN->value:
				        $game->StartingState = '{"TimeLines":[{"Index":-1,"Boards":[{"Squares":[[32,4,8,2],[0,0,0,0],[null,null,null,null],[null,null,null,null]]}]},{"Index":1,"Boards":[{"Squares":[[null,null,null,null],[null,null,null,null],[1,1,1,1],[33,5,9,3]]}]}]}'; break;
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