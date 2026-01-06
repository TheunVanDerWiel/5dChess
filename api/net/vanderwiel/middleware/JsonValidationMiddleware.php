<?php
namespace Net\VanDerWiel\Middleware;

use Slim\App;
use Psr\Http\Message\ServerRequestInterface as Request;
use Psr\Http\Server\RequestHandlerInterface as RequestHandler;
use Psr\Http\Message\ResponseInterface as Response;
use JsonSchema\Validator as Validator;
use JsonSchema\Constraints\Constraint;
use Net\VanDerWiel\Core\DB;
use Net\VanDerWiel\models\Model;

class JsonValidationMiddleware extends BaseMiddleware
{
    private Model $jsonSchemaObject;
    
    function __construct(App $app, DB $db, Model $jsonSchemaObject) {
        parent::__construct($app, $db);
        $this->jsonSchemaObject = $jsonSchemaObject;
    }
    
    public function __invoke(Request $request, RequestHandler $handler): Response
    {
        $data = $request->getParsedBody();
        $validator = new Validator();
        
        // turn indexed array into object
        $dataObject = json_decode(json_encode($data));
        
        $validator->validate($dataObject, $this->jsonSchemaObject->getSchema(), Constraint::CHECK_MODE_COERCE_TYPES | Constraint::CHECK_MODE_APPLY_DEFAULTS);
        
        if (!$validator->isValid()) {
            return $this->badRequest(array("error" => "data validation", "details" => $validator->getErrors()));
        }
        
        $request = $request->withParsedBody((array)$dataObject);
        
        return $handler->handle($request);
    }
}
?>