const TelegramBot = require('node-telegram-bot-api');
const { Configuration, OpenAIApi } = require('openai');
const yaml = require('js-yaml');
const fs = require('fs');

const { config } = {
  ...yaml.load(fs.readFileSync(__dirname + '/../config.yaml', 'utf8'))
}

// Достаем конфиги из переменных окружения
for (const configParamName of [
  "openaiApiKey",
  "openaiModel",
  "openaiOrg",
  "telegramToken",
  "context",
  "allowedIds",
  "wrongUserIdMessage",
  "maxTokens"
]) {
  if (![configParamName]) throw new Error(`config.${configParamName} is not defined!`);
}


// Создайте экземпляр бота Telegram
const bot = new TelegramBot(config.telegramToken, { polling: true });

// Создайте экземпляр OpenAI
const openAIConfig = new Configuration({
  apiKey: config.openaiApiKey,
  organization: config.openaiOrg,
});
const openaiInstance = new OpenAIApi(openAIConfig);


// Сохраняем сообщения от юзера
let messageStack = {};
const file = __dirname + '/../data/chat.json';
if (fs.existsSync(file)) {
  const jsonData = fs.readFileSync(file);
  messageStack = JSON.parse(jsonData);
}
function updateStack() {
  const jsonData = JSON.stringify(messageStack);
  fs.writeFileSync(file, jsonData);
}

const firstMessage = { role: "user", content: config.context };

// Возвращает длину всех сообщений в местных попугаях
function getTokenLength(stack) {
  return stack.reduce((acc, val) => {
    return acc + val.content.split(' ').length
  }, 0)
}

// Функция которая уменьшает количество сообщений
function reduceStackToSend(stack) {
  const MAX_TOKEN_SIZE = config.maxTokenSize || 1100;
  while (getTokenLength(stack) > MAX_TOKEN_SIZE) {
    stack.splice(5, 1);
  }
  return stack;
}

// Функция для генерации ответа с помощью OpenAI
async function generateResponse(messageRaw, userId) {
  const userStack = messageStack[userId] || (messageStack[userId] = []);

  const message = { role: "user", content: messageRaw.text };
  const stackToSend = reduceStackToSend([firstMessage, ...userStack, message]);

  const response = await openaiInstance.createChatCompletion({
    model: config.openaiModel,
    messages: stackToSend,
    max_tokens: config.maxTokens
  });
  const responseMessage = response.data.choices[0].message;

  // Сохраняем
  userStack.push(message, responseMessage);
  updateStack()

  return responseMessage.content.trim();
}

// Слушаем сообщения от пользователей
bot.on('message', async (message) => {
  // Отвечаем только на текстовые сообщения
  if (message.text) {

    // Сброс диалога
    if (message.text === "/reset") {
      delete messageStack[message.from.id];
      updateStack();
      return await bot.sendMessage(message.chat.id, "ok")
    } else if(message.text === "/start") {
      message.text = config.defaultHello;
    }

    // Генерируем ответ с помощью OpenAI
    try {
      const userId = message.from.id;
      if (config.allowedIds && !config.allowedIds.includes(parseInt(userId))) {
        return await bot.sendMessage(message.chat.id, config.wrongUserIdMessage)
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
