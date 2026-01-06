<?php
namespace Net\VanDerWiel\Core;

class DynamicEntity implements IEntity {
	protected $Fields = [];
	protected $Details = [];
	protected $IdField;
	
	function __construct($data, $idField) {
	    $this->Fields = $data;
	    $this->IdField = $idField;
	}
	
	public function getId() {
	    return $this->Fields[$this->IdField];
	}
	
	public function get($fieldName) {
	    return array_key_exists($fieldName, $this->Fields) ? $this->Fields[$fieldName] : null;
	}
	
	public function toJson() {
	    $json = clone ($this->Fields);
	    foreach ($this->Details as $key => $data) {
	        $json[$key] = $data->toJson();
	    }
		return $json;
	}
	
    public function isMarkedForDelete() {
        return false;
    }
    
    public function addDetails($relationName, $entityOrList) {
        $this->Details[$relationName] = $entityOrList;
    }
}
?>