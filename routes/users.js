const express = require("express");
const router = express.Router();

router.get("/users", (req, res) => {
  res.send("Listado de usuarios por GET");
});

router.get("/users/:id", (req, res) => {
  res.send(`Usuario: ${req.params.id}`);
});

router.post("/users", (req, res) => {
  res.send(`Creacion de usuarios por POST: ${req.body.email}`);
});

router.put("/users/:id", (req, res) => {
  res.send(
    `Modificacion de usuario ${req.params.id} por PUT: ${req.body.email}`
  );
});

router.delete("/users/:id", (req, res) => {
  res.send(`Borrado de usuarios por DELETE: ${req.params.id}`);
});

module.exports = router;
