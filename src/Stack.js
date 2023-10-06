const fs = require('fs');
const path = require('path');

// Дебаунсер для сохранения стека
function debounce(func, timeout = 300) {
	let timer;
	return (...args) => {
		clearTimeout(timer);
		timer = setTimeout(() => { func.apply(this, args); }, timeout);
	};
}

module.exports = class Stack {
	constructor(config) {
		const file = path.resolve(global.__appdir, "data", config.name, "chat.json");
		Object.assign(this, {
			data: {},
			file, config
		});

		// Проверяем что файл существует
		if (fs.existsSync(file)) {
			try {
				this.data = JSON.parse(fs.readFileSync(file));
			} catch (error) {
				console.error(error);
			}
		}

		this.updateStack = debounce(this._updateStack.bind(this), config.stackUpdateTimeout ?? 300);
	}

	// Сбрасываем стек пользователя
	resetByChatId(chatId) {
		this.data[chatId] = {};
		this.updateStack();
	}

    getStackByChatId(chatId) {
        return this.data[chatId] || (this.data[chatId] = {});
    }

	//  Сохранение в файловую систему
	_updateStack() {
		const jsonData = JSON.stringify(this.data);
		// Создаем директорию если нет path.resolve(global.__appdir, "data", config.name)
		if (!fs.existsSync(path.dirname(this.file))) {
			fs.mkdirSync(path.dirname(this.file), { recursive: true });
		}
		fs.writeFileSync(this.file, jsonData);
	}

	// Удаляем старые сообщения из стэка
	reduceStack(chatId) {
		const stack = this.getStackByChatId(chatId);
		const stackLength = Object.keys(stack).length;
		const maxStackLength = this.config.maxStackLength ?? 100;

		if (stackLength > maxStackLength) {
			const keys = Object.keys(stack).sort((a, b) => a - b);
			const keysToDelete = keys.slice(0, stackLength - maxStackLength);
			keysToDelete.forEach(key => delete stack[key]);
		}
	}

	getChainByTelegramMessage(telegramMessage) {
		var chain;
		const stack = this.getStackByChatId(telegramMessage.chat.id);
		let currentMessage = stack[telegramMessage.message_id];

		// Если сообщение без реплая
		if (!currentMessage.replyTo) {
			// То берем все значения из стэка и сортируем их по id по возрастанию
			chain = Object.values(stack).sort((a, b) => a.id - b.id);
		
		// Если сообщение с реплаем - то берем все сообщения по цепочке
		} else {
			chain = []
			while (currentMessage) {
				chain.push(currentMessage);
				currentMessage = stack[currentMessage.replyTo];
			}
			chain = chain.reverse();
		}

		return chain;
	}

	pushToStackTelegramMessage(telegramMessage) {
		// Получаем данные из сообщения
		const { chat: { id: chatId }, message_id: id, from: { is_bot: isBot, id: fromId }, reply_to_message: reply, text } = telegramMessage;
		// Получаем стэк по чату
		const stack = this.getStackByChatId(chatId);
		// Собираем и сохраняем сообщение в стэк
		const savedMessage = stack[id] = {
			id, role: isBot ? "assistant" : "user", name: `u${fromId}`, content: text
		};

		// Если есть реплай - сохраняем ссылку на него и проверяем что он есть в стэке
		if (reply) {
			savedMessage.replyTo = reply.message_id;
			
			// Проверяем что в стэке есть этот реплай
			if (!stack[reply.message_id]) {
				this.pushToStackTelegramMessage({
					...reply,
					chat: { id: chatId }
				});
				return;
			}
		}

		this.reduceStack(chatId);
		this.updateStack();
	}
}