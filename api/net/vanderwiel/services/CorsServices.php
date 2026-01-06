<?php
namespace Net\VanDerWiel\Services;

use Psr\Http\Message\ServerRequestInterface as Request;
use Psr\Http\Message\ResponseInterface as Response;
use Net\VanDerWiel\Middleware\BaseMiddleware;

class CorsServices extends BaseMiddleware {
    public function register() {
        $this->app->options('/{routes:.+}', function (Request $request, Response $response, $args) {
            return $this->ok();
        });
        
        $this->app->map(['GET', 'POST', 'PUT', 'DELETE', 'PATCH'], '/{routes:.+}', function (Request $request, Response $response) {
            return $this->notFound();
        });
    }
}
?>