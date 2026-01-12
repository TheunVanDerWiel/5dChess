<?php
namespace Net\VanDerWiel\Functions;

use Net\VanDerWiel\Core\DB;
use Net\VanDerWiel\Entities\Game;
use Net\VanDerWiel\Core\Log;

class MoveWebSocket extends \Thread {
    private DB $db;
    private $client;
    private $gameId;
    private $currentMove;
    
    public function __construct($gameId, $currentMove) {
        $this->db = new DB();
        $this->gameId = $gameId;
        $this->currentMove = $currentMove;
        
        $server = socket_create(AF_INET, SOCK_STREAM, SOL_TCP);
        socket_set_option($server, SOL_SOCKET, SO_REUSEADDR, 1);
        socket_bind($server, $_ENV["API_ADDRESS"], $_ENV["API_PORT"]);
        socket_listen($server);
        $this->client = socket_accept($server);
        
        // Send WebSocket handshake headers.
        $request = socket_read($this->client, 5000);
        $matches = [];
        preg_match('#Sec-WebSocket-Key: (.*)\r\n#', $request, $matches);
        $key = base64_encode(pack(
            'H*',
            sha1($matches[1] . '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')
            ));
        $headers = "HTTP/1.1 101 Switching Protocols\r\n";
        $headers .= "Upgrade: websocket\r\n";
        $headers .= "Connection: Upgrade\r\n";
        $headers .= "Sec-WebSocket-Version: 13\r\n";
        $headers .= "Sec-WebSocket-Accept: $key\r\n\r\n";
        socket_write($this->client, $headers, strlen($headers));
    }
    
    public function run() {
        try {
            while (true) {
                sleep(1);
    
                $nextMove = $this->getNextMove();
                if ($nextMove !== null) {
                    $content = json_encode($nextMove);
                    $response = chr(129) . chr(strlen($content)) . $content;
                    socket_write($this->client, $response);
                    $this->currentMove++;
                }
            }
        } catch (\Throwable $ex) {
            Log::error("Unexpected exception ocurred, closing socket", $ex);
        }
    }
    
    private function getNextMove() {
        $game = new Game($this->db);
        if (!$game->retrieve($this->gameId)) {
            throw new \Exception("Coould not retrieve game");
        }
        
        $moves = json_decode($game->Moves);
        if (is_array($moves) && count($moves) > $this->currentMove) {
            return $moves[$this->currentMove];
        }
        return null;
    }
}
?>