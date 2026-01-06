<?php
namespace Net\VanDerWiel\Core;

abstract class EntityList {
	protected $db;
	protected $entities = array();
	protected $idMap = array();
	protected $isDynamic = false;
	
	function __construct(DB $db) {
		$this->db = $db;
	}
	
	/**
	 * Vult deze lijst met entiteiten uit de database
	 * @param string $condition De where clause met condities waaraan de op te halen entiteiten moeten voldoen.
	 * @param array $data De data indien de conditie prepared statement variabelen bevat.
	 * @param string $ordering De te gebruiken sortering.
	 * @return boolean
	 */
	public function retrieve($condition = null, $data = array(), $ordering = null) {
 		$this->entities = array();
 		$this->idMap = array();
 		$this->isDynamic = false;
 		$query = "select ".$this->getIdField().",".join(",", Entity::escapeFields($this->getFields()))." from ".$this->getTable();
 		if (!empty($condition)) {
 			$query .= " where ".$condition;
		}
	 	if (!empty($ordering)) {
 			$query .= " order by ".$ordering;
		}
		$results = $this->db->execute($query, $data);
		foreach ($results as $result) {
			$this->add($this->createInstance($result));
		}
		return true;
	}
	
	/**
	 * @param array $caches
	 * @return boolean
	 */
	public function retrieveDetails($caches = array()) {
	    foreach ($this->entities as $entity) {
	        if (!$entity->retrieveDetails($caches)) {
	            return false;
	        }
	    }
	    return true;
	}
	
	/**
	 * @param array $caches
	 * @param string $condition
	 * @param array $data
	 * @param string $ordering
	 * @return boolean
	 */
	public function retrieveWithDetails($caches = array(), $condition = null, $data = array(), $ordering = null) {
		return $this->retrieve($condition, $data, $ordering) && $this->retrieveDetails($caches);
	}
	
	/**
	 * Checks if there is a cache available and if so filters the cache into this list.
	 * @param array $caches
	 * @param string $filterField The name of the field to filter on
	 * @param string $filterValue The value to filter on
	 */
	public function loadFromCache($caches, $filterField, $filterValue) {
	    if (isset($caches[$this->getTable()])) {
	        foreach ($caches[$this->getTable()]->all() as $entity) {
	            if ($entity->{$filterField} === $filterValue) {
	                $this->add($entity);
	            }
	        }
	        return true;
	    }
	    return false;
	}
	
	/**
	 * Voegt alle insert/update/delete operaties uit op de entiteiten in deze lijst
	 * @return boolean
	 */
	public function save() {
	    if ($this->isDynamic) { throw new \Exception("Cannot save dynamic entities"); }
	    $inTransaction = $this->db->inTransaction();
	    $inTransaction || $this->db->startTransaction();
	    foreach ($this->entities as $entity) {
			if (!$entity->save()) {
			    $inTransaction || $this->db->rollbackTransaction();
			    return false;
			}
		}
		$inTransaction || $this->db->commitTransaction();
		return true;
	}
	
	/**
	 * Voegt alle entiteiten in deze lijst toe aan de database.
	 * @return boolean
	 */
	public function insert() {
	    if ($this->isDynamic) { throw new \Exception("Cannot insert dynamic entities"); }
	    $inTransaction = $this->db->inTransaction();
	    $inTransaction || $this->db->startTransaction();
		foreach ($this->entities as $entity) {
			if ($entity->getId() == null && !$entity->insert()) {
			    $inTransaction || $this->db->rollbackTransaction();
			    return false;
			}
		}
		$inTransaction || $this->db->commitTransaction();
		return true;
	}
	
	/**
	 * Werkt alle entiteiten in deze lijst bij in de database.
	 * @return boolean
	 */
	public function update() {
	    if ($this->isDynamic) { throw new \Exception("Cannot update dynamic entities"); }
	    $inTransaction = $this->db->inTransaction();
	    $inTransaction || $this->db->startTransaction();
	    foreach ($this->idMap as $entity) {
			if ($entity->isMarkedForDelete() && !$entity->delete()) {
			    $inTransaction || $this->db->rollbackTransaction();
			    return false;
			} else if (!$entity->update()) {
			    $inTransaction || $this->db->rollbackTransaction();
			    return false;
			}
		}
		$inTransaction || $this->db->commitTransaction();
		return true;
	}
	
	/**
	 * Verwijdert alle entiteiten in deze lijst uit de database.
	 * @return boolean
	 */
	public function delete() {
	    if ($this->isDynamic) { throw new \Exception("Cannot delete dynamic entities"); }
	    $inTransaction = $this->db->inTransaction();
	    $inTransaction || $this->db->startTransaction();
	    $ids = array();
		foreach ($this->idMap as $entity) {
			$ids[] = $entity->getId();
		}
		if (count($ids) > 0 && !$this->db->delete($this->getTable(), $this->getIdField(), $ids)) {
		    $inTransaction || $this->db->rollbackTransaction();
		    return false;
	    }
	    $inTransaction || $this->db->commitTransaction();
	    return true;
	}
	
	/**
	 * Markeert alle entiteiten in deze lijst voor delete bij de save
	 */
	public function markForDelete() {
	    if ($this->isDynamic) { throw new \Exception("Cannot mark dynamic entities"); }
	    foreach ($this->idMap as $entity) {
			$entity->markForDelete();
		}
	}

	/**
	 * Voegt de entiteit toe aan deze lijst.
	 * @param IEntity $entity De entiteit. Het type van de entiteit moet overeenkomen met dat van deze lijst.
	 * @return true als de entiteit is toegevoegd aan deze lijst, anders false.
	 */
	public function add(IEntity $entity) {
	    $this->entities[] = $entity;
		if ($entity->getId() !== null) {
			$this->idMap[$entity->getId()] = $entity;
		}
		return true;
	}
	
	/**
	 * Verwijdert de entiteit toe aan deze lijst. Let op; gebruik delete om de entitieit ook te verwijderen in de database
	 * @param int $entityId De id van de te verwijderen entiteit.
	 */
	public function remove($entityId) {
	    unset($this->idMap[$entityId]);
	    for ($i = 0; $i < count($this->entities); $i++) {
	        if ($this->entities[$i]->getId() === $entityId) {
	            array_splice($this->entities, $i--, 1);
	        }
	    }
	}
	
	/**
	 * Verwijdert alle entiteiten die niet aanwezig zijn in de DB uit deze lijst.
	 */
	public function clean() {
	    for ($i = 0; $i < count($this->entities); $i++) {
	        if (!$this->entities[$i]->isRetrieved()) {
	            array_splice($this->entities, $i--, 1);
	        }
	    }
	}
	
	/**
	 * Vertaalt deze lijst met entiteiten naar een json array.
	 * @return [[string => mixed]]
	 */
	public function toJson() {
		$json = array();
		foreach ($this->entities as $entity) {
		    if (!$entity->isMarkedForDelete()) {
			    $json[] = $entity->toJson();
		    }
		}
		return $json;
	}
	
	/**
	 * @return ($this->isDynamic ? DynamicEntity[] : Entity[])
	 */
	public function all() {
		return $this->entities;
	}
	
	/**
	 * @param integer $id
	 * @return IEntity or null if it doesn't exist
	 */
	public function locateById($id) {
		return array_key_exists($id, $this->idMap) ? $this->idMap[$id] : null;
	}
	
	/**
	 * @return array List of ids of the entities
	 */
	public function getIdList() {
	    return array_keys($this->idMap);
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
	 * @return string
	 */
	protected function getIdField() { return "Id"; }
	
	/**
	 * Maakt een nieuwe entiteit aan van het type van deze lijst op basis van een queryresultaatrij.
	 * @param [string => mixed] $data De queryresultaatrij.
	 * @return Entity
	 */
	abstract protected function createInstance($data);
}
?>