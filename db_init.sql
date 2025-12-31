-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1:3306
-- Gegenereerd op: 31 dec 2025 om 13:23
-- Serverversie: 9.1.0
-- PHP-versie: 8.3.14

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `5dchess`
--

-- --------------------------------------------------------

--
-- Tabelstructuur voor tabel `game`
--

DROP TABLE IF EXISTS `game`;
CREATE TABLE IF NOT EXISTS `game` (
  `id` int NOT NULL,
  `player1` varchar(64) COLLATE utf8mb4_unicode_520_ci NOT NULL,
  `player2` varchar(64) COLLATE utf8mb4_unicode_520_ci DEFAULT NULL,
  `starting_state` text COLLATE utf8mb4_unicode_520_ci NOT NULL,
  `starting_player` tinyint(1) NOT NULL,
  `moves` text COLLATE utf8mb4_unicode_520_ci NOT NULL,
  `active_player` tinyint(1) NOT NULL,
  `status` enum('starting','in_progress','finished','forfeited') COLLATE utf8mb4_unicode_520_ci NOT NULL DEFAULT 'starting',
  `winner_player` tinyint(1) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_520_ci;

--
-- Gegevens worden geëxporteerd voor tabel `game`
--

INSERT INTO `game` (`id`, `player1`, `player2`, `starting_state`, `starting_player`, `moves`, `active_player`, `status`, `winner_player`) VALUES
(123456, 'l954eyw8d1h0cy159a2ysnd8bew5cbm2ke4of3fv4xz1vieq3d3xm6tr9m8vklmd', NULL, '{\"TimeLines\":[[{\"Squares\":[[2,3,4,5,6,4,3,2],[1,1,1,1,1,1,1,1],[null,null,null,null,null,null,null,null],[null,null,null,null,null,null,null,null],[null,null,null,null,null,null,null,null],[null,null,null,null,null,null,null,null],[13,13,13,13,13,13,13,13],[14,15,16,18,17,16,15,14]]}]]}', 1, '[]', 1, 'starting', NULL);

-- --------------------------------------------------------

--
-- Stand-in structuur voor view `user`
-- (Zie onder voor de actuele view)
--
DROP VIEW IF EXISTS `user`;
CREATE TABLE IF NOT EXISTS `user` (
`user_id` varchar(64)
);

-- --------------------------------------------------------

--
-- Structuur voor de view `user`
--
DROP TABLE IF EXISTS `user`;

DROP VIEW IF EXISTS `user`;
CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `user` (`user_id`) AS   select distinct `users`.`user_id` AS `user_id` from (select `game`.`player1` AS `user_id` from `game` union all select `game`.`player2` AS `user_id` from `game`) `users`  ;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
