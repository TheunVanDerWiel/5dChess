<?php
namespace Net\VanDerWiel\Functions;

use Net\VanDerWiel\models\Model;

class InputChecks {
	const JSON_DATEFORMAT = 'Y-m-d\\TH:i:s';
	const UTC_DATETIMEFORMAT = 'Y-m-d\\TH:i:s.v\\Z';
	const DB_DATEFORMAT = 'Y-m-d';
	const DB_DATETIMEFORMAT = 'Y-m-d H:i:s';
	const DB_TIMEFORMAT = 'H:i:s';
	const DISPLAY_DATEFORMAT = 'd-m-Y';
	const DISPLAY_DATETIMEFORMAT = 'd-m-Y H:i:s';
	
	public static function fromJsonDate($dateString, $dbFormat = self::DB_DATEFORMAT) {
		// Remove browser optional milliseconds.
		$dateString = explode('.', $dateString)[0];
		$date = self::strToDate($dateString, self::JSON_DATEFORMAT);
		if ($date && $date->format(self::JSON_DATEFORMAT) === $dateString) {
		    return $date->format($dbFormat);
		}
		return null;
	}
	
	public static function validateDate($dateString, $format) {
		$dateString = "".$dateString;
		$date = self::strToDate($dateString, $format);
		return $date && $date->format($format) === $dateString;
	}
	
	public static function validateEmail($email) {
	    return preg_match('/'.Model::getEmailRegex().'/', $email);
	}
	
	public static function validatePhoneNumber($phoneNumber) {
	    return preg_match('/'.Model::getPhoneNumberRegex().'/', $phoneNumber);
	}
	
	public static function strToDate($dateString, $format) {
	    if ($dateString === null) { return null; }
	    if ($dateString instanceof \DateTime) { return $dateString; }
		return \DateTime::createFromFormat($format, $dateString);
	}
	
	public static function dateDbToUTC($dbDateTime) {
	    if ($dbDateTime === null) { return null; }
	    return self::strToDate($dbDateTime, self::DB_DATEFORMAT)->format(self::UTC_DATETIMEFORMAT);
	}
	
	public static function dateUTCToDb($utcDateTime) {
	    if ($utcDateTime === null) { return null; }
	    return self::strToDate($utcDateTime, self::UTC_DATETIMEFORMAT)->format(self::DB_DATEFORMAT);
	}
	
	public static function dateTimeDbToUTC($dbDateTime) {
	    if ($dbDateTime === null) { return null; }
	    return self::strToDate($dbDateTime, self::DB_DATETIMEFORMAT)->format(self::UTC_DATETIMEFORMAT);
	}
	
	public static function dateTimeUTCToDb($utcDateTime) {
	    if ($utcDateTime === null) { return null; }
	    return self::strToDate($utcDateTime, self::UTC_DATETIMEFORMAT)->format(self::DB_DATETIMEFORMAT);
	}
	
	public static function timeUTCToDb($utcDateTime) {
	    if ($utcDateTime === null) { return null; }
	    return self::strToDate($utcDateTime, self::UTC_DATETIMEFORMAT)->format(self::DB_TIMEFORMAT);
	}
	
	public static function checkPasswordRequiredCharacters($pw) {
	    return preg_match("/[a-z]/", $pw) + preg_match("/[A-Z]/", $pw) + preg_match("/[0-9]/", $pw) + preg_match("/[^a-zA-Z0-9]/", $pw) >= 3;
	}
	
	public static function obfuscateBankAccountNr($nr) {
	    if (!is_string($nr)) { return $nr; }
	    return substr($nr, 0, 4)." **** ** **** **".substr($nr, -2);
	}
	
	public static function textToHtml($text) {
	    return str_replace("\n", "<br/>", str_replace("\r", "", str_replace("<", "&lt;", str_replace(">", "&gt;", $text))));
	}
}
?>