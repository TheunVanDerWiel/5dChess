<?php
namespace Net\VanDerWiel\Middleware;

use Psr\Http\Message\ResponseInterface as Response;
use Net\VanDerWiel\Core\DB;
use Slim\App;
use Net\VanDerWiel\Core\Log;
use Net\VanDerWiel\Enums\StatusCode;

class BaseMiddleware {
    
    protected App $app;
    protected DB $db;
    protected $entityId = null;
    
    function __construct(App $app, DB $db) {
        $this->app = $app;
        $this->db = $db;
    }
    
    /**
     * Writes the result to the response
     * @param StatusCode $statusCode
     * @param object $content
     * @return Response
     */
    private function writeResponse($statusCode, $content) {
        $response = $this->app->getResponseFactory()->createResponse($statusCode->value);
        $response->getBody()->write(json_encode($content));
        return $response->withHeader('Content-Type', 'application/json');
    }
    
    /**
     * Creates a 200 OK response
     * @param array $result
     * @return Response
     */
    protected function ok($result = array()) {
        return $this->writeResponse(StatusCode::OK, $result);
    }
    
    /**
     * Creates a 400 BAD REQUEST response
     * @param array $result
     * @return Response
     */
    protected function badRequest($result = array()) {
        Log::error("A bad request was returned.", $result);
        return $this->writeResponse(StatusCode::BAD_REQUEST, $result);
    }
    
    /**
     * Creates a 401 UNAUTHORIZED response
     * @param array $result
     * @return Response
     */
    protected function unauthorized($result = array()) {
        return $this->writeResponse(StatusCode::UNAUTHORIZED, $result);
    }
    
    /**
     * Creates a 403 FORBIDDEN response
     * @param array $result
     * @return Response
     */
    protected function forbidden($result = array()) {
        return $this->writeResponse(StatusCode::FORBIDDEN, $result);
    }
    
    /**
     * Creates a 404 NOT FOUND response
     * @param array $result
     * @return Response
     */
    protected function notFound($result = array()) {
        return $this->writeResponse(StatusCode::NOT_FOUND, $result);
    }
    
    /**
     * Creates a 500 INTERNAL SERVER response
     * @param array $result
     * @return Response
     */
    protected function internalServerError($result = array()) {
        Log::error("An internal server error was returned.", array($result, (new \Exception)->getTraceAsString()));
        return $this->writeResponse(StatusCode::INTERNAL_SERVER_ERROR, $result);
    }
}
?>