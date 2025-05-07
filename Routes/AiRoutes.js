
const express =require("express")
const { aiChat, getRecords,sendandReply } =require("../Controllers/AIController")

const router = express.Router()


router.post("",  aiChat)
router.post('/webhook', sendandReply)
router.get("/records", getRecords)


module.exports={
    router
}