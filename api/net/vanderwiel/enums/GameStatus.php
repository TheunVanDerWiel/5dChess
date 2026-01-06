<?php
namespace Net\VanDerWiel\Enums;

enum GameStatus: string
{
    case STARTING = 'starting';
    case IN_PROGRESS = 'in_progress';
    case FINISHED = 'finished';
    case FORFEITED = 'forfeited';
    
    static function getAllAsArray() {
        return array(
            self::STARTING->value,
            self::IN_PROGRESS->value,
            self::FINISHED->value,
            self::FORFEITED->value,
        );
    }
}
?>