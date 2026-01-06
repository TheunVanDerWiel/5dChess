<?php
namespace Net\VanDerWiel\Core;

use \PDO;

class DB {
	private $dbConnection;
	private $debug = false;

	function __construct($connectionString=null, $userName=null, $passWord=null) {
	    if ($connectionString === null) {
	        $connectionString = "mysql:dbname=".$_ENV['DB_NAME'].";host=".$_ENV['DB_HOST'].";charset=utf8";
	        $userName = $_ENV['DB_USER'];
	        $passWord = $_ENV['DB_PASSWORD'];
	    }
	    $this->dbConnection = new PDO($connectionString, $userName, $passWord);
		$this->dbConnection->setAttribute(PDO::ATTR_EMULATE_PREPARES, false);
		$this->dbConnection->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
	}
	
	public function debug($on=true) {
	    $this->debug = $on;
	}

	/**
	 * Retrieves the indicated record.
	 * @param string $table The table the record resides in.
	 * @param string[] $fields The fields to retrieve from the record.
	 * @param string $idField The identifying field.
	 * @param int $id The identifier of the record to be retrieved.
	 * @return array An array with a list containing the field/value pairs of the retrieved record if found, otherwise an empty array.
	 */
	public function retrieve($table, $fields, $idField, $id) {
		return $this->execute("select ".$idField.",".join(",", $fields)." from ".$table." where ".$idField."=?", array($id));
	}

	/**
	 * Executes the given select query with like clause.
	 * @param string $query The prepared statement to execute.
	 * @param array $likeData Data values to use with wildcards. Alphanumeric characters should be enforced.
	 * @return array An array of lists containing the field/value pairs of the retrieved records.
	 */
	public function retrieveLike($query, $likeData) {
		try {
			$preparedStatement = $this->dbConnection->prepare($query);
			for ($i = 0; $i < count($likeData); $i++) {
				$preparedStatement->bindValue($i + 1, "%".$likeData[$i]."%");
			}
			if ($preparedStatement->execute()) {
				$results = array();
				while ($result = $preparedStatement->fetch(PDO::FETCH_ASSOC)) {
					$results[] = $result;
				}
				return $results;
			} else {
				Log::error($query, $likeData);
			}
		} catch (\Throwable $e) {
			Log::error($query.' '.$e->getMessage(), $likeData);
		}
		return array();
	}
	
	/**
	 * Executes the given select query. Preferably use the higher level method retrieve.
	 * @param string $query The prepared statement to execute.
	 * @param array $data The parameters of the prepared statement.
	 * @return array An array of lists containing the field/value pairs of the retrieved records.
	 */
	public function execute($query, $data) {
		try {
			$preparedStatement = $this->dbConnection->prepare($query);
			if ($preparedStatement->execute($data)) {
				$results = array();
				while ($result = $preparedStatement->fetch(PDO::FETCH_ASSOC)) {
					$results[] = $result;
				}
				if ($this->debug) {
				    Log::error(count($results)." rows returned by ".$query, $data);
				}
				return $results;
			} else {
				Log::error($query, $data);
			}
		} catch (\Throwable $e) {
			Log::error($query.' '.$e->getMessage(), $data);
		}
		return array();
	}

	/**
	 * Inserts a single record in the indicated table.
	 * @param string $table The table to insert the record in.
	 * @param array $fields The list of fields that are present in the data.
	 * @param array $data An array with the data of the record. The ordering of the data must correspond to $fields.
	 * @return int The generated id of the inserted record, or null if failed.
	 */
	public function insert($table, $fields, $data) {
		if (!$this->insertMultiple($table, $fields, array($data))) {
			return null;
		}
		$id = $this->dbConnection->lastInsertId();
		return preg_match('/^(\d)+$/', $id) ? intval($id) : $id;
	}

	/**
	 * Inserts 0 or more records in the indicated table.
	 * @param string $table The table to insert the records in.
	 * @param array $fields The list of fields that are present in the data.
	 * @param array $data An array of arrays with the data of each record. The ordering of the data of each record must correspond to $fields.
	 * @return boolean true if the records are inserted, otherwise false.
	 */
	public function insertMultiple($table, $fields, $data) {
		if (count($data) == 0) {
			return true;
		}
		try {
			$values = array();
			foreach($data as $record) {
				$valuePlaceholders[] = "(".join(",", array_fill(0, count($fields), "?")).")";
				$values = array_merge($values, array_values($record));
			}
			$query = "insert into ".$table." (".join(",", $fields).") values ".join(",", $valuePlaceholders);
			if ($this->debug) {
			    Log::error("Executing ".$query, $values);
			}
			$preparedStatement = $this->dbConnection->prepare($query);
			if (!$preparedStatement->execute($values)) {
				Log::error($query, $values);
				return false;
			}
			return true;
		} catch (\Throwable $e) {
			Log::error($table.' '.$e->getMessage());
			return false;
		}
	}
	
	/**
	 * Updates the indicated record in the given table with the given new data.
	 * @param string $table The table in which the record subsides that should be updated
	 * @param string $idField The identifying field.
	 * @param int $id The identifier of the record to be updated.
	 * @param array $data A key/value list of fields to be updated with their new values.
	 * @return boolean true if the records are updated, otherwise false.
	 */
	public function update($table, $idField, $id, $data) {
		try {
			$keys = array();
			$values = array();
			foreach($data as $key => $value) {
			    $keys[] = '`'.$key."`=?";
			    $values[] = $value;
			}
			$values[] = $id;
			$query = "update ".$table." set ".join(",", $keys)." where ".$idField."=?";
			if ($this->debug) {
			    Log::error("Executing ".$query, $values);
			}
			$preparedStatement = $this->dbConnection->prepare($query);
			if (!$preparedStatement->execute($values)) {
				Log::error($query, $values);
				return false;
			}
			return true;
		} catch (\Throwable $e) {
			Log::error($table.' '.$e->getMessage());
			return false;
		}
	}

	/**
	 * Deletes the records with the indicated identifier from the given table.
	 * @param string $table The table to delete data from.
	 * @param string $idField The identifying field.
	 * @param array $ids A list of identifiers for the records to be deleted.
	 * @return boolean true if the records are deleted, otherwise false.
	 */
	public function delete($table, $idField, $ids) {
		try {
			$query = "delete from ".$table." where ".$idField." in (".join(",", $ids).")";
			$preparedStatement = $this->dbConnection->prepare($query);
			if ($this->debug) {
			    Log::error("Executing ".$query);
			}
			if (!$preparedStatement->execute(array())) {
				Log::error($query);
				return false;
			}
			return true;
		} catch (\Throwable $e) {
			Log::error($table.' '.$e->getMessage());
			return false;
		}
	}
	
	/**
	 * Checks if there is already a transaction going
	 */
	public function inTransaction() {
	    return $this->dbConnection->inTransaction();
	}
	
	/**
	 * Starts a new transaction.
	 */
	public function startTransaction() {
		$this->dbConnection->beginTransaction();
	}
	
	/**
	 * Commits the current transaction.
	 */
	public function commitTransaction() {
		$this->dbConnection->commit();
	}
	
	/**
	 * Rolls back the current transaction.
	 */
	public function rollbackTransaction() {
		$this->dbConnection->rollBack();
	}
}
?>