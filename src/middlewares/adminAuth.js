const jwt = require("jsonwebtoken");
const AdminModel = require("../models/AdminModel");
const { ct } = require("../helpers/helper");
const bcrypt = require("bcrypt");

const adminAuthentication = async (req, res, next) => {

    try {


        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];
        if (!token) {
            return res.status(401).json({ success: false, msg: "No token, authorization denied!" });

        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log(decoded)
        const {role,walletAddress,password} = decoded.accountDetail;
        console.log(role,walletAddress,password)
        if(!role || !password || !walletAddress){
            return res.status(401).json({ success: false, msg: "Invalid token, authorization"});
        }
        const adminDoc = await AdminModel.findOne({role,walletAddress:walletAddress});
        const {role:originalRole,password:originalPassword,walletAddress:originalWalletAddress} = adminDoc;
        if(!originalRole || !originalPassword || !originalWalletAddress){
            return res.status(401).json({ success: false, msg: "Invalid token, authorization"});
        }

        if((walletAddress !== originalWalletAddress)){
            return res.status(401).json({ success: false, msg: "Invalid wallet address! authorization failed!"});
        }
        const isValidPassword = await bcrypt.compare(password, originalPassword);
        if (!isValidPassword) {
            return res.status(400).json({ success: false, message: "Invalid password" });
        }
        
        req.adminDecodedData = decoded.accountDetail; // here this will give _id, userId, referralId, referredBy
        next();

    } catch (error) {
        res.status(403).json({ success: false, msg: "Failed to authenticated token!" })
    }

}

module.exports = {adminAuthentication}