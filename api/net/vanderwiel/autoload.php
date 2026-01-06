<?php
spl_autoload_register(function ($class) {
    if (str_starts_with($class, 'Net\\VanDerWiel')) {
		$lclass = str_replace('\\', '/', $class);
		$folder = strtolower(substr($lclass, 14, strrpos($lclass, '/')-strlen($lclass)));
		$file = substr($lclass, strrpos($lclass, '/'));
        include __DIR__.$folder.$file.'.php';
    }
});
?>