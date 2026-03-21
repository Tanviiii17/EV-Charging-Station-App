/*
SQLyog Enterprise - MySQL GUI v6.56
MySQL - 5.0.67-community-nt : Database - electric_vehicle
*********************************************************************
*/

/*!40101 SET NAMES utf8 */;

/*!40101 SET SQL_MODE=''*/;

/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;

CREATE DATABASE /*!32312 IF NOT EXISTS*/`electric_vehicle` /*!40100 DEFAULT CHARACTER SET latin1 */;

USE `electric_vehicle`;

/*Table structure for table `admin` */

DROP TABLE IF EXISTS `admin`;

CREATE TABLE `admin` (
  `id` int(11) NOT NULL auto_increment,
  `name` text,
  `email` text,
  `mobile` text,
  `address` text,
  `username` text,
  `password` text,
  `date` text,
  PRIMARY KEY  (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=latin1;

/*Data for the table `admin` */

insert  into `admin`(`id`,`name`,`email`,`mobile`,`address`,`username`,`password`,`date`) values (1,'kishan','kishan@gmail.com','01234567890','hyd','kishan','123','2021-02-09 22:17:59');

/*Table structure for table `bunk` */

DROP TABLE IF EXISTS `bunk`;

CREATE TABLE `bunk` (
  `id` int(11) NOT NULL auto_increment,
  `username` text,
  `location` text,
  `area` text,
  `slots` text,
  `capacity` text,
  `mctime` text,
  `mobile` text,
  PRIMARY KEY  (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=latin1;

/*Data for the table `bunk` */

insert  into `bunk`(`id`,`username`,`location`,`area`,`slots`,`capacity`,`mctime`,`mobile`) values (1,'kishan','hyderabad','dilsukhnagar','8','503W','1.30 Hr','1234567890'),(2,NULL,NULL,NULL,NULL,NULL,NULL,'1234567890');

/*Table structure for table `user` */

DROP TABLE IF EXISTS `user`;

CREATE TABLE `user` (
  `id` int(11) NOT NULL auto_increment,
  `name` text,
  `email` text,
  `mobile` text,
  `location` text,
  `username` text,
  `password` text,
  `date` text,
  `area` text,
  PRIMARY KEY  (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=latin1;

/*Data for the table `user` */

insert  into `user`(`id`,`name`,`email`,`mobile`,`location`,`username`,`password`,`date`,`area`) values (1,'venkat','venkat@gmail.com','01234567890','hyderabad','venkat','123','2021-02-09 23:04:34','dilsukhnagar');

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
