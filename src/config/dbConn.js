const mongoose = require("mongoose")

mongoose.set("strictQuery", true);

mongoose.connect(process.env.MONGO_URL,{
    serverSelectionTimeoutMS: 50000
}).then(()=>{
    console.log("Database connected!")
}).catch((error)=>{
    console.log(error)
})