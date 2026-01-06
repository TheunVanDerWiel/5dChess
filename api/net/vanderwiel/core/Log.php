<?php
namespace Net\VanDerWiel\Core;

use Net\VanDerWiel\Functions\InputChecks;

class Log {
	public static function error($message, $data = null) {
	    $logFile = $_ENV['LOG_PATH'].'error.log';
	    
	    if (filesize($logFile) > 2 * 1024 * 1024) {
	        rename($logFile, $logFile.".bak");
		}
		$now = \DateTime::createFromFormat('U.u', number_format(microtime(true), 6, '.', ''));
		error_log($now->format("Y-m-d H:i:s.u")."\t".$message."\r\n", 3, $logFile);
		if ($data !== null) {
		    if ($data instanceof \Throwable) {
		        $data = array("Message" => $data->getMessage(), "Location" => $data->getFile()." line ".$data->getLine(), "Trace" => mb_strimwidth($data->getTraceAsString(), 0, 2000));
		    }
		    ob_start();
		    print_r($data);
		    $result = ob_get_clean();
		    error_log($result."\r\n", 3, $logFile);
		}
	}
}
?>