CREATE DATABASE IF NOT EXISTS testdb;
USE testdb;

CREATE TABLE IF NOT EXISTS items (
  id INT PRIMARY KEY,
  amount INT NOT NULL
);

INSERT INTO items (id, amount) VALUES (1, 10), (2, 20)
  ON DUPLICATE KEY UPDATE amount = VALUES(amount);

CREATE USER IF NOT EXISTS 'readonly'@'%' IDENTIFIED BY 'readonly';
GRANT SELECT ON testdb.* TO 'readonly'@'%';
FLUSH PRIVILEGES;
