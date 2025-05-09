const dotenv = require('dotenv')
const path = require('path')
dotenv.config({ path: path.resolve(__dirname, '../../.env') })
const TelegramBot =require('node-telegram-bot-api')
const {  chatWithFinanceBot, getChatResponse2, getDocument, getOccupation, insertToDB, loginUserBot } = require('./AIController')
const bot = new TelegramBot(process.env.TElEGRAM  ,{ polling: true });
const loginSteps = new Map();

bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const userMessage = msg.text?.trim();
    const username = msg.from?.username || chatId.toString();
    
    let responseMessage = "";
    let result;
    try {
        const session = loginSteps.get(chatId) || { step: 1, temp: {} };

        if (session.step === 1) {
            responseMessage = "👋 Welcome! Please enter your email to log in.";
            session.step = 2;
            loginSteps.set(chatId, session);
            console.log(session);
            
        } else if (session.step === 2) {
            session.temp.email = userMessage;
            session.step = 3;
            loginSteps.set(chatId, session);
            responseMessage = "🔐 Now enter your password.";
            console.log(session);
        } else if (session.step === 3) {
            const { email } = session.temp;
            const password = userMessage 
            console.log("TB",email,password);
            
           const isloginValid =await loginUserBot(email, password)
            result=isloginValid
            console.log(isloginValid);
            console.log(session);
            
            if (isloginValid.islogged) {
                session.step = 4;
                loginSteps.set(chatId, session);
                responseMessage = `✅ Login successful, ${email}. You can now chat with the bot.`;
                console.log(session);
            } else {
                loginSteps.delete(chatId);
                responseMessage = "❌ Invalid credentials. Please enter your email again to start over.";
            }
        } else {
            // Authenticated: Chatbot mode
            await bot.sendChatAction(chatId, 'typing');
            console.log("here" , session.temp?.email);
           const userRes = await getOccupation(session.temp?.email)
            
        //    if (userRes[0].Department.toLowerCase()==="Finance".toLowerCase() ) {
            const document = await getDocument(userRes[0].CompanyId);
         
            const botReply = await chatWithFinanceBot(document.DocumentURL, userMessage)
            // const botReply = await getChatResponse2(userMessage as string ,userRes[0].Occupation );
            responseMessage = botReply;
        //     console.log(session);
          
        // }else{
        //     const botReply = await getChatResponse2(userMessage  ,userRes[0].Occupation );
        //     responseMessage = botReply;
        // }
           

            // Store conversation
            // await insertToDB(userMessage, responseMessage, "Telegram", username);
        }

        // Send response
        await bot.sendMessage(chatId, responseMessage);
        console.log(session);

    } catch (error) {
        console.error("Error in Telegram bot:", error);
        await bot.sendMessage(chatId, "⚠️ Something went wrong. Please try again.");
    }
});
