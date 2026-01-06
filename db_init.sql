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
  `id` int NOT NULL AUTO_INCREMENT,
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
