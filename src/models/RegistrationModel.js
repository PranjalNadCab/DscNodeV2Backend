const mongoose  =require("mongoose");


const RegistrationSchema = new mongoose.Schema({
    userAddress: {
        type: String,
        required: true,
        unique: true
    },
    sponsorAddress: {
        type: String,
        required: true,
    },
    teamCount:{
        type:Number,
        default:0
    },
    directCount:{
        type:Number,
        default:0
    },
    directStaking:{
        type: String,
        default:"0"
    },
    time:{
        type:Number,
        default: () => Math.floor(Date.now() / 1000)
    }
},{timestamps: true, collection: 'registration'});

const RegistrationModel = mongoose.model('registration', RegistrationSchema);

module.exports = RegistrationModel;