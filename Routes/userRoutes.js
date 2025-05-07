const { Router } =require("express")
const { addUser, createAdmin, getAdmin, loginUser } =require("../Controllers/userController")
const { verifyAdmin } =require("../Middlewares/verifyAdmin")
const { verifySuperAdminToken } =require("../Middlewares/index")

const userRouter = Router()


userRouter.post("/register",verifyAdmin, addUser)
userRouter.post("/login", loginUser)
userRouter.post("/admin", verifySuperAdminToken,createAdmin)
userRouter.get("/:id", getAdmin)

module.exports={
    userRouter
}