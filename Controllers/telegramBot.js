
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const TelegramBot = require('node-telegram-bot-api');
const {
  chatWithFinanceBot,
  getChatResponse2,
  getDocument,
  getOccupation,
  insertToDB,
  loginUserBot
} = require('./AIController');

const bot = new TelegramBot(process.env.TELEGRAM, { polling: true });
const loginSteps = new Map();


bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const userMessage = msg.text?.trim();
    const username = msg.from?.username || chatId.toString();
  
    let responseMessage = "";
    let result;
  
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
  
          if (department === "finance") {
            const document = await getDocument(companyId);
            const botReply = await chatWithFinanceBot(document.DocumentURL, userMessage);
            responseMessage = botReply;
          } else {
            const botReply = await getChatResponse2(userMessage, occupation);
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
      await bot.sendMessage(chatId, "⚠️ Something went wrong. Please try again.");
    }
  });
  


bot.on('document', async (msg)=>{
  const chatId = msg.chat.id;
  const fileId = msg.document.file_id;
  const fileName = msg.document.file_name;
  const mimeType = msg.document.mime_type;


  console.log(chatId);
  console.log(fileId);
  console.log(fileName);
  console.log(mimeType);


  const session = loginSteps.get(chatId);
  if (!session || !session.temp?.email) {
    await bot.sendMessage(chatId, "❌ You must log in first using /start.");
    return;
  }

  //the user is Logged In

  try{
    const email = session.temp.email;
    console.log(email);
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


    console.log(response);
    

  }catch(error){

  }
})