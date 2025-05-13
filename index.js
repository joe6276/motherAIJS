const express= require("express")
const {json} = require("express")
const cors = require('cors')

const _= require("./Controllers/telegramBot")
const { router } = require("./Routes/AiRoutes")
const { userRouter } = require("./Routes/userRoutes")
const { companyRouter } = require("./Routes/companyRoutes")
const { uploadRouter } = require("./Routes/BlobRoutes")



const app= express()
app.use(express.urlencoded({ extended: false }));
app.use(json())
app.use(cors())


app.use('/aiChat',router)
app.use("/users", userRouter)
app.use("/companies", companyRouter)
app.use("/file", uploadRouter)

app.use("/test", (req,res)=>{
    res.status(200).send("<h1> Hello There</h1>")
    })

const port = process.env.PORT || 80;
app.listen(port,()=>{
    console.log("App Running...");
    
})