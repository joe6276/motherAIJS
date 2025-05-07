
const { Router } =require("express")
const { addFile } =require("../Controllers/blobController")
const multer =require("multer")


const storage = multer.memoryStorage();
const upload = multer({ storage });



 const uploadRouter= Router()

 uploadRouter.post("/upload", upload.single("image"), addFile);


module.exports={
    uploadRouter
}