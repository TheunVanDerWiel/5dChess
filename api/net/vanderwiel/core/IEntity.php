<?php
namespace Net\VanDerWiel\Core;

interface IEntity {
    /**
     * Geeft de id van de entiteit terug
	 * @return int
     */
    public function getId();
    
	/**
	 * Geeft aan of deze entitieit is gemarkeerd om te worden verwijderd.
	 * @return boolean
	 */
	public function isMarkedForDelete();
	
	/**
	 * Vertaalt de entiteit naar een json object array.
	 * @return [string => mixed]
	 */
	public function toJson();
}
?>