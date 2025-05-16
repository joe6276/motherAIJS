
const twilio = require('twilio') 
const mssql = require("mssql")
const { sqlConfig } = require("../Config")
const API_KEy = process.env.API_URL 
const API_URL = "https://api.openai.com/v1/chat/completions"
const bcrypt = require("bcrypt")
const axios = require('axios')
const { OpenAIEmbeddings }=require('@langchain/openai')
const { CharacterTextSplitter }=require("langchain/text_splitter")
const { FaissStore }=require("@langchain/community/vectorstores/faiss")
const { ChatOpenAI }=require("@langchain/openai")
const { loadQAStuffChain }=require("langchain/chains")
const xlsx = require('xlsx')
const pdfParse = require("pdf-parse")

const {AIMessage,SystemMessage,HumanMessage}  = require("@langchain/core/messages") 
const { BlobServiceClient } = require("@azure/storage-blob");




const connectionString = process.env.AZURE_BLOB_CONNECTION_STRING;
const containerName = process.env.AZURE_BLOB_CONTAINER_NAME;

async function chatWithFinanceBot(fileUrls, query,userId) {
    const openAIApiKey = API_KEy
    const allTexts = [];

for (const fileUrl of fileUrls) {
  const response = await axios.get(fileUrl.DocumentURL, { responseType: 'arraybuffer' });
  const data = response.data;

  // Parse the workbook
  const workbook = xlsx.read(data, { type: 'buffer' });
  const sheetNames = workbook.SheetNames;

  let raw_text = "";

  sheetNames.forEach(sheetName => {
    const sheet = workbook.Sheets[sheetName];
    const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });
    raw_text += `\n=== Sheet: ${sheetName} from ${fileUrl.DocumentURL} ===\n`;
    rows.forEach((row) => {
      raw_text += row.join(" ") + "\n";
    });
  });

  
  // Split text
  const textSplitter = new CharacterTextSplitter({
    separator: "\n",
    chunkSize: 1000,
    chunkOverlap: 200,
    lengthFunction: (text) => text.length
  });

  const texts = await textSplitter.splitText(raw_text);
  allTexts.push(...texts);
}


// Generate embeddings from all text chunks
const documentSearch = await FaissStore.fromTexts(
  allTexts,
  {},
  new OpenAIEmbeddings({ openAIApiKey })
);
  // 5. Perform search

  const resultOne = await documentSearch.similaritySearch(query, 1);



  // 6. QA Chain with system message
  const llm = new ChatOpenAI({
    openAIApiKey,
    model: "gpt-4",
    temperature: 0.9,
 
  });

  const chain = loadQAStuffChain(llm);
  const result = await chain.call({
    input_documents: resultOne,
    question: query
  });
  console.log(result);


return result.text 
}


async function chatWithHealthBot(fileUrls, query, userId) {
    const openAIApiKey = API_KEy;
    const allTexts = [];
  
    for (const fileUrl of fileUrls) {
      const response = await axios.get(fileUrl.DocumentURL, { responseType: 'arraybuffer' });
      const data = response.data;
  
      // Extract text from PDF
      const pdfData = await pdfParse(data);
      const raw_text = `\n=== Document: ${fileUrl.DocumentURL} ===\n` + pdfData.text;
  
      console.log(raw_text);
  
      // Split text into chunks
      const textSplitter = new CharacterTextSplitter({
        separator: '\n',
        chunkSize: 1000,
        chunkOverlap: 200,
        lengthFunction: (text) => text.length,
      });
  
      const texts = await textSplitter.splitText(raw_text);
      allTexts.push(...texts);
    }
  
    console.log(allTexts);
  
    // Generate embeddings from all text chunks
    const documentSearch = await FaissStore.fromTexts(
      allTexts,
      {},
      new OpenAIEmbeddings({ openAIApiKey })
    );
  
    // Perform similarity search
    const resultOne = await documentSearch.similaritySearch(query, 1);
  
    // Initialize Health-focused LLM
    const llm = new ChatOpenAI({
      openAIApiKey,
      model: 'gpt-4',
      temperature: 0.9,
      prefixMessages: [
        {
          role: 'system',
          content: `You are a highly skilled healthcare assistant specialized in analyzing medical and health-related PDF documents. Focus exclusively on interpreting information such as diagnoses, symptoms, treatments, prescriptions, lab results, vitals, and clinical notes.
  Avoid fabricating information or providing generic advice. If data is missing or unclear, recommend consulting a qualified medical professional or refer to credible sources.
  Provide responses that are accurate, medically relevant, and easy to understand.`,
        },
      ],
    });
  
    // Load QA chain and get answer
    const chain = loadQAStuffChain(llm);
    const result = await chain.call({
      input_documents: resultOne,
      question: query,
    });
  
    console.log(result);
    return result.text;
  }



async function getChatResponse(message, userId) {
    const pool = await mssql.connect(sqlConfig)
    const occupation = await (await pool.request().input("Id", userId).execute("getUserById")).recordset

    const messages= [{
        role: 'system', content: `
        You an Experienced Assistant Kindly advise based on User profession which is ${occupation[0].Occupation}
        Don't answer any questions outside ${occupation[0].Occupation} 
    `}]


    const history = await (await pool.request().input("UserId", userId).execute("GetUserRecords")).recordset

    if (history.length) {
        history.forEach(element => {
            messages.push({ role: "user", content: element.originalCommand })
            messages.push({ role: "assistant", content: element.output })

        });
    }

    messages.push({ role: "user", content: message })


    const response = await fetch(API_URL, {
        method: "POST",
        headers: {
            'Authorization': `Bearer ${API_KEy}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: 'gpt-4', 
            messages,
            temperature: 0.9 //0-2
        })


    })
    const content = await response.json()
    return content.choices[0].message.content
}


async function getChatResponse2(message,occupation,userId) {
    console.log(message,userId,occupation);
    
    const pool = await mssql.connect(sqlConfig)
    
    const messages = [{
        role: 'system', content: `
        You an Experienced Assistant, Kindly advise based on User profession which is ${occupation}, Don't answer any questions outside ${occupation}
    `}]

   

 history = await (await pool.request().input("UserId", userId).execute("GetUserRecords")).recordset

    if (history.length) {
        history.forEach(element => {
            messages.push({ role: "user", content: element.originalCommand })
            messages.push({ role: "assistant", content: element.output })

        });
    }

    messages.push({ role: "user", content: message })

    console.log(messages);

    const response = await fetch(API_URL, {
        method: "POST",
        headers: {
            'Authorization': `Bearer ${API_KEy}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: 'gpt-4',
            messages,
            temperature: 0.9 
        })


    })
    const content = await response.json()
    return content.choices[0].message.content
}



async function getChatResponse1(message ,userId, occupation) {

    console.log(message,userId,occupation);
    
    const pool = await mssql.connect(sqlConfig)
  
    const messages = [{
        role: 'system', content: `
        You an Experienced Marketter with alot of experience in the field .You work is to answer any marketing question asked in a simple way.
      also Kindly advise based on User profession which is ${occupation}.Don't answer any questions outside ${occupation}, Kindly short form the answer.
    `}]

    console.log(messages);


    const history = await (await pool.request().input("UserId", userId).execute("GetUserRecords")).recordset

    if (history.length) {
        history.forEach(element => {
            messages.push({ role: "user", content: element.originalCommand })
            messages.push({ role: "assistant", content: element.output })

        });
    }

    messages.push({ role: "user", content: message })
    console.log(messages);

    const response = await fetch(API_URL, {
        method: "POST",
        headers: {
            'Authorization': `Bearer ${API_KEy}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: 'gpt-4',
            messages,
            temperature: 0.9 //0-2
        })


    })
    const content = await response.json()
    return content.choices[0].message.content
}

async function insertToDB(question, response, channel, userId) {
    try {
        const pool = await mssql.connect(sqlConfig);
        await pool.request()
            .input("originalCommand", question)
            .input("parsedTask", response)
            .input("channel", channel)
            .input("status", "Completed")
            .input("UserId", userId)
            .input("output", response)
            .execute("InsertRecord");
    } catch (err) {

    }
}

async function aiChat(req, res) {
    try {
        const { question, userId } = req.body

        const response = await getChatResponse(question, userId)

        // await insertToDB(question, response, "website", userId)
        return res.status(200).json(response)
    } catch (error) {
        return res.status(500).json(error)
    }
}


async function getRecords(req, res) {
    try {
        const pool = await mssql.connect(sqlConfig)
        const records = await (await pool.request()
            .execute("GetAllRecords")).recordset

        res.status(200).json(records)
    } catch (error) {
        return res.status(500).json(error)
    }
}

async function loginUserBot(email, password){    
        const pool = await mssql.connect(sqlConfig)
        const user =await(await pool.request()
        .input("Email", email)
        .execute("getUserByEmail")).recordset 
       console.log(user);
       
        const isValid =  await bcrypt.compare(password, user[0].Password)
        console.log(isValid);
        if( !isValid || user.length==0){
            return {islogged:false}
        }else{
            
            return {islogged:true, occupation:user[0].Occupation}
        }
}


async function getOccupation(email){    
    const pool = await mssql.connect(sqlConfig)
    const user =await(await pool.request()
    .input("Email", email)
    .execute("getUserByEmail")).recordset   
        return user  
}

async function getDocument(companyId, department){    
    const pool = await mssql.connect(sqlConfig)
    const document =await(await pool.request()
    .input("CompanyId", companyId)
    .input("Department",department)
    .execute("GetDocuments")).recordset  

    return document
}


const loginSteps = new Map();


async function uploadToAzure(buffer, filename, contentType) {
  const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);


  const containerClient = blobServiceClient.getContainerClient(containerName);
  await containerClient.createIfNotExists();

  const blockBlobClient = containerClient.getBlockBlobClient(filename);
  await blockBlobClient.uploadData(buffer, {
    blobHTTPHeaders: { blobContentType: contentType }
  });
//   console.log( blockBlobClient.url);
  return blockBlobClient.url;

 
  
}


async function sendandReply(req, res) {
    const from = req.body.From;
    const to = req.body.To;
    const message = req.body.Body?.trim().toLowerCase(); // Convert message to lowercase for easier comparison
    const mediaCount = parseInt(req.body.NumMedia || '0');
    const client = twilio(process.env.ACCOUNT_SID, process.env.AUTH_TOKEN);
  
    let responseMessage = "";
  
    try {
      // If message is "start", reset login session and prompt for email
      if (message === "start") {
        loginSteps.delete(from);
        loginSteps.set(from, { step: 2, temp: {} }); // Skip step 1
        responseMessage = "Please enter your email to log in.";
      } else {
        const session = loginSteps.get(from) || { step: 1, temp: {} };
  
        if (session.step === 1) {
          responseMessage = "Welcome! Please enter your email to log in.";
          session.step = 2;
          loginSteps.set(from, session);
        } else if (session.step === 2) {
          session.temp.email = message;
          session.step = 3;
          loginSteps.set(from, session);
          responseMessage = "Thank you. Now, please enter your password.";
        } else if (session.step === 3) {
          const { email } = session.temp;
          const password = message;
  
          const isLoginValid = await loginUserBot(email, password);
          if (isLoginValid) {
            loginSteps.set(from, { step: 4, temp: { email } });
            responseMessage = `✅ Login successful. Welcome ${email}! You can now chat with the bot.`;
          } else {
            loginSteps.delete(from);
            responseMessage = "❌ Invalid credentials. Please start again by typing your email.";
          }
        } else {
          // Step 4: Authenticated
          const userres = await getOccupation(session.temp?.email);
  
          if (mediaCount > 0) {
            const mediaUrl = req.body.MediaUrl0;
            const contentType = req.body.MediaContentType0;
  
            const extension = contentType.split('/')[1];
            const filename = `whatsapp-upload-${Date.now()}.${extension}`;
  
            const mediaBuffer = (await axios.get(mediaUrl, {
              responseType: 'arraybuffer',
              headers: {
                Authorization: `Basic ${Buffer.from(process.env.ACCOUNT_SID + ':' + process.env.AUTH_TOKEN).toString('base64')}`,
              },
            })).data;
  
            const { CompanyId, Department } = userres[0];
            const uploadedUrl = await uploadToAzure(mediaBuffer, filename, contentType);
  
            const pool = await mssql.connect(sqlConfig);
            await pool.request()
              .input("CompanyId", CompanyId)
              .input("Department", Department)
              .input("DocumentURL", uploadedUrl)
              .execute("addDocument");
  
            responseMessage = `✅ File uploaded successfully`;
          } else {
            // Continue with normal chat flow
            if (userres[0].Department && userres[0].Department.toLowerCase() === "finance") {
              const document = await getDocument(userres[0].CompanyId, "Finance");
              responseMessage = await chatWithFinanceBot(document, message, userres[0].Id);
            } else if (userres[0].Department.toLowerCase() === "health") {
              const document = await getDocument(userres[0].CompanyId, "Health");
              responseMessage = await chatWithHealthBot(document, message, userres[0].Id);
            } else {
              responseMessage = await getChatResponse1(message, from, userres[0].Occupation);
            }
          }
        }
      }
  
      await client.messages.create({
        from: to,
        to: from,
        body: responseMessage
      });
  
      await insertToDB(req.body.Body?.trim(), responseMessage, "Whatsapp", from);
  
    } catch (err) {
      console.error("Error:", err);
    }
  
    res.send("<Response></Response>");
  }
  

// async function sendandReply(req, res) {
//     const from = req.body.From;
//     const to = req.body.To;
//     const message = req.body.Body?.trim();
//     console.log('Body', req.body);
//     const client = twilio(process.env.ACCOUNT_SID, process.env.AUTH_TOKEN);
//         console.log(client);
        
//     let myemail='';
//     let responseMessage = "";

//     try {
//         const session = loginSteps.get(from) || { step: 1, temp: {} };

//         if (session.step === 1) {
//             responseMessage = "Welcome! Please enter your email to log in.";
//             session.step = 2;
//             loginSteps.set(from, session);
//         } else if (session.step === 2) {
//             session.temp.email = message;
//             session.step = 3;
//             loginSteps.set(from, session);
//             responseMessage = "Thank you. Now, please enter your password.";
//         } else if (session.step === 3) {
//             const { email } = session.temp;
//             const password = message;

//             const isLoginValid= await loginUserBot(email,password)
//             myemail=email
            
//             if (isLoginValid) {
//                 loginSteps.set(from, { step: 4, temp: { email } });
//                 responseMessage = `✅ Login successful. Welcome ${email}! You can now chat with the bot.`;
//             } else {
//                 loginSteps.delete(from);
//                 responseMessage = "❌ Invalid credentials. Please start again by typing your email.";
//             }
//         } else {
//             // Step 4: Already authenticated
  
//             const userres = await getOccupation(session.temp?.email)

            
//                 if(userres[0].Department.toLowerCase() === "Finance".toLowerCase()){
//                     const document = await getDocument(userres[0].CompanyId)
//                     responseMessage = await chatWithFinanceBot(document, message)

              
//                 }else{
//                     const response = await getChatResponse1(message, from,   userres[0].Occupation );
//                     responseMessage = response;
//                 }

//                 console.log('The response',responseMessage);
//         }
//         console.log('The response',responseMessage);
//         await client.messages.create({
//             from: to,
//             to: from,
//             body: responseMessage
//         });

//         await insertToDB(message, responseMessage, "Whatsapp", from);
//         console.log(`Replied to ${from}`);
//     } catch (err) {
//         console.error("Error:", err);
//     }

//     res.send("<Response></Response>");
// }


module.exports={
    sendandReply,
    getDocument,
    getOccupation,
    loginUserBot,
    getRecords,
    aiChat,
    insertToDB,
    getChatResponse1,
    getChatResponse2,
    getChatResponse,
    chatWithFinanceBot,
    chatWithHealthBot

}