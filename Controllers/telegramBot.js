
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
const { BlobServiceClient } = require('@azure/storage-blob');
const { v4: uuidv4 } = require('uuid');
const axios= require('axios')
const TelegramBot = require('node-telegram-bot-api');
const {
  chatWithFinanceBot,
  getChatResponse1,
  getChatResponse2,
  chatWithMarketingBot,
  getDocument,
  getOccupation,
  insertToDB,
  loginUserBot,
  chatwithSalesBot,
  chawWithPMBots,
  chatWithSocialBot
} = require('./AIController');
const mssql= require("mssql")
const {sqlConfig} = require('../Config')
const{sendMail} =require('./emailService')
const OpenAI =require("openai")
const bot = new TelegramBot(process.env.TELEGRAM, { polling: true });
const loginSteps = new Map();
const connectionString = process.env.AZURE_BLOB_CONNECTION_STRING;
const containerName = process.env.AZURE_BLOB_CONTAINER_NAME;


const openai= new OpenAI({
  apiKey: process.env.API_URL
})


bot.on('message', async (msg) => {

  if (!msg.text) return;

    const chatId = msg.chat.id;
    const userMessage = msg.text?.trim();
    const username = msg.from?.username || chatId.toString();
  
    let responseMessage = "";
  
  
    try {
      // Handle /start command inline
      if (userMessage?.toLowerCase() === '/start') {
        loginSteps.delete(chatId);
        await bot.sendMessage(chatId, "👋 Let's start again. Please enter your email.");
        loginSteps.set(chatId, { step: 2, temp: {} });
        return;
      }
  
      let session = loginSteps.get(chatId);
  
      // If no session, start login flow
      if (!session) {
        responseMessage = "👋 Welcome! Please enter your email to log in.";
        loginSteps.set(chatId, { step: 2, temp: {} });
        await bot.sendMessage(chatId, responseMessage);
        return;
      }
  
      if (session.step === 2) {
        session.temp.email = userMessage;
        session.step = 3;
        loginSteps.set(chatId, session);
        responseMessage = "🔐 Now enter your password.";
        await bot.sendMessage(chatId, responseMessage);
        return;
      }
  
      if (session.step === 3) {
        const { email } = session.temp;
        const password = userMessage;
  
        const isloginValid = await loginUserBot(email, password);
        result = isloginValid;
  
        if (isloginValid?.islogged) {
          session.step = 4;
          loginSteps.set(chatId, session);
          responseMessage = `✅ Login successful, ${email}. You can now chat with the bot.`;
        } else {
          loginSteps.delete(chatId);
          responseMessage = "❌ Invalid credentials. Please enter your email again to start over.";
        }
  
        await bot.sendMessage(chatId, responseMessage);
        return;
      }
  
      // Step 4: Authenticated
      if (session.step === 4) {
        await bot.sendChatAction(chatId, 'typing');
  
        const userRes = await getOccupation(session.temp?.email);
  
        if (userRes && userRes[0]) {
          const department = userRes[0].Department?.toLowerCase();
          const occupation = userRes[0].Occupation;
          const companyId = userRes[0].CompanyId;
          const Id = userRes[0].Id;

          console.log(userRes);
          console.log(department);

          if (department === "finance") {
            const document = await getDocument(companyId,"Finance");
            const botReply = await chatWithFinanceBot(document, userMessage,Id);
            responseMessage = botReply;
          }else if(department === "pm"){
            const document = await getDocument(companyId,"PM");
              console.log(document);
              const botReply = await chawWithPMBots(document, userMessage,Id);
              responseMessage = botReply;
          }
          else if(department === "socialmedia"){
            const document = await getDocument(companyId,"SocialMedia");
              console.log(document);
              const botReply = await chatWithSocialBot(document, userMessage,Id);
              responseMessage = botReply;
          }
          else if(department ==="marketing"){
              const document = await getDocument(companyId,"Marketing");
              console.log(document);
              const botReply = await chatWithMarketingBot(document, userMessage,Id);
              responseMessage = botReply;
            
          }
          else if(department ==="sales"){
            const document = await getDocument(companyId,"sales");
            console.log(document);
            const botReply = await chatwithSalesBot(document, userMessage,Id);
            responseMessage = botReply;

          } else {
           
            const userRes = await getOccupation(session.temp?.email);
            const Id = userRes[0].Id;
            console.log("The Id" ,Id)
            const botReply = await getChatResponse2(userMessage, occupation,username);
            responseMessage = botReply;
          }
  
          // Optionally store the message
          await insertToDB(userMessage , responseMessage, "Telegram", username);
  
        } else {
          responseMessage = "⚠️ Could not retrieve your user profile.";
        }
  
        await bot.sendMessage(chatId, responseMessage);
      }
  
    } catch (error) {
      console.error("Error in Telegram bot:", error);
      // await bot.sendMessage(chatId, "⚠️ Something went wrong. Please try again.");
        sendMail(`<p>${error}</p>`)
        loginSteps.delete(chatId);
        await bot.sendMessage(chatId, "Session Restarted, Please enter Email to Login In");
        loginSteps.set(chatId, { step: 2, temp: {} });
        return;
    }
  });
  


bot.on('document', async (msg)=>{
  const chatId = msg.chat.id;
  const fileId = msg.document.file_id;
  const fileName = msg.document.file_name;
  const mimeType = msg.document.mime_type;

  const session = loginSteps.get(chatId);
  if (!session || !session.temp?.email) {
    await bot.sendMessage(chatId, "❌ You must log in first using /start.");
    return;
  }

  //the user is Logged In

  try{
    const email = session.temp.email;
    const userInfo = await getOccupation(email);

    if (!userInfo || !userInfo[0]) {
      await bot.sendMessage(chatId, "⚠️ Could not retrieve your user profile.");
      return;
    }
    console.log(userInfo);
    const { CompanyId, Department } = userInfo[0];
    const file = await bot.getFile(fileId);
    const fileUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM}/${file.file_path}`;
    const response = await axios.get(fileUrl, { responseType: 'arraybuffer' });


    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    const containerClient = blobServiceClient.getContainerClient(containerName);
    await containerClient.createIfNotExists({ access: "blob" });

    const blobName = `${uuidv4()}-${fileName}`;
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    await blockBlobClient.uploadData(response.data, {
      blobHTTPHeaders: { blobContentType: mimeType },
    });

    const documentUrl = blockBlobClient.url;

    const pool = await mssql.connect(sqlConfig)
                 await pool.request()
                .input("CompanyId", CompanyId)
                .input("Department", Department)
                .input("DocumentURL", documentUrl)
                .execute("addDocument")
    
    console.log("The URL");
    console.log(documentUrl);
    
    await bot.sendMessage(chatId, `✅ File uploaded and saved!`);



  }catch(error){
    console.error("Upload failed:", error.message);
    await bot.sendMessage(chatId, "⚠️ File upload failed.");
    
  }
})


function escapeMarkdownV2(text) {
  return text
    .replace(/_/g, '\\_')
    .replace(/\*/g, '\\*')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/~/g, '\\~')
    .replace(/`/g, '\\`')
    .replace(/>/g, '\\>')
    .replace(/#/g, '\\#')
    .replace(/\+/g, '\\+')
    .replace(/-/g, '\\-')
    .replace(/=/g, '\\=')
    .replace(/\|/g, '\\|')
    .replace(/{/g, '\\{')
    .replace(/}/g, '\\}')
    .replace(/\./g, '\\.')
    .replace(/!/g, '\\!');
}

bot.on('photo', async(msg)=>{
    const chatId = msg.chat.id;
    const username = msg.from?.username || chatId.toString();
  

 const session = loginSteps.get(chatId);
  if (!session || !session.temp?.email) {
    await bot.sendMessage(chatId, "❌ You must log in first using /start.");
    return;
  }

  try {
      const email = session.temp.email;
    const userInfo = await getOccupation(email);
    if (!userInfo || !userInfo[0]) {
      await bot.sendMessage(chatId, "⚠️ Could not retrieve your user profile.");
      return;
    }

    const { CompanyId, Department } = userInfo[0];
    const photoArray = msg.photo;
    const largestPhoto = photoArray[photoArray.length - 1]; // highest resolution
    const fileId = largestPhoto.file_id;

    const file = await bot.getFile(fileId);
    const fileUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM}/${file.file_path}`;

    const response = await axios.get(fileUrl, { responseType: 'arraybuffer' });
    const mimeType = 'image/jpeg'; // Telegram converts photos to JPEG

    // Upload to Azure Blob
    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    const containerClient = blobServiceClient.getContainerClient(containerName);
    await containerClient.createIfNotExists({ access: "blob" });

    const blobName = `${uuidv4()}.jpg`;
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    await blockBlobClient.uploadData(response.data, {
      blobHTTPHeaders: { blobContentType: mimeType },
    });

    const documentUrl = blockBlobClient.url;
 
    
    // Save to DB
    const pool = await mssql.connect(sqlConfig);
    await pool.request()
      .input("CompanyId", CompanyId)
      .input("Department", Department)
      .input("DocumentURL", documentUrl)
      .execute("addDocument");

    await bot.sendMessage(chatId, `📸 Image uploaded and saved GPT analysis following soon.`);
  

    // GPT-4 Vision Analysis
    const base64Image = Buffer.from(response.data).toString('base64');
    console.log(base64Image);

    const gptResponse = await openai.chat.completions.create({
      model: "gpt-4-turbo",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Describe the image content." },
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${base64Image}`,
              },
            },
          ],
        },
      ],
      max_tokens: 500,
    });
    console.log(gptResponse);

    const analysis = gptResponse.choices[0].message.content;
    console.log(analysis);

   const safeText = escapeMarkdownV2(analysis);
   await insertToDB("describe the image" , safeText, "Telegram", username);

   await bot.sendMessage(chatId, `🧠 *Image Analysis*:\\n${safeText}`, { parse_mode: "MarkdownV2" });

  } catch (error) {
    console.error("Photo upload or analysis failed:", error.message || error);
    await bot.sendMessage(chatId, "⚠️ Photo upload or analysis failed.");
    sendMail(`<p>${error.message}</p>`)
  }
})