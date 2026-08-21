<?php
namespace Net\VanDerWiel\models;

use Net\VanDerWiel\Enums\GameType;

enum Model {
    case GAME_ADD_REQUEST;
    case GAME_JOIN_REQUEST;
    case GAME_EDIT_REQUEST;
    case GAME_FINISH_REQUEST;
    
    function getSchema() {
        return match($this) {
            self::GAME_ADD_REQUEST => (object)[
                "type" => "object",
                "properties" => (object)[
                    "UserId" => (object)[ "type" => "string", "length"=> 64 ],
                    "Type" => (object)[ "type" => "integer", "enum"=> GameType::getAllAsArray() ]
                ],
                "required" => [ "UserId", "Type" ]
            ],
            self::GAME_JOIN_REQUEST => (object)[
                "type" => "object",
                "properties" => (object)[
                    "UserId" => (object)[ "type" => "string", "length"=> 64 ]
                ],
                "required" => [ "UserId" ]
            ],
            self::GAME_FINISH_REQUEST => (object)[
                "type" => "object",
                "properties" => (object)[
                    "UserId" => (object)[ "type" => "string", "length"=> 64 ],
                    "Drawn" => (object)[ "type" => "boolean" ]
                ],
                "required" => [ "UserId", "Drawn" ]
            ],
            self::GAME_EDIT_REQUEST => (object)[
                "type" => "object",
                "properties" => (object)[
                    "UserId" => (object)[ "type" => "string", "length"=> 64 ],
                    "Move" => (object)[
                        "type" => "object",
                        "properties" => (object)[
                            "Pieces" => (object)[ "type" => "array", "items" => (object)[
                                "type" => "object",
                                "properties" => (object)[
                                    "FromLocation" => (object)[ "type" => "object",
                                        "properties" => (object)[
                                            "Line" => (object)[ "type" => "integer" ],
                                            "Time" => (object)[ "type" => "integer" ],
                                            "X" => (object)[ "type" => "integer" ],
                                            "Y" => (object)[ "type" => "integer" ]
                                        ],
                                        "required"=> [ "Line", "Time", "X", "Y" ]
                                    ],
                                    "ToLocation" => (object)[ "type" => "object",
                                        "properties" => (object)[
                                            "Line" => (object)[ "type" => "integer" ],
                                            "Time" => (object)[ "type" => "integer" ],
                                            "X" => (object)[ "type" => "integer" ],
                                            "Y" => (object)[ "type" => "integer" ]
                                        ],
                                        "required"=> [ "Line", "Time", "X", "Y" ]
                                    ],
                                    "Promotion" => (object)[ "type" => "integer" ]
                                ],
                                "required" => [ "FromLocation", "ToLocation" ]
                            ]
                        ] ],
                        "required" => [ "Pieces" ]
                    ]
                ],
                "required" => [ "UserId", "Move" ]
            ]
        };
    }
}
?>