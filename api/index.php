<?php
require_once __DIR__.'/../vendor/autoload.php';
require_once __DIR__.'/net/vanderwiel/autoload.php';

use Slim\Factory\AppFactory;
use Slim\Factory\ServerRequestCreatorFactory;
use Symfony\Component\Dotenv\Dotenv as Dotenv;
use Slim\ResponseEmitter;
use Net\VanDerWiel\Core\DB;
use Net\VanDerWiel\Core\Log;
use Net\VanDerWiel\Middleware\CorsMiddleware;
use Net\VanDerWiel\Services\GameServices;
use Net\VanDerWiel\Services\UserServices;
use Net\VanDerWiel\Services\CorsServices;
use Net\VanDerWiel\Middleware\ErrorHandler;
use Net\VanDerWiel\Enums\StatusCode;

$dotenv = new Dotenv();
$dotenv->load(__DIR__.'/.env');

$db = new DB();
$app = AppFactory::create();

try {
    // Add middleware
    $app->addBodyParsingMiddleware();
    $app->addRoutingMiddleware();
    $app->add(CorsMiddleware::class);
    
    // Prepare the request for lazy loading
    $serverRequestCreator = ServerRequestCreatorFactory::create();
    $request = $serverRequestCreator->createServerRequestFromGlobals();
    $basePath = substr($request->getUri(), 0, strpos($request->getUri(), '/api/'));
    $module = substr($request->getUri(), strlen($basePath)+5);
    foreach (['/','?'] as $char) {
        if (($pos = strpos($module, $char)) > 0) { $module = strtolower(substr($module, 0, $pos)); }
    }
    
    // Define app routes (based on the URI for performance reasons)
    $app->setBasePath(substr($basePath, ($pos = strpos($basePath, "/", 8)) === false ? strlen($basePath) : $pos));
    if ($request->getMethod() === 'OPTIONS') {
        (new CorsServices($app, $db))->register();
    } else {
        switch ($module) {
            case 'users':
                (new UserServices($app, $db))->register(); break;
            case 'games':
                (new GameServices($app, $db))->register(); break;
            default:
                Log::error("Unkown api module: ".$module);
        }
    }
    
    $errorMiddleware = $app->addErrorMiddleware(false, true, true);
    $errorMiddleware->setDefaultErrorHandler(ErrorHandler::add($app));
    
    // Handle the request.
    $app->run($request);
} catch(Throwable $err) {
    Log::error("Fatal error during request processing.", $err);
    $response = $app->getResponseFactory()->createResponse(StatusCode::INTERNAL_SERVER_ERROR->value, "Fatal error");
    $responseEmitter = new ResponseEmitter();
    $responseEmitter->emit(CorsMiddleware::addHeaders($response));
}
?>