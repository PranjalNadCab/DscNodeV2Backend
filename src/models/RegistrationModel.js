const mongoose  =require("mongoose");


const RegistrationSchema = new mongoose.Schema({
    userAddress: {
        type: String,
        required: true,
        unique: true
    },
    teamCount:{
        type:Number,
        default:0
    },
    directCount:{
        type:Number,
        default:0
    },
    time:{
        type:Number,
        default: () => Math.floor(Date.now() / 1000)
    }
},{timestamps: true, collection: 'registration'});

const RegistrationModel = mongoose.model('Registration', RegistrationSchema);

module.exports = RegistrationModel;