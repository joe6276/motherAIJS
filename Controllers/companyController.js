const mssql= require('mssql')
const { sqlConfig } =require("../Config");
 async function addCompany(req, res){

    try {
        
        const {companyName}=req.body

        const pool = await mssql.connect(sqlConfig)
        await pool.request()
        .input("CompanyName",companyName)
        .execute("AddCompany")

        res.status(201).json({message:'company added!'})
    } catch (error) {
        res.status(500).json(error)
    }
}



 async function getCompanies(req, res){

    try {
        const pool = await mssql.connect(sqlConfig)
        const response= await (await pool.request().execute("GetAllCompanies")).recordset
        res.status(200).json(response)
    } catch (error) {
        res.status(500).json(error)
    }
}


module.exports={
    getCompanies,
    addCompany
}