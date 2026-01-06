<?php
namespace Net\VanDerWiel\Middleware;

use Psr\Http\Message\ServerRequestInterface;
use Psr\Log\LoggerInterface;
use Net\VanDerWiel\Core\Log;
use Net\VanDerWiel\Enums\StatusCode;

class ErrorHandler
{
    public static function add($app) {
        return function(
            ServerRequestInterface $request,
            \Throwable $exception,
            bool $displayErrorDetails,
            bool $logErrors,
            bool $logErrorDetails,
            ?LoggerInterface $logger = null
        ) use ($app) {
            if ($logErrors) {
                $result = "Error occurred during request processing.";
                if ($logErrorDetails) {
                    $result .= "\r\nDetails:\r\n".$exception->getFile()." ".$exception->getLine()."  ".$exception->getMessage();
                    $result .= "\r\nTrace:\r\n".$exception->getTraceAsString();
                }
                Log::error($result);
            }
            $response = $app->getResponseFactory()->createResponse(StatusCode::INTERNAL_SERVER_ERROR->value, "Fatal error");
            return CorsMiddleware::addHeaders($response);
        };
    }
}
?>