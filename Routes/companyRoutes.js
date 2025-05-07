const { Router } =require("express")
const { addCompany, getCompanies } =require("../Controllers/companyController")
const { verifySuperAdminToken } =require("../Middlewares/index")

const companyRouter = Router()


companyRouter.get("", getCompanies)
companyRouter.post("",verifySuperAdminToken, addCompany)


module.exports={
    companyRouter
}