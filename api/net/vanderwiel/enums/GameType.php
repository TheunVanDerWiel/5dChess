<?php
namespace Net\VanDerWiel\Enums;

enum GameType: int
{
    case RANDOM = 0;
    case STANDARD_REGULAR = 10;
    case STANDARD_HALF_REFLECTED = 11;
    case STANDARD_DEFENDED_PAWN = 12;
    case STANDARD_PRINCESS = 13;
    case STANDARD_TURN_ZERO = 14;
    case STANDARD_TWO_TIMELINES = 15;
    case STANDARD_REVERSED_ROYALTY = 16;
    case SIMPLE_NO_BISHOPS = 20;
    case SIMPLE_NO_KNIGHTS = 21;
    case SIMPLE_NO_ROOKS = 22;
    case SIMPLE_NO_QUEENS = 23;
    case SIMPLE_KNIGHTS_VS_BISHOPS = 24;
    case SIMPLE_SIMPLE_SET = 25;
    case SMALL_REGULAR = 30;
    case SMALL_FLIPPED = 31;
    case SMALL_CENTERED = 32;
    case SMALL_OPEN = 33;
    case VERY_SMALL_REGULAR = 40;
    case VERY_SMALL_OPEN = 41;
    case MISC_INVASIONS = 50;
    case MISC_FORMATIONS = 51;
    case MISC_TACTICIAN = 52;
    case MISC_STRATEGOS = 53;
    case MISC_BATTLEGROUND = 54;
    case MISC_SKIRMISH = 55;
    case MISC_FRAGMENTS = 56;
    case MISC_MARAUDERS = 57;
    case SPECIAL_EXCESSIVE = 60;
    case SPECIAL_GLOBAL_WARMING = 61;
    case SPECIAL_KING_OF_KINGS = 62;
    case SPECIAL_ROYAL_QUEEN_SHOWDOWN = 63;
    case FOCUSSED_KNIGHTS = 70;
    case FOCUSSED_BISHOPS = 71;
    case FOCUSSED_ROOKS = 72;
    case FOCUSSED_QUEENS = 73;
    case FOCUSSED_PAWNS = 74;
    case FOCUSSED_KINGS = 75;
    case FOCUSSED_UNICORNS = 76;
    case FOCUSSED_DRAGONS = 77;
    case FOCUSSED_BRAWNS = 78;
    
    static function getAllAsArray() {
        return array(
            self::RANDOM->value,
            self::STANDARD_REGULAR->value,
            self::STANDARD_HALF_REFLECTED->value,
            self::STANDARD_DEFENDED_PAWN->value,
            self::STANDARD_REVERSED_ROYALTY->value,
            self::STANDARD_PRINCESS->value,
            self::STANDARD_TURN_ZERO->value,
            self::STANDARD_TWO_TIMELINES->value,
            self::SIMPLE_NO_BISHOPS->value,
            self::SIMPLE_NO_KNIGHTS->value,
            self::SIMPLE_NO_ROOKS->value,
            self::SIMPLE_NO_QUEENS->value,
            self::SIMPLE_KNIGHTS_VS_BISHOPS->value,
            self::SIMPLE_SIMPLE_SET->value,
            self::SMALL_REGULAR->value,
            self::SMALL_FLIPPED->value,
            self::SMALL_CENTERED->value,
            self::SMALL_OPEN->value,
            self::VERY_SMALL_REGULAR->value,
            self::VERY_SMALL_OPEN->value,
            self::MISC_INVASIONS->value,
            self::MISC_FORMATIONS->value,
            self::MISC_TACTICIAN->value,
            self::MISC_STRATEGOS->value,
            self::MISC_BATTLEGROUND->value,
            self::MISC_SKIRMISH->value,
            self::MISC_FRAGMENTS->value,
            self::MISC_MARAUDERS->value,
            self::SPECIAL_EXCESSIVE->value,
            self::SPECIAL_GLOBAL_WARMING->value,
            self::SPECIAL_KING_OF_KINGS->value,
            self::SPECIAL_ROYAL_QUEEN_SHOWDOWN->value,
            self::FOCUSSED_KINGS->value,
            self::FOCUSSED_BISHOPS->value,
            self::FOCUSSED_ROOKS->value,
            self::FOCUSSED_QUEENS->value,
            self::FOCUSSED_PAWNS->value,
            self::FOCUSSED_KINGS->value,
            self::FOCUSSED_UNICORNS->value,
            self::FOCUSSED_DRAGONS->value,
            self::FOCUSSED_BRAWNS->value
        );
    }
}
?>