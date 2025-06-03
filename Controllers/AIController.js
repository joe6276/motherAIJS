
const twilio = require('twilio')
const mssql = require("mssql")
const { sqlConfig } = require("../Config")
const API_KEy = process.env.API_URL
const API_URL = "https://api.openai.com/v1/chat/completions"
const bcrypt = require("bcrypt")
const axios = require('axios')
const { OpenAIEmbeddings } = require('@langchain/openai')
const { CharacterTextSplitter } = require("langchain/text_splitter")
const { FaissStore } = require("@langchain/community/vectorstores/faiss")
const { ChatOpenAI } = require("@langchain/openai")
const { loadQAStuffChain } = require("langchain/chains")
const xlsx = require('xlsx')
const pdfParse = require("pdf-parse")
const { sendMail } = require('./emailService')
const { BlobServiceClient } = require("@azure/storage-blob");
const { OpenAI } = require("openai");
const { parse: csvParse } = require('csv-parse/sync');

const connectionString = process.env.AZURE_BLOB_CONNECTION_STRING;
const containerName = process.env.AZURE_BLOB_CONTAINER_NAME;

async function chatWithFinanceBot(fileUrls, query, userId) {
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
async function chatWithMarketingBot(fileUrls, query, userId) {
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
        content: `You are a creative and persuasive marketing assistant. Your role is to help craft engaging content, compelling copy,
     and data-driven strategies tailored to different audiences and platforms. Focus on understanding the target market, highlighting 
     unique value propositions, and driving conversions or brand awareness. Avoid making unverifiable claims or using overly generic language. 
     Stay aligned with brand tone and voice, and always consider the marketing goal—whether it’s engagement, lead generation, or sales.
     Make suggestions that are impactful, clear, and relevant to current trends and best practices.`
      }
    ]

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
    //     prefixMessages: [
    //       {
    //         role: 'system',
    //         content: `You are a highly skilled healthcare assistant specialized in analyzing medical and health-related PDF documents. Focus exclusively on interpreting information such as diagnoses, symptoms, treatments, prescriptions, lab results, vitals, and clinical notes.
    // Avoid fabricating information or providing generic advice. If data is missing or unclear, recommend consulting a qualified medical professional or refer to credible sources.
    // Provide responses that are accurate, medically relevant, and easy to understand.`,
    //       },
    //     ],
    prefixMessages: [
      {
        role: 'system',
        content: `You are a creative and persuasive marketing assistant. Your role is to help craft engaging content, compelling copy, and data-driven strategies tailored to different audiences and platforms. Focus on understanding the target market, highlighting unique value propositions, and driving conversions or brand awareness. Avoid making unverifiable claims or using overly generic language. Stay aligned with brand tone and voice, and always consider the marketing goal—whether it’s engagement, lead generation, or sales. Make suggestions that are impactful, clear, and relevant to current trends and best practices.`
      }
    ]

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


async function chatwithSalesBot(fileUrls, query, userId) {
  const openAIApiKey = process.env.API_URL;
  const allTexts = [];
  console.log(fileUrls);

  for (const fileUrl of fileUrls) {
    const response = await axios.get(fileUrl.DocumentURL, { responseType: 'arraybuffer' });
    const data = response.data;
    const contentType = fileUrl.DocumentURL.split('.').pop().toLowerCase();

    let raw_text = "";
     if (contentType === "csv") {
      // Parse CSV files
      const csvText = data.toString('utf8');
      const records = csvParse(csvText, {
        skip_empty_lines: true
      });
      records.forEach(row => {
         raw_text += row.join(" ")+'\n'; 
      });
    } 
    
  else if (contentType === "xlsx" || contentType === "xls") {
  const response = await axios.get(fileUrl.DocumentURL, { responseType: 'arraybuffer' });
  const buffer = Buffer.from(response.data); // ensure it's a Node.js buffer
  try {
    const workbook = xlsx.read(buffer, { type: 'buffer' });
    const sheetNames = workbook.SheetNames;
    sheetNames.forEach(sheetName => {
      const sheet = workbook.Sheets[sheetName];
      const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });
      rows.forEach(row => {
        raw_text += row.join(" ")+'\n';
      });
    });
  } catch (error) {
    console.error("Failed to parse Excel file:", error);
  }
}
    const textSplitter = new CharacterTextSplitter({
      separator: '\n',
      chunkSize: 1000,
      chunkOverlap: 200,
      lengthFunction: (text) => text.length,
    });

    const texts = await textSplitter.splitText(raw_text);
    console.log("The texts");
    
    console.log(texts);
    
    allTexts.push(...texts);
  }


console.log("All Text");
console.log(allTexts);


  const documentSearch = await FaissStore.fromTexts(
    allTexts,
    {},
    new OpenAIEmbeddings({ openAIApiKey })
  );

  const resultOne = await documentSearch.similaritySearch(query, 5);
const messages = [
  {
    role: 'system',
    content: `
      You are a specialized Sales Bot assistant. Your role is to help the Sales Manager analyze data provided in Excel (.xlsx, .xls) and CSV files.

      You are allowed to:
      - Analyze sales data from Excel and CSV files.
      - Answer questions about sales performance, leads, conversions, follow-ups, and other sales KPIs.
      - Summarize insights from uploaded spreadsheets.

      You may reply in English or Spanish based on the user's input language.
      Do not provide definitions, instructions, or general advice outside sales-related data analysis.
    `
  }
];

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
  return result.text;
}



async function getChatResponse(message, userId) {
  const pool = await mssql.connect(sqlConfig)
  const occupation = await (await pool.request().input("Id", userId).execute("getUserById")).recordset
  const messages = [
    {
      role: 'system',
      content: `
      You are an experienced and helpful assistant. Keep responses concise and focused on the user's query.
      If the user asks about **finance** or **marketing**, do not attempt to answer directly.
      Instead, clearly inform them:
      "For finance-related questions, please consult our **Finance Bot**."
      "For marketing-related questions, please consult our **Marketing Bot**."
        You may respond in either English or Spanish depending on the user's input language.
      This ensures users get accurate and specialized support.
    `
    }
  ];




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


async function getChatResponse2(message, occupation, userId) {

  const pool = await mssql.connect(sqlConfig)
  const messages = [
    {
      role: 'system',
      content: `
You are a helpful and experienced assistant. Keep responses concise and focused on general user queries.
You are **strictly prohibited** from answering questions related to:
- **Finance** (e.g., expenses, taxes, accounting, budgeting, invoicing)
- **Marketing** (e.g., SEO, branding, campaigns, advertising)

If the user asks about finance, always respond with:
"For finance-related questions, please consult our *Finance Bot*."

If the user asks about marketing, always respond with:
"For marketing-related questions, please consult our *Marketing Bot*."
Do **not** define, explain, or offer any suggestions about these topics — even if asked indirectly or casually.
  You may respond in either English or Spanish depending on the user's input language.
Your job is to redirect clearly and consistently. Always prioritize accuracy and domain boundaries.
    `
    }
  ];




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



async function getChatResponse1(message, userId, occupation) {

  const pool = await mssql.connect(sqlConfig)

  const messages = [
    {
      role: 'system',
      content: `
      You are an experienced and helpful assistant. Keep responses concise and focused on general user queries.
      If the user's question relates to finance (e.g., expenses, taxes, budgets, accounting) or marketing (e.g., campaigns, SEO, branding), you must not answer it.
      Instead, reply exactly with:
      - "For finance-related questions, please consult our **Finance Bot**."
      - "For marketing-related questions, please consult our **Marketing Bot**."
        You may respond in either English or Spanish depending on the user's input language.
      Do not provide any explanations, definitions, or guidance on finance or marketing topics.
    `
    }
  ];


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

async function loginUserBot(email, password) {
  const pool = await mssql.connect(sqlConfig)
  const user = await (await pool.request()
    .input("Email", email)
    .execute("getUserByEmail")).recordset
  console.log(user);

  const isValid = await bcrypt.compare(password, user[0].Password)
  console.log(isValid);
  if (!isValid || user.length == 0) {
    return { islogged: false }
  } else {

    return { islogged: true, occupation: user[0].Occupation }
  }
}


async function getOccupation(email) {
  const pool = await mssql.connect(sqlConfig)
  const user = await (await pool.request()
    .input("Email", email)
    .execute("getUserByEmail")).recordset
  return user
}

async function getDocument(companyId, department) {
  const pool = await mssql.connect(sqlConfig)
  const document = await (await pool.request()
    .input("CompanyId", companyId)
    .input("Department", department)
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


const openai = new OpenAI({ apiKey: process.env.API_URL });

async function analyzeImageWithOpenAI(base64Image, mimeType) {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4-turbo",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Describe this image in a concise and focused way ." },
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

    return response.choices[0]?.message?.content || "Image analyzed, but no description returned.";

  } catch (error) {
    console.error("Image analysis failed:", error.message);
    sendMail(`<p>${error.message}</p>`)
    return error.message;
  }
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
          const contentType = req.body.MediaContentType0 || '';
          const extension = contentType.split('/')[1];
          const filename = `whatsapp-upload-${Date.now()}.${extension}`;

          // Download media from Twilio
          const mediaBuffer = (await axios.get(mediaUrl, {
            responseType: 'arraybuffer',
            headers: {
              Authorization: `Basic ${Buffer.from(process.env.ACCOUNT_SID + ':' + process.env.AUTH_TOKEN).toString('base64')}`,
            },
          })).data;

          // Upload to Azure Blob
          const uploadedUrl = await uploadToAzure(mediaBuffer, filename, contentType);

          // Save to SQL DB
          const { CompanyId, Department } = userres[0];
          const pool = await mssql.connect(sqlConfig);
          await pool.request()
            .input("CompanyId", CompanyId)
            .input("Department", Department)
            .input("DocumentURL", uploadedUrl)
            .execute("addDocument");

          // 🔍 Analyze only if it's an image
          let analysisText = "";
          if (contentType.startsWith("image/")) {
            const base64Image = Buffer.from(mediaBuffer).toString("base64");
            analysisText = await analyzeImageWithOpenAI(base64Image, contentType);
            responseMessage = `✅ Image uploaded successfully.\n\n🤖 GPT-4 says:\n${analysisText}`;
          } else {
            responseMessage = `✅ Document uploaded successfully.`;
          }

        } else {
          // Continue with normal chat flow
          if (userres[0].Department) {
            if (userres[0].Department.toLowerCase() === "finance") {
              const document = await getDocument(userres[0].CompanyId, "Finance");
              responseMessage = await chatWithFinanceBot(document, message, userres[0].Id);
            } else if (userres[0].Department.toLowerCase() === "marketing") {
              const document = await getDocument(userres[0].CompanyId, "Marketing");
              responseMessage = await chatWithMarketingBot(document, message, userres[0].Id);
            } else {
              responseMessage = await getChatResponse1(message, from, userres[0].Occupation);
            }
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
    loginSteps.delete(from);
    loginSteps.set(from, { step: 2, temp: {} }); // Skip step 1
    responseMessage = "Session Restarted, Please enter your email to log in.";

    sendMail(`<p>${err}</p>`)
  }

  res.send("<Response></Response>");
}


// async function sendandReply(req, res) {
//     const from = req.body.From;
//     const to = req.body.To;
//     const message = req.body.Body?.trim().toLowerCase(); // Convert message to lowercase for easier comparison
//     const mediaCount = parseInt(req.body.NumMedia || '0');
//     const client = twilio(process.env.ACCOUNT_SID, process.env.AUTH_TOKEN);

//     let responseMessage = "";

//     try {
//       // If message is "start", reset login session and prompt for email
//       if (message === "start") {
//         loginSteps.delete(from);
//         loginSteps.set(from, { step: 2, temp: {} }); // Skip step 1
//         responseMessage = "Please enter your email to log in.";
//       } else {
//         const session = loginSteps.get(from) || { step: 1, temp: {} };

//         if (session.step === 1) {
//           responseMessage = "Welcome! Please enter your email to log in.";
//           session.step = 2;
//           loginSteps.set(from, session);
//         } else if (session.step === 2) {
//           session.temp.email = message;
//           session.step = 3;
//           loginSteps.set(from, session);
//           responseMessage = "Thank you. Now, please enter your password.";
//         } else if (session.step === 3) {
//           const { email } = session.temp;
//           const password = message;

//           const isLoginValid = await loginUserBot(email, password);
//           if (isLoginValid) {
//             loginSteps.set(from, { step: 4, temp: { email } });
//             responseMessage = `✅ Login successful. Welcome ${email}! You can now chat with the bot.`;
//           } else {
//             loginSteps.delete(from);
//             responseMessage = "❌ Invalid credentials. Please start again by typing your email.";
//           }
//         } else {
//           // Step 4: Authenticated
//           const userres = await getOccupation(session.temp?.email);

//           if (mediaCount > 0) {
//             const mediaUrl = req.body.MediaUrl0;
//             const contentType = req.body.MediaContentType0;

//             const extension = contentType.split('/')[1];
//             const filename = `whatsapp-upload-${Date.now()}.${extension}`;

//             const mediaBuffer = (await axios.get(mediaUrl, {
//               responseType: 'arraybuffer',
//               headers: {
//                 Authorization: `Basic ${Buffer.from(process.env.ACCOUNT_SID + ':' + process.env.AUTH_TOKEN).toString('base64')}`,
//               },
//             })).data;

//             const { CompanyId, Department } = userres[0];
//             const uploadedUrl = await uploadToAzure(mediaBuffer, filename, contentType);

//             const pool = await mssql.connect(sqlConfig);
//             await pool.request()
//               .input("CompanyId", CompanyId)
//               .input("Department", Department)
//               .input("DocumentURL", uploadedUrl)
//               .execute("addDocument");

//             responseMessage = `✅ File uploaded successfully`;
//           } else {
//             // Continue with normal chat flow
//             if(userres[0].Department){
//                 if (userres[0].Department.toLowerCase() === "finance") {
//                     const document = await getDocument(userres[0].CompanyId, "Finance");
//                     responseMessage = await chatWithFinanceBot(document, message, userres[0].Id);
//                   } else if (userres[0].Department.toLowerCase() === "marketing") {
//                     const document = await getDocument(userres[0].CompanyId, "Marketing");
//                     responseMessage = await chatWithMarketingBot(document, message, userres[0].Id);
//                   } else {
//                     responseMessage = await getChatResponse1(message, from, userres[0].Occupation);
//                   }
//             }else{
//                 responseMessage = await getChatResponse1(message, from, userres[0].Occupation);
//             }
//           }
//         }
//       }

//       await client.messages.create({
//         from: to,
//         to: from,
//         body: responseMessage
//       });

//       await insertToDB(req.body.Body?.trim(), responseMessage, "Whatsapp", from);

//     } catch (err) {
//       console.error("Error:", err);
//         loginSteps.delete(from);
//         loginSteps.set(from, { step: 2, temp: {} }); // Skip step 1
//         responseMessage = "Session Restarted, Please enter your email to log in.";

//          sendMail(`<p>${err}</p>`)
//     }

//     res.send("<Response></Response>");
//   }






module.exports = {
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
  chatWithHealthBot,
  chatWithMarketingBot,
  chatwithSalesBot

}