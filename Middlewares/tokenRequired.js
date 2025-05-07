const jwt=require('jsonwebtoken')
const dotenv=require('dotenv')
const path=require('path')
dotenv.config({ path: path.resolve(__dirname, '../../.env') })

function tokenRequired(req, res, next){

    const authHeader = req.headers['authorization'];
   
    
    const token = authHeader && authHeader.startsWith('Bearer ')
      ? authHeader.split(' ')[1]
      : null;
      
      try {
        if(!token){
            return res.status(401).json({error:'Forbidden'})
        }
      } catch (error) {
        res.status(403).json(error.message)
      }
      
      next()
}

module.exports={
    tokenRequired
}