<?php
try {
  $conn = new PDO('pgsql:host=dbserver;user=postgres;password=mysecretpassword');
  $row = $conn->query('SELECT version()')->fetch();
  echo "Connected to Postgres version $row[0]\n";
} catch (PDOException $e) {
  echo "Error : $e->getMessage()\n";
}
?>