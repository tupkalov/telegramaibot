const { Configuration, OpenAIApi } = require('openai');
const { encode } = require("gpt-3-encoder")
const Stack = require('./Stack')

module.exports = class OpenAI {
    constructor(config) {
        this.config = config;

        // Создайте экземпляр OpenAI
        this.instance = new OpenAIApi(new Configuration({
            apiKey: this.config.openaiApiKey,
            organization: this.config.openaiOrg,
        }));
    }

    // Возвращает длину всех сообщений в местных попугаях
    static getTokenLength(stack) {
        return encode(stack.map(val => val.content).join(' ')).length
    }

    // Генерируем ответ
    async generateResponse(messagesChain, { model } = {}) {
        try {
            const stackToSend = this.#prepareStack(messagesChain);

            const response = await this.instance.createChatCompletion({
                model: model ?? this.config.openaiModel,
                messages: stackToSend,
                max_tokens: this.config.maxTokens
            });

            return response.data.choices[0].message;
        } catch (e) {
            if (e.isAxiosError) {
                console.error("AxiosError: " + e.message)
                console.log(e.response?.data)
                e = new Error("AxiosError " + e.response?.status + " " + e.response?.statusText)
            }
            throw e;
        }
    }

    // Подготавливаем стек для отправки в OpenAI
	#prepareStack(messagesChain) {
        const firstMessage = { role: "system", content: this.config.context };
		
        while (OpenAI.getTokenLength([firstMessage, ...messagesChain]) > this.config.maxTokenSize) {
			messagesChain.splice(0, 1);
		}
        
		return [firstMessage, ...messagesChain].reduce((acc, { role, content, name }) => {
            if (role && content) acc.push({ role, content })
            if (name) acc[acc.length - 1].name = name;
            return acc;
        }, []);
	}
}