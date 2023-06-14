const Config = require('./Config');
const Stack = require('./Stack');
const AI = require('./AI');
const TelegramBot = require('node-telegram-bot-api');

const messageHelpers = {
    isCommand: (message) => /^\/[\/a-z]+/.test(message.text),
    getCommand: (message) => message.text.match(/^\/([\/@_a-z]+)/)[1],
    isReply: (message) => message.reply_to_message,
    isMessageFromGroup: (message) => message.chat.type === 'group' || message.chat.type === 'supergroup',
    // Проверяем что юзер из списка
    isUserUnallowed: (message, allowedIds) => allowedIds && !allowedIds?.includes(parseInt(message.from.id))
}

module.exports = class Bot {

    constructor({ configFile, stackFile }) {
        this.config = new Config(configFile);
        this.ai = new AI(this.config);
        this.stack = new Stack({ file: stackFile, config: this.config })

        this.telegramBot = new TelegramBot(this.config.telegramToken, { polling: true });
    }

    start() {
        this.telegramBot.on('message', async (message) => {
            try {
                const messagePromise = this.#messageHandler(message);
                this.sendBusyByMessage(message, messagePromise.catch(() => {}));
                await messagePromise
            } catch (error) {
                console.error(error);
                this.sendReply(message, "Error");
            }
        });
    }

    async #messageHandler(message) {
        // Отвечаем только на текстовые сообщения
        if (!message.text) {
            return await this.sendReply(message, this.config.wrongTypeOfMessage ?? "I understand only text messages");
         }

        // Проверяем что юзер из списка
        if (messageHelpers.isUserUnallowed(message, this.config.allowedIds)) {
            return sendReply(message, this.config.wrongUserIdMessage)
        }

        if (messageHelpers.isCommand(message)) {
            switch(messageHelpers.getCommand(message)) {
            case "reset":
                this.stack.resetByChatId(message.chat.id);
                return this.sendReply(message, this.config.messages?.resetMessage || "Conversation has been reset");

            case "start":
            default:
                return this.sendReply(message, this.config.message?.defaultHello || "?")
            }
        }

        // Сохраняем сообщение в стек
        this.stack.pushToStackTelegramMessage(message);

        // Генерируем ответ с помощью OpenAI
        const responseMessage = await this.ai.generateResponse(this.stack.getChainByMessage(message));

        // Отправляем ответ пользователю
        const responseTelegramMessage = await this.sendReply(message, responseMessage.content.trim())
        this.stack.pushToStackTelegramMessage(responseTelegramMessage);
    }

    // Отправляем ответ реплаем
    sendReply(message, text) {
        return this.telegramBot.sendMessage(message.chat.id, text, {
            reply_to_message_id: message.message_id,
        });
    }
    
    // Отправляем сообщение о том, что бот думает
    async sendBusyByMessage(message, promise) {
        var ended = false;
        promise.finally(() => {
            ended = true;
        });

        
        // Не отправляем сообщение сразу, а ждем 1 секунду
        await new Promise(resolve => setTimeout(resolve, 1000));
        if (ended) return; // Если ответ уже получен, то не отправляем сообщение
        
        const chatId = message.chat.id;
        this.telegramBot.sendChatAction(chatId, 'typing');
        
        const timer = setInterval(() => {
            this.telegramBot.sendChatAction(chatId, 'typing');
        }, 4500)

        promise.finally(() => {
            clearInterval(timer);
        });
    }

}