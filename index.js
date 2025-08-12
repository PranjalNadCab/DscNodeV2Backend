require("dotenv").config();
require("./src/config/dbConn")
const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3000;
const moment = require("moment");





app.use(express.json());
app.use(cors({
    origin: "*"
}));


const server = app.listen(PORT, async () => {
    const currentTime = moment().format("YYYY-MM-DD HH:mm:ss");
    const unixServerTimeCheck = moment().unix();
    console.log(`🚀 Server is running on port ${PORT} at ${currentTime} & in unix check: ${unixServerTimeCheck}`);

    if (process.env.NODE_ENV === "development") {


    } else {


    }
});


server.on("error", (error) => {
    if (error.code === "EADDRINUSE") {
        console.error(`Not connected to Port ${PORT} as this is already in use.`);
    } else {
        console.error("Server error:", error);
    }
});