const Stack = require('./Stack');
const AI = require('./AI');
const TelegramBot = require('node-telegram-bot-api');

const messageHelpers = {
    isCommand: (message) => /^\/[\/a-z]+/.test(message.text),
    getCommand: (message) => {
        const entities = message.entities || message.caption_entities;
        const text = message.text || message.caption;
        if (entities) for (const entity of entities) {
            if (entity.type === "bot_command") {
                return text.slice(entity.offset, entity.offset + entity.length).replace(/^\/+/, '');
            }
        }
    },
    isReply: (message) => message.reply_to_message,
    isMessageFromGroup: (message) => message.chat.type === 'group' || message.chat.type === 'supergroup',
    // Проверяем что юзер из списка
    isUserUnallowed: (message, allowedIds) => allowedIds && !allowedIds?.includes(parseInt(message.from.id)),
    findPhoto(message) {
        const MAX_PIXELS = 40400;
        if (message.photo) {
            return message.photo.reverse().find(photo => photo.file_size < MAX_PIXELS);
        }
    },
    deleteCommands(text) {
        return text.replace(/\/[a-z_]+/g, '').trim();
    }
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
        
        
        this.telegramBot.on('message', async (message, options) => {
            try {
                const messagePromise = this.#messageHandler(message, options);
                this.sendBusyByMessage(message, messagePromise.catch(() => {}));
                await messagePromise
            } catch (error) {
                console.error(error);
                this.sendReplyTo(message, "Error");
            }
        });
    }

    async #messageHandler(message, { type }) {

        // Проверяем что юзер из списка
        if (messageHelpers.isUserUnallowed(message, this.config.allowedIds)) {
            return this.sendReplyTo(message, this.config.messages.wrongUserIdMessage)
        }

        var responseMessage, responseTelegramMessage;
        try {
            switch (type) {


            case "text": {
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
                let model;
                if (messageHelpers.getCommand(message) === "gpt4_1106") {
                    model = "gpt-4-1106-preview";
                    message.text = message.text.replace(/^\/gpt4_1106/, '');
                }

                // Сохраняем сообщение в стек
                this.stack.pushToStackTelegramMessage(message);
        
                // Генерируем ответ с помощью OpenAI
                responseMessage = await this.ai.generateResponse(this.stack.getChainByTelegramMessage(message), { model });
        
                // Отправляем ответ пользователю
                responseTelegramMessage = await this.sendReplyTo(message, responseMessage.content.trim())
                this.stack.pushToStackTelegramMessage(responseTelegramMessage);
                break;
            }
            case "photo":
                if (messageHelpers.getCommand(message) !== "gpt4_vision") throw new Error('WrongTypeOfMessage');
                const photo = messageHelpers.findPhoto(message);
                const fileLink = await this.telegramBot.getFileLink(photo.file_id);
                const messages = [
                    { role: "system", content: this.config.context },
                    { role: "user", content: [{
                            type: "text",
                            text: messageHelpers.deleteCommands(message.caption),
                        }, {
                            type: "image_url",
                            image_url: {
                                url: fileLink
                            }
                        }]
                    }
                ];
                // Генерируем ответ с помощью OpenAI
                responseMessage = await this.ai.generateResponse(messages, { model: "gpt-4-vision-preview" });
        
                // Отправляем ответ пользователю
                await this.sendReplyTo(message, responseMessage.content.trim())
                break;

            default:
                throw new Error('WrongTypeOfMessage');
            }

        } catch (error) {
            switch (error.message) {
            case "WrongTypeOfMessage":
                return this.sendReplyTo(message, this.config.messages.wrongTypeOfMessage);
            }
            throw error;
        }
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