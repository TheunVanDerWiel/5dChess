<?php
namespace Net\VanDerWiel\Core;

abstract class Entity implements IEntity {
	protected $db;
	protected $Id;
	
	protected $retrieved = false;
	protected $isDeleted = false;
	
	function __construct(DB $db) {
		$this->db = $db;
	}
	
	public static function mockUp(DB $db, $id) {
		$entity = new static($db);
		$entity->Id = $id;
		return $entity;
	}
	
	/**
	 * Haalt een entiteit op uit de database obv de Id.
	 * @param Integer $id De Id.
	 * @return boolean true indien de entiteit is opgehaald, anders false.
	 */
	public function retrieve($id) {
	    $result = $this->db->retrieve($this->getTable(), self::escapeFields($this->getFields()), $this->getIdField(), $id);
		if (count($result) !== 1) {
			return false;
		}
		return $this->fromData($result[0]);
	}
	
	/**
	 * @param integer $id
	 * @param array $caches
	 * @return boolean
	 */
	public function retrieveWithDetails($id, $caches = array()) {
		return $this->retrieve($id) && $this->retrieveDetails($caches);
	}
	
	/**
	 * @param array $caches
	 * @return boolean
	 */
	public function retrieveDetails($caches = array()) {
		return true;
	}

	/**
	 * @param array $caches indexed array of EntityLists
	 * @param string $cache index
	 * @param integer $id the Id of the Entity to look for
	 * @param Entity $entity
	 * @return boolean
	 */
	protected function retrieveFromCache($caches, $cache, $id, &$entity) {
	    if (!isset($caches[$cache])) {
	        return $entity->retrieve($id);
	    }
	    
	    $result = $caches[$cache]->locateById($id);
	    if ($result !== null) {
	        $entity = $result;
	        return true;
	    }
	    return false;
	}
	
	/**
	 * Voert de insert/update/delete operatie uit afhankelijk van de state van deze Entiteit
	 * @return boolean
	 */
	public function save() {
		if ($this->isMarkedForDelete()) {
			return $this->delete();
		}
		if (!$this->retrieved) {
			return $this->insert();
		}
		return $this->update();
	}
	
	/**
	 * Voegt de entiteit toe aan de database.
	 * @return boolean
	 */
	public function insert() {
		if ($this->Id !== null) { return false; }
		$result = $this->db->insert($this->getTable(), self::escapeFields($this->getFields()), $this->getDBData());
		if ($result === null) {
			return false;
		}
		$this->Id = $result;
		$this->retrieved = true;
		return true;
	}
	
	/**
	 * Verwerkt de wijzigingen aan de entiteit in de database.
	 * @return boolean
	 */
	public function update() {
	    if ($this->Id === null) { return false; }
		$data = array();
		for ($i = 0; $i < count($this->getFields()); $i++) {
			$data[$this->getFields()[$i]] = $this->getDBData()[$i];
		}
		return $this->db->update($this->getTable(), $this->getIdField(), $this->Id, $data);
	}
	
	/**
	 * Verwijdert de entiteit uit de database.
	 * @return boolean
	 */
	public function delete() {
	    if (!$this->retrieved) { return false; }
		if (!$this->db->delete($this->getTable(), $this->getIdField(), array($this->Id))) {
			return false;
		}
		$this->retrieved = false;
		$this->Id = null;
		return true;
	}

	/**
	 * Markeert deze entiteit om te worden verwijderd bij de save
	 * @param boolean $removeMark Of de markering verwijderd (true) of toegevoegd (false = default) moet worden.
	 */
	public function markForDelete($removeMark = false) {
		$this->isDeleted = !$removeMark;
	}
	
	/**
	 * Geeft aan of deze entitieit is gemarkeerd om te worden verwijderd.
	 * @return boolean
	 */
	public function isMarkedForDelete() {
		return $this->isDeleted;
	}
	
	/**
	 * Vertaalt de entiteit naar een json object array.
	 * @return [string => mixed]
	 */
	public function toJson() {
		$json = array();
		$json[$this->getIdField()] = $this->Id;
		$data = $this->getRealData();
		for ($i = 0; $i < count($this->getFields()); $i++) {
			$json[$this->getFields()[$i]] = $data[$i];
		}
		return $json;
	}
	
	/**
	 * @return string
	 */
	abstract protected function getTable();
	
	/**
	 * @return [string]
	 */
	abstract protected function getFields();
	
	/**
	 * @param [string] $fields
	 * @return [string] fields escaped with ``
	 */
	public static function escapeFields($fields) {
	    return array_map(function($f) { return '`'.$f.'`'; }, $fields);
	}
	
	/**
	 * @return string
	 */
	protected function getIdField() { return "Id"; }

	/**
	 * Haalt de data op zoals gerepresenteerd in de DB (bv boolean = 1/0 ipv true/false)
	 * @return [string => mixed]
	 */
	abstract protected function getDBData();
	
	/**
	 * @return [string => mixed]
	 */
	protected function getRealData() { return $this->getDBData(); }
	
	/**
	 * Vertaalt een queryresultaatrij naar de entiteitvelden.
	 * @param array $data
	 * @return boolean
	 */
	public function fromData($data) {
		$this->Id = $data[$this->getIdField()];
		$this->retrieved = true;
		return true;
	}
	
	/**
	 * @return integer
	 */
	public function getId() {
		return $this->Id;
	}

	/**
	 * Geeft aan of deze entitieit al is opgehaald uit de DB
	 * @return boolean
	 */
	public function isRetrieved() {
		return $this->retrieved;
	}
}

interface IOwnableEntity {
    /**
     * Checks if this entity is owned by the given user
     * @param integer $userId the id of the user
     * @return boolean true if $this is owned by $userId
     */
    public function isOwnedBy($userId);
    
    /**
     * Retrieves the entity along with any information needed to determine ownership
     * @param integer $id
     * @return boolean true if the entity is succesfully retrieved
     */
    public function retrieveForAuthorization($id);
}
?>