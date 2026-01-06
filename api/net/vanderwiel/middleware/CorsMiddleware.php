<?php
namespace Net\VanDerWiel\Middleware;

use Psr\Http\Message\ServerRequestInterface as Request;
use Psr\Http\Server\RequestHandlerInterface as RequestHandler;
use Psr\Http\Message\ResponseInterface as Response;

class CorsMiddleware
{
    function __construct() { }
    
    public function __invoke(Request $request, RequestHandler $handler): Response
    {
        $response = $handler->handle($request);
        return self::addHeaders($response);
    }
    
    public static function addHeaders(Response $response) {
        return $response
        ->withHeader('Access-Control-Allow-Origin', $_ENV['HOST_NAME'])
        ->withHeader('Access-Control-Allow-Credentials', 'true')
        ->withHeader('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type, Accept, Origin, Authorization, X-Session-Id, X-Referer')
        ->withHeader('Access-Control-Expose-Headers', 'X-Authorization-Token, X-File-Name')
        ->withHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD');
    }
}
?>