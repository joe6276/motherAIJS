const bcrypt = require("bcrypt")
const dotenv =require("dotenv")
const  path= require("path")
const mssql= require('mssql')
const jwt = require('jsonwebtoken')
dotenv.config({ path: path.resolve(__dirname, '../.env') })
const {sqlConfig} =require("../Config")
async function createAdmin(req,res){
    try{
        const {firstName, lastName, email, password,companyId,occupation,department}= req.body
     
        const hashedPassword= await bcrypt.hash(password,10)
        const pool = await mssql.connect(sqlConfig)
        const user =await(await pool.request()
        .input("Email", email)
        .execute("getUserByEmail")).recordset
       
        if(user.length!=0){
            return res.status(400).json({message:"Email Already Exists!"})
        }

        await pool.request()
        .input("FirstName", firstName)
        .input("LastName", lastName)
        .input("Email", email)
        .input("Password", hashedPassword)
        .input("Role", "admin")
        .input("CompanyId", companyId)
        .input("Occupation",occupation)
        .input("Department", department)
        .execute("AddUser")

        return res.status(201).json({message:"user added"})
    } catch (error) {
        return res.status(500).json(error)
    }
}



async function addUser(req,res){
    try {
        const {firstName, lastName, email, password,companyId,occupation,department}= req.body
       
        const hashedPassword= await bcrypt.hash(password,10)
        const pool = await mssql.connect(sqlConfig)

        const user =await(await pool.request()
        .input("Email", email)
        .execute("getUserByEmail")).recordset
    
        if(user.length!=0){
            return res.status(400).json({message:"Email Already Exists!"})
        }
        await pool.request()
        .input("FirstName", firstName)
        .input("LastName", lastName)
        .input("Email", email)
        .input("Password", hashedPassword)
        .input("Role", "user")
        .input("CompanyId", companyId)
        .input("Occupation",occupation)
        .input("Department", department)
        .execute("AddUser")


        return res.status(201).json({message:"user added"})
    } catch (error) {
        return res.status(500).json(error)
    }
}

async function loginUser(req, res){
    try {
        const {email,password}= req.body
        ///Geneerate TOken
        const pool = await mssql.connect(sqlConfig)
        const user =await(await pool.request()
        .input("Email", email)
        .execute("getUserByEmail")).recordset 
       
        const isValid =  await bcrypt.compare(password, user[0].Password)
       
        if( !isValid || user.length==0){
            return res.status(400).json({message:"Invalid Credentials"})
        }else{
            const token = jwt.sign({id:user[0].Id,role: user[0].Role},process.env.SECRET)
            return res.status(200).json({message:"Login Successful", companyId:user[0].CompanyId ,token, id:user[0].Id})
        }
    

       
       
    } catch (error) {
        console.log(error);
        
        return res.status(500).json(error)
    }
}

async function getAdmin(req, res){
 try {
    
    const pool = await mssql.connect(sqlConfig)
    const user =await(await pool.request()
    .input("CompanyId", req.params.id)
    .execute("GetAdmin")).recordset

    return res.status(200).json(user)

 } catch (error) {
    return res.status(500).json(error)
 }
}


module.exports={
    addUser,
    loginUser,
    createAdmin,
    getAdmin
}