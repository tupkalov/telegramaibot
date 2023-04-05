const TelegramBot = require('node-telegram-bot-api');
const { Configuration, OpenAIApi } = require('openai');

// Достаем конфиги из переменных окружения
for (const envName of [
  'OPENAI_API_KEY', 
  'OPENAI_MODEL', 
  'OPENAI_ORGANIZATION', 
  'TELEGRAM_TOKEN', 
  'TAB_CONTEXT', 
  'TAB_ALLOWED_USER_IDS',
  'TAB_WRONG_USER_ID_MESSAGE'
]) {
  if (!process.env[envName]) throw new Error(`${envName} is not defined!`);
}

const {
  OPENAI_API_KEY: openaiApiKey,
  OPENAI_MODEL: openaiModel,
  OPENAI_ORGANIZATION: openaiOrg,
  TELEGRAM_TOKEN: telegramToken,
  TAB_CONTEXT: context,
  TAB_ALLOWED_USER_IDS: allowedIds,
  TAB_WRONG_USER_ID_MESSAGE: wrongUserIdMessage
} = process.env;



// Создайте экземпляр бота Telegram
const bot = new TelegramBot(telegramToken, { polling: true });

// Создайте экземпляр OpenAI
const openAIConfig = new Configuration({
  apiKey: openaiApiKey,
  organization: openaiOrg,
});
const openaiInstance = new OpenAIApi(openAIConfig);


// Сохраняем сообщения от юзера
const messageStack = {};

// Функция для генерации ответа с помощью OpenAI
async function generateResponse(messageRaw, userId) {
  const userStack = messageStack[userId] || (messageStack[userId] = []);

  const prompt = userStack.length === 0
    ? `${context}\n${messageRaw.text}`
    : messageRaw.text;

  const message = { role: "user", content: prompt };

  const response = await openaiInstance.createChatCompletion({
    model: openaiModel,
    messages: [...userStack, message]
  });
  const responseMessage = response.data.choices[0].message;

  // Сохраняем
  userStack.push(message, responseMessage);

  if (userStack.length > 30) {
    messageStack[userId] = [
      ...userStack.slice(0, 5),
      ...userStack.slice(-25)
    ]
  }

  return responseMessage.content.trim();
}

// Слушаем сообщения от пользователей
bot.on('message', async (message) => {
  // Отвечаем только на текстовые сообщения
  if (message.text) {
    // Генерируем ответ с помощью OpenAI
    try {
      const userId = message.from.id;
      if (allowedIds && !allowedIds.includes(userId)) {
        return await bot.sendMessage(message.chat.id, wrongUserIdMessage)
      }
      const response = await generateResponse(message, userId);
      // Отправляем ответ пользователю
      await bot.sendMessage(message.chat.id, response);
    } catch (error) {
      console.dir(error)
      bot.sendMessage(message.chat.id, "Error");
    }
  }
});
