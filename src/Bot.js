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

    constructor({ config }) {
        this.config = config;
        this.ai = new AI(config);
        this.stack = new Stack(config)

        this.telegramBot = new TelegramBot(config.telegramToken, { polling: true });

        process.on('SIGTERM', () => {
            console.log("Telegram bot stopped");
            this.telegramBot.stopPolling();
            process.exit(0);
        });
        
        
        this.telegramBot.on('message', async (message) => {
            try {
                const messagePromise = this.#messageHandler(message);
                this.sendBusyByMessage(message, messagePromise.catch(() => {}));
                await messagePromise
            } catch (error) {
                console.error(error);
                this.sendReplyTo(message, "Error");
            }
        });
    }

    async #messageHandler(message) {
        // Отвечаем только на текстовые сообщения
        if (!message.text) {
            return await this.sendReplyTo(message, this.config.messages.wrongTypeOfMessage);
        }

        // Проверяем что юзер из списка
        if (messageHelpers.isUserUnallowed(message, this.config.allowedIds)) {
            return this.sendReplyTo(message, this.config.messages.wrongUserIdMessage)
        }

        if (messageHelpers.isCommand(message)) {
            switch(messageHelpers.getCommand(message)) {
            case "reset":
                this.stack.resetByChatId(message.chat.id);
                return this.sendReplyTo(message, this.config.messages.resetMessage);

            case "start":
            default:
                return this.sendReplyTo(message, this.config.messages.defaultHello || "?")
            }
        }

        // Сохраняем сообщение в стек
        this.stack.pushToStackTelegramMessage(message);

        // Генерируем ответ с помощью OpenAI
        const responseMessage = await this.ai.generateResponse(this.stack.getChainByTelegramMessage(message));

        // Отправляем ответ пользователю
        const responseTelegramMessage = await this.sendReplyTo(message, responseMessage.content.trim())
        this.stack.pushToStackTelegramMessage(responseTelegramMessage);
    }

    // Отправляем ответ реплаем
    sendReplyTo(message, text) {
        return this.telegramBot.sendMessage(message.chat.id, text, { reply_to_message_id: message.message_id });
    }
    
    // Отправляем сообщение о том, что бот в процессе
    async sendBusyByMessage({ chat: { id: chatId }}, promise) {
        var ended = false;
        promise.finally(() => { ended = true; });
        
        await new Promise(resolve => setTimeout(resolve, 1000)); // Не отправляем сообщение сразу, а ждем 1 секунду
        if (ended) return; // Если ответ уже получен, то не отправляем сообщение
        
        this.telegramBot.sendChatAction(chatId, 'typing');
        
        const timer = setInterval(() => this.telegramBot.sendChatAction(chatId, 'typing'), 4500)
        promise.finally(() => clearInterval(timer));
    }

}