const nodemailer =require("nodemailer")
const dotenv = require("dotenv")
const path = require("path")
dotenv.config({ path: path.resolve(__dirname,'../.env') })

// Creating a transport and configurations

function createTransporter(config){
return nodemailer.createTransport(config)
}


console.log(process.env.EMAIL);
console.log(process.env.PASSWORD);

let config ={
    host:'smtp.gmail.com',
    service:'gmail',
    port:587,
    auth:{
        user:process.env.EMAIL,
        pass:process.env.PASSWORD
    }
}

const sendMail = async(messageOptions)=>{
try{    

 const message = {
    from: process.env.EMAIL,
    to: process.env.MYEMAIL,
    subject: "MotheAI Error Log",
    html:messageOptions
    }
    let transporter =createTransporter(config)
    await transporter.verify()
    await transporter.sendMail(message, (err, info)=>{
        console.log(info);
        
    })
}catch(error){
    console.log(error);
    
}
}


module.exports={
    sendMail
}