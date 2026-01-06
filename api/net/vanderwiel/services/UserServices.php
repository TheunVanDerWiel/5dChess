<?php
namespace Net\VanDerWiel\Services;

use Psr\Http\Message\ServerRequestInterface as Request;
use Psr\Http\Message\ResponseInterface as Response;
use Slim\Routing\RouteCollectorProxy;
use Net\VanDerWiel\Middleware\BaseMiddleware;
use Net\VanDerWiel\Entities\GameList;

class UserServices extends BaseMiddleware
{

    public function register()
    {
        $this->app->group('/api/users', function (RouteCollectorProxy $group) {
            /**
             * Add a user
             */
            $group->post('', function (Request $request, Response $response) {
                $chars = "abcdefghijklmnopqrstuvwxyz0123456789";
                $length = 64;
                do {
                    $newUserId = substr(str_shuffle(str_repeat($chars, $length)), 0, $length);

                    $list = new GameList($this->db);
                    $list->retrieve("player1=? or player2=?", array(
                        $newUserId,
                        $newUserId
                    ));
                    $found = count($list->all()) > 0;
                } while ($found);

                return $this->ok($newUserId);
            });
        });
    }
}
?>