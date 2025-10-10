const express = require("express");
const { getAllUsers } = require("../controllers/adminController");


const router = express.Router();

router.get("/all-users", getAllUsers);







module.exports = router