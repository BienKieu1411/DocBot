class DocBotApp {
    constructor() {
        this.fileUploaded = false;
        this.isProcessing = false;
        this.chatHistory = [];
        this.initializeEventListeners();
        this.setupAutoResize();
    }

    initializeEventListeners() {
        const fileInput = document.getElementById('fileInput');
        const dropZone = document.querySelector('.file-drop-zone');
        const messageInput = document.getElementById('messageInput');
        const sendBtn = document.getElementById('sendBtn');
        const newChatBtn = document.getElementById('newChatBtn');
        const exportChatBtn = document.getElementById('exportChatBtn');
        const charCounter = document.getElementById('charCounter');
        const copyLastBtn = document.getElementById('copyLastBtn');
        const regenBtn = document.getElementById('regenBtn');
        const themeToggleBtn = document.getElementById('themeToggleBtn');
        const saveChatBtn = document.getElementById('saveChatBtn');
        const deleteChatBtn = document.getElementById('deleteChatBtn');
        const historyList = document.getElementById('historyList');

        fileInput.addEventListener('change', (e) => this.handleFileUpload(e));
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, (e) => e.preventDefault());
        });
        dropZone.addEventListener('dragenter', () => dropZone.classList.add('dragover'));
        dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
        dropZone.addEventListener('drop', (e) => {
            dropZone.classList.remove('dragover');
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                this.processFiles(files);
            }
        });
        messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
        sendBtn.addEventListener('click', () => this.sendMessage());
        messageInput.addEventListener('input', () => {
            if (charCounter) charCounter.textContent = String(messageInput.value.length);
        });
        if (newChatBtn) newChatBtn.addEventListener('click', () => this.resetChat());
        if (exportChatBtn) exportChatBtn.addEventListener('click', () => this.exportChat());
        if (copyLastBtn) copyLastBtn.addEventListener('click', () => this.copyLastAnswer());
        if (regenBtn) regenBtn.addEventListener('click', () => this.regenerateAnswer());
        if (saveChatBtn) saveChatBtn.addEventListener('click', () => this.saveChat());
        if (deleteChatBtn) deleteChatBtn.addEventListener('click', () => this.deleteSelectedChat());

        const applyTheme = (mode) => {
            document.body.classList.toggle('dark', mode === 'dark');
        };
        const saved = localStorage.getItem('theme') || 'light';
        applyTheme(saved);
        if (themeToggleBtn) themeToggleBtn.addEventListener('click', () => {
            const current = document.body.classList.contains('dark') ? 'dark' : 'light';
            const next = current === 'dark' ? 'light' : 'dark';
            localStorage.setItem('theme', next);
            applyTheme(next);
            themeToggleBtn.textContent = next === 'dark' ? 'Light mode' : 'Dark mode';
        });
        if (themeToggleBtn) themeToggleBtn.textContent = (saved === 'dark') ? 'Light mode' : 'Dark mode';
        this.refreshHistoryList();
    }

    setupAutoResize() {
        const textarea = document.getElementById('messageInput');
        textarea.addEventListener('input', () => {
            textarea.style.height = 'auto';
            textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
        });
    }

    handleFileUpload(event) {
        const files = event.target.files;
        if (!files || files.length === 0) return;
        this.processFiles(files);
    }

    processFiles(fileList) {
        const file = fileList[0];
        if (!file) return;
        const allowedMimeTypes = [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'text/plain',
            'text/markdown',
            'application/rtf',
            'application/vnd.oasis.opendocument.text'
        ];
        const allowedExtensions = ['pdf','doc','docx','txt','md','markdown','rtf','odt'];
        const fileExt = (file.name.split('.').pop() || '').toLowerCase();
        if (!allowedMimeTypes.includes(file.type) && !allowedExtensions.includes(fileExt)) {
            this.updateStatus('error', 'File không được hỗ trợ. Chọn PDF, DOC/DOCX, TXT, MD, RTF, ODT.');
            return;
        }
        document.getElementById('fileName').textContent = file.name;
        document.getElementById('fileSize').textContent = `${(file.size / 1024 / 1024).toFixed(2)} MB`;
        document.getElementById('fileInfo').classList.add('show');
        this.processFile();
    }

    processFile() {
        const processingIndicator = document.getElementById('processingIndicator');
        const statusIndicator = document.getElementById('statusIndicator');
        this.isProcessing = true;
        processingIndicator.classList.add('show');
        statusIndicator.className = 'status-indicator processing';
        statusIndicator.textContent = 'Đang xử lý...';
        setTimeout(() => {
            processingIndicator.classList.remove('show');
            this.fileUploaded = true;
            this.isProcessing = false;
            const messageInput = document.getElementById('messageInput');
            const sendBtn = document.getElementById('sendBtn');
            messageInput.disabled = false;
            sendBtn.disabled = false;
            messageInput.placeholder = 'Type your question about the document...';
            statusIndicator.className = 'status-indicator ready';
            statusIndicator.textContent = 'Ready';
            const welcomeScreen = document.getElementById('welcomeScreen');
            if (welcomeScreen) welcomeScreen.style.display = 'none';
            this.addMessage('Your document is ready. Ask me anything about it.', 'bot');
        }, 3000);
    }    

    sendMessage() {
        const messageInput = document.getElementById('messageInput');
        const message = messageInput.value.trim();
        if (!message || !this.fileUploaded || this.isProcessing) return;
        this.addMessage(message, 'user');
        messageInput.value = '';
        messageInput.style.height = 'auto';
        setTimeout(() => {
            this.generateResponse(message);
        }, 1000);
    }

    addMessage(message, sender) {
        const chatMessages = document.getElementById('chatMessages');
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}`;
        const avatar = document.createElement('div');
        avatar.className = 'message-avatar';
        const avatarImg = document.createElement('div');
        avatarImg.className = sender === 'user' ? 'avatar-user' : 'avatar-bot';
        avatar.appendChild(avatarImg);
        const content = document.createElement('div');
        content.className = 'message-content';
        content.textContent = message;
        const time = document.createElement('div');
        time.className = 'message-time';
        time.textContent = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        content.appendChild(time);
        messageDiv.appendChild(avatar);
        messageDiv.appendChild(content);
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        this.chatHistory.push({ sender, message, at: Date.now() });
    }

    generateResponse(userMessage) {
        const responses = {
            'summary': 'Based on your uploaded document, here is a high-level summary: [Section 1 - Introduction], [Section 2 - Core Content], [Section 3 - Conclusion]. The document is well structured and informative.',
            'topic': 'The document focuses on the topic [Main Topic] with in-depth aspects. It includes fundamentals, practical applications, and related studies.',
            'key': 'Key takeaways include: 1) [Point 1], 2) [Point 2], 3) [Point 3]. These form the core of the document.',
            'pages': 'The document contains a total of [X] pages divided into [Y] major sections. Each page is informative and well laid out.',
            'default': `Regarding "${userMessage}", I found relevant information in the document. I can elaborate on specific parts if you want.`
        };
        const lowerMessage = userMessage.toLowerCase();
        let response = responses.default;
        if (lowerMessage.includes('summary') || lowerMessage.includes('summarize')) response = responses.summary;
        else if (lowerMessage.includes('topic')) response = responses.topic;
        else if (lowerMessage.includes('key')) response = responses.key;
        else if (lowerMessage.includes('page')) response = responses.pages;
        this.addMessage(response, 'bot');
        const copyLastBtnRef = document.getElementById('copyLastBtn');
        if (copyLastBtnRef) copyLastBtnRef.disabled = false;
        const regenBtnRef = document.getElementById('regenBtn');
        if (regenBtnRef) regenBtnRef.disabled = false;
    }

    updateStatus(type, message) {
        console.log(`${type}: ${message}`);
    }

    resetChat() {
        this.chatHistory = [];
        this.fileUploaded = false;
        this.isProcessing = false;
    
        this.clearChatMessages();
    
        const welcomeScreen = document.getElementById('welcomeScreen');
        if (welcomeScreen) welcomeScreen.style.display = 'block';
    
        const messageInput = document.getElementById('messageInput');
        const sendBtn = document.getElementById('sendBtn');
        messageInput.value = '';
        messageInput.disabled = true;
        messageInput.placeholder = 'Upload a document first to start chatting...';
        sendBtn.disabled = true;
    
        const statusIndicator = document.getElementById('statusIndicator');
        if (statusIndicator) {
            statusIndicator.className = 'status-indicator waiting';
            statusIndicator.textContent = 'Waiting for document';
        }
    
        const fileInfo = document.getElementById('fileInfo');
        if (fileInfo) fileInfo.classList.remove('show');
    
        const fileName = document.getElementById('fileName');
        const fileSize = document.getElementById('fileSize');
        if (fileName) fileName.textContent = '';
        if (fileSize) fileSize.textContent = '';
    
        const fileInput = document.getElementById('fileInput');
        if (fileInput) fileInput.value = '';
    }
    
    clearChatMessages() {
        const chatMessages = document.getElementById('chatMessages');
        const welcomeScreen = document.getElementById('welcomeScreen');
    
        Array.from(chatMessages.children).forEach(child => {
            if (child !== welcomeScreen) {
                chatMessages.removeChild(child);
            }
        });
    
        this.chatHistory = [];
    
        const copyLastBtn = document.getElementById('copyLastBtn');
        if (copyLastBtn) copyLastBtn.disabled = true;
    
        const regenBtn = document.getElementById('regenBtn');
        if (regenBtn) regenBtn.disabled = true;
    }    

    exportChat() {
        if (this.chatHistory.length === 0) {
            alert('No chat messages to export');
            return;
        }
        const lines = this.chatHistory.map((m) => {
            const timestamp = new Date(m.at).toLocaleString();
            return `[${timestamp}] ${m.sender === 'user' ? 'User' : 'Bot'}: ${m.message}`;
        });
        const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `chat_export_${new Date().toISOString().split('T')[0]}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    copyLastAnswer() {
        const messages = Array.from(document.querySelectorAll('.message.bot .message-content'));
        if (!messages.length) return;
        const last = messages[messages.length - 1];
        const text = last.childNodes[0]?.textContent || '';
        if (!text) return;
        navigator.clipboard.writeText(text).catch(() => {});
    }

    regenerateAnswer() {
        const lastUser = Array.from(document.querySelectorAll('.message.user .message-content')).pop();
        if (!lastUser) return;
        const question = lastUser.childNodes[0]?.textContent || '';
        if (!question) return;
        setTimeout(() => {
            this.addMessage(`Here is another take: ${question}`, 'bot');
        }, 800);
    }

    saveChat() {
        if (!this.chatHistory.length) return;
        const id = `chat_${Date.now()}`;
        const title = this.chatHistory.find(m => m.sender === 'user')?.message?.slice(0, 40) || 'Untitled chat';
        const payload = { id, title, items: this.chatHistory, savedAt: Date.now() };
        const all = JSON.parse(localStorage.getItem('docbot_history') || '[]');
        all.unshift(payload);
        localStorage.setItem('docbot_history', JSON.stringify(all));
        this.refreshHistoryList();
    }

    deleteSelectedChat() {
        const active = document.querySelector('.history-list li.active');
        if (!active) return;
        const id = active.dataset.id;
        let all = JSON.parse(localStorage.getItem('docbot_history') || '[]');
        all = all.filter(c => c.id !== id);
        localStorage.setItem('docbot_history', JSON.stringify(all));
        this.refreshHistoryList();
        const deleteBtn = document.getElementById('deleteChatBtn');
        if (deleteBtn) deleteBtn.disabled = true;
    }

    refreshHistoryList() {
        const list = document.getElementById('historyList');
        if (!list) return;
        const all = JSON.parse(localStorage.getItem('docbot_history') || '[]');
        list.innerHTML = '';
        all.forEach((c) => {
            const li = document.createElement('li');
            li.dataset.id = c.id;
            li.innerHTML = `<span>${c.title}</span><span class="meta">${new Date(c.savedAt).toLocaleString()}</span>`;
            li.addEventListener('click', () => {
                list.querySelectorAll('li').forEach(x => x.classList.remove('active'));
                li.classList.add('active');
                const deleteBtn = document.getElementById('deleteChatBtn');
                if (deleteBtn) deleteBtn.disabled = false;
                this.loadChat(c);
            });
            list.appendChild(li);
        });
    }

    loadChat(chat) {
        this.clearChatMessages();
        const chatMessages = document.getElementById('chatMessages');
        this.chatHistory = [];
        chat.items.forEach((m) => {
            const messageDiv = document.createElement('div');
            messageDiv.className = `message ${m.sender}`;
            const avatar = document.createElement('div');
            avatar.className = 'message-avatar';
            const avatarImg = document.createElement('div');
            avatarImg.className = m.sender === 'user' ? 'avatar-user' : 'avatar-bot';
            avatar.appendChild(avatarImg);
            const content = document.createElement('div');
            content.className = 'message-content';
            content.textContent = m.message;
            const time = document.createElement('div');
            time.className = 'message-time';
            time.textContent = new Date(m.at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
            content.appendChild(time);
            messageDiv.appendChild(avatar);
            messageDiv.appendChild(content);
            chatMessages.appendChild(messageDiv);
            this.chatHistory.push(m);
        });
        chatMessages.scrollTop = chatMessages.scrollHeight;
        const copyLastBtn = document.getElementById('copyLastBtn');
        if (copyLastBtn) copyLastBtn.disabled = !chat.items.some(x => x.sender === 'bot');
        const regenBtn = document.getElementById('regenBtn');
        if (regenBtn) regenBtn.disabled = !chat.items.some(x => x.sender === 'user');
    }
}

function askQuestion(question) {
    const messageInput = document.getElementById('messageInput');
    messageInput.value = question;
    messageInput.focus();
}

document.addEventListener('DOMContentLoaded', () => {
    new DocBotApp();
});
