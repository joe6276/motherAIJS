const {BlobServiceClient} = require("@azure/storage-blob")
const {v4} = require("uuid")
const mssql = require("mssql")
const {sqlConfig}= require("../Config")

const connectionString = process.env.AZURE_BLOB_CONNECTION_STRING;
const containerName = process.env.AZURE_BLOB_CONTAINER_NAME;


 async function addFile(req, res){
    try {
        const {CompanyId,Department}= req.body
        const file = req.file 
        if (!file) {
          return res.status(400).send("No file uploaded.");
        }
    
        const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
        const containerClient = blobServiceClient.getContainerClient(containerName);
        await containerClient.createIfNotExists({ access: "blob" });
    
        const blobName = `${v4()}-${file.originalname}`;
        const blockBlobClient = containerClient.getBlockBlobClient(blobName);
    
        await blockBlobClient.uploadData(file.buffer, {
          blobHTTPHeaders: { blobContentType: file.mimetype },
        });
        
            const pool = await mssql.connect(sqlConfig)
                 await pool.request()
                .input("CompanyId", CompanyId)
                .input("Department", Department)
                // .input("CompanyId", 2)
                // .input("Department", "Finance")
                .input("DocumentURL", blockBlobClient.url)
                .execute("addDocument")
               

        return res.status(200).json({ imageUrl: blockBlobClient.url });
      } catch (error) {
        console.error("Upload failed:", error.message);
        return res.status(500).send("Upload failed.");
      }
    
}


module.exports={
    addFile
}