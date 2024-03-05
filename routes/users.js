const express = require("express");
const router = express.Router();
const {
  getUserInfo,
  getUsers,
  updateUser,
  //deleteUser,
} = require("../controllers/users.controller");

router.get("/users", getUsers);

router.get("/user/:id", getUserInfo);

router.put("/user/:id", updateUser);

//router.delete("/user/:id", deleteUser);

module.exports = router;
