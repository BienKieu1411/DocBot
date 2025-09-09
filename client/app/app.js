class DocBotApp {
    constructor() {
        this.fileUploaded = false;
        this.isProcessing = false;
        this.chatHistory = [];
        this.currentFile = null;
        this.authManager = null;
        this.chatStorage = null;
        this.currentChatId = null;
        
        this.initAuthAndApp();
    }

    async initAuthAndApp() {
        // Wait for AuthManager to be available
        if (typeof AuthManager !== 'undefined') {
            this.authManager = new AuthManager();
            this.chatStorage = new ChatStorage();
        }
        
        await this.initializeApp();
    }

    async initializeApp() {
        // Initialize auth manager
        if (this.authManager) {
            const isLoggedIn = await this.authManager.init();
            if (!isLoggedIn) {
                // Nếu chưa đăng nhập thì set chế độ guest
                this.authManager.isGuest = true;
            }
        } else {
            // Nếu không có authManager, assume guest mode
            this.authManager = {
                isLoggedIn: () => false,
                isGuest: true,
                canSaveChat: () => false,
                currentUser: null
            };
        }
        
        // Set up chat storage
        if (!this.chatStorage) {
            this.chatStorage = {
                saveChat: () => ({ success: false, error: 'Please sign in to save chat' }),
                getChats: () => ({ success: false, error: 'Please sign in to view chat history' }),
                updateChatTitle: () => ({ success: false, error: 'Please sign in to update chat' }),
                deleteChat: () => ({ success: false, error: 'Please sign in to delete chat' })
            };
        }
        
        // If Supabase is not configured, show demo mode message
        if (typeof isSupabaseConfigured !== 'undefined' && !isSupabaseConfigured) {
            // Running in demo mode - Supabase not configured
        }
        
        this.updateUserInterface();
        await this.loadChatHistory();
        this.initializeEventListeners();
        this.setupAutoResize();
    }

    updateUserInterface() {
        const userInfo = document.getElementById('userInfo');
        const userEmail = document.getElementById('userEmail');
        const saveChatBtn = document.getElementById('saveChatBtn');
        const historyInfo = document.getElementById('historyInfo');

        if (this.authManager.isLoggedIn() && !this.authManager.isGuest) {
            userInfo.style.display = 'flex';
            userEmail.textContent = this.authManager.currentUser.email;
            if (saveChatBtn) {
                saveChatBtn.style.display = 'inline-block';
                saveChatBtn.disabled = false;
                saveChatBtn.classList.add('active-save-btn');
            }
            historyInfo.innerHTML = '<small class="success-msg">Chats will be saved automatically</small>';
        } else {
            userInfo.style.display = 'none';
            if (saveChatBtn) {
                saveChatBtn.style.display = 'none';
            }
            historyInfo.innerHTML = '<small class="warn-msg">Sign in to save chats</small>';
        }
    }

    initializeEventListeners() {
        // User info logout button
        const userLogoutBtn = document.getElementById('userLogoutBtn');
        if (userLogoutBtn) {
            userLogoutBtn.addEventListener('click', () => {
                this.handleLogout();
            });
        }

        // Main app events
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

        // Theme toggle
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

        // Settings menu
        const settingsBtn = document.getElementById('settingsBtn');
        const settingsMenu = document.getElementById('settingsMenu');
        const toggleThemeBtn = document.getElementById('toggleThemeBtn');
        const settingsLogoutBtn = document.getElementById('logoutBtn');

        // Hiển thị hoặc ẩn menu Settings
        if (settingsBtn && settingsMenu) {
            settingsBtn.addEventListener('click', (event) => {
                event.stopPropagation(); // Ngăn chặn sự kiện click lan ra ngoài
                const isMenuVisible = settingsMenu.style.display === 'block';
                settingsMenu.style.display = isMenuVisible ? 'none' : 'block';
            });

            // Đóng menu khi click ra ngoài
            document.addEventListener('click', (event) => {
                if (!settingsBtn.contains(event.target) && !settingsMenu.contains(event.target)) {
                    settingsMenu.style.display = 'none';
                }
            });
        }

        // Chuyển đổi chế độ Light/Dark Mode
        if (toggleThemeBtn && settingsMenu) {
            toggleThemeBtn.addEventListener('click', () => {
                const currentTheme = document.body.classList.contains('dark') ? 'dark' : 'light';
                const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
                document.body.classList.toggle('dark', nextTheme === 'dark');
                localStorage.setItem('theme', nextTheme);
                settingsMenu.style.display = 'none';
            });
        }

        // Xử lý đăng xuất từ settings menu
        if (settingsLogoutBtn) {
            settingsLogoutBtn.addEventListener('click', () => {
                window.location.href = '../login/';
            });
        }

        // Remove unused settings dropdown code
    }

    async handleLogout() {
        await this.authManager.signOut();
        window.location.href = '../login/';
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
            this.updateStatus('error', 'File type not supported. Please choose PDF, DOC/DOCX, TXT, MD, RTF, ODT.');
            return;
        }
        
        // Store file data for saving
        this.currentFile = {
            file: file,
            name: file.name,
            size: file.size,
            type: file.type,
            lastModified: file.lastModified
        };
        
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
        statusIndicator.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
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
            statusIndicator.innerHTML = '<i class="fas fa-check-circle"></i> Ready';
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
        
        // Thêm icon cho bot avatar
        if (sender === 'bot') {
            const icon = document.createElement('i');
            icon.className = 'fas fa-robot';
            avatarImg.appendChild(icon);
        }
        
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

    async resetChat() {
        // Lưu chat hiện tại trước khi reset (nếu đã đăng nhập)
        if (this.authManager.canSaveChat() && this.chatHistory.length > 0) {
            await this.autoSaveChat();
        }

        this.chatHistory = [];
        this.fileUploaded = false;
        this.isProcessing = false;
        this.currentFile = null;
        this.currentChatId = null;
    
        this.clearChatMessages();
    
        // Đảm bảo welcome screen hiển thị đúng cách
        const welcomeScreen = document.getElementById('welcomeScreen');
        if (welcomeScreen) {
            welcomeScreen.style.display = 'flex';
            welcomeScreen.style.flexDirection = 'column';
            welcomeScreen.style.alignItems = 'center';
            welcomeScreen.style.justifyContent = 'center';
        }
    
        const messageInput = document.getElementById('messageInput');
        const sendBtn = document.getElementById('sendBtn');
        messageInput.value = '';
        messageInput.disabled = true;
        messageInput.placeholder = 'Upload a document to start chatting...';
        sendBtn.disabled = true;
    
        const statusIndicator = document.getElementById('statusIndicator');
        if (statusIndicator) {
            statusIndicator.className = 'status-indicator waiting';
            statusIndicator.innerHTML = '<i class="fas fa-clock"></i> Waiting for document';
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
            const exportBtn = document.getElementById('exportChatBtn');
            exportBtn.classList.add('shake');
            exportBtn.innerHTML = '<i class="fas fa-exclamation-triangle"></i> No chat to export';
            setTimeout(() => {
                exportBtn.classList.remove('shake');
                exportBtn.innerHTML = '<i class="fas fa-download"></i> Export chat';
            }, 1500);
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

    async saveChat() {
        if (!this.authManager || !this.chatStorage || !this.authManager.canSaveChat()) {
            alert('Please sign in to save chat');
            return;
        }

        if (!this.chatHistory.length) {
            alert('No messages to save');
            return;
        }

        const title = this.chatHistory.find(m => m.sender === 'user')?.message?.slice(0, 40) || 'Untitled chat';
        const fileData = this.currentFile ? {
            name: this.currentFile.name,
            size: this.currentFile.size,
            type: this.currentFile.type,
            lastModified: this.currentFile.lastModified
        } : null;

        const chatData = {
            title,
            messages: this.chatHistory,
            fileData
        };

        const result = await this.chatStorage.saveChat(chatData);
        
        if (result.success) {
            this.currentChatId = result.data.id;
            alert('Chat saved successfully!');
            await this.loadChatHistory();
        } else {
            alert('Error saving chat: ' + result.error);
        }
    }

    async autoSaveChat() {
        if (!this.authManager || !this.chatStorage || !this.authManager.canSaveChat() || !this.chatHistory.length) return;

        const title = this.chatHistory.find(m => m.sender === 'user')?.message?.slice(0, 40) || 'Untitled chat';
        const fileData = this.currentFile ? {
            name: this.currentFile.name,
            size: this.currentFile.size,
            type: this.currentFile.type,
            lastModified: this.currentFile.lastModified
        } : null;

        const chatData = {
            title,
            messages: this.chatHistory,
            fileData
        };

        const result = await this.chatStorage.saveChat(chatData);
        if (result.success) {
            this.currentChatId = result.data.id;
        }
    }

    async loadChatHistory() {
        if (!this.authManager || !this.chatStorage || !this.authManager.canSaveChat()) return;

        const result = await this.chatStorage.getChats();
        if (result.success) {
            this.refreshHistoryList(result.data);
        }
    }

    refreshHistoryList(chats = []) {
        const list = document.getElementById('historyList');
        if (!list) return;
        
        list.innerHTML = '';
        chats.forEach((chat) => {
            const li = document.createElement('li');
            li.dataset.id = chat.id;
            li.innerHTML = `
                <div class="chat-item">
                    <span class="chat-title">${chat.title}</span>
                    <span class="chat-meta">${new Date(chat.created_at).toLocaleString()}</span>
                    <div class="chat-actions">
                        <button class="btn-rename" onclick="event.stopPropagation(); app.renameChat('${chat.id}', '${chat.title}')">Rename</button>
                        <button class="btn-delete" onclick="event.stopPropagation(); app.deleteChat('${chat.id}')">Delete</button>
                    </div>
                </div>
            `;
            li.addEventListener('click', () => {
                list.querySelectorAll('li').forEach(x => x.classList.remove('active'));
                li.classList.add('active');
                this.loadChat(chat);
            });
            list.appendChild(li);
        });
    }

    async loadChat(chat) {
        this.clearChatMessages();
        const chatMessages = document.getElementById('chatMessages');
        this.chatHistory = [];
        this.currentChatId = chat.id;
        
        // Load file info if exists
        if (chat.file_data) {
            this.currentFile = {
                file: null, // File object not available when loading from database
                name: chat.file_data.name,
                size: chat.file_data.size,
                type: chat.file_data.type,
                lastModified: chat.file_data.lastModified
            };
            document.getElementById('fileName').textContent = chat.file_data.name;
            document.getElementById('fileSize').textContent = `${(chat.file_data.size / 1024 / 1024).toFixed(2)} MB`;
            document.getElementById('fileInfo').classList.add('show');
            this.fileUploaded = true;
        }

        chat.messages.forEach((m) => {
            const messageDiv = document.createElement('div');
            messageDiv.className = `message ${m.sender}`;
            const avatar = document.createElement('div');
            avatar.className = 'message-avatar';
            const avatarImg = document.createElement('div');
            avatarImg.className = m.sender === 'user' ? 'avatar-user' : 'avatar-bot';
            
            // Thêm icon cho bot avatar
            if (m.sender === 'bot') {
                const icon = document.createElement('i');
                icon.className = 'fas fa-robot';
                avatarImg.appendChild(icon);
            }
            
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
        if (copyLastBtn) copyLastBtn.disabled = !chat.messages.some(x => x.sender === 'bot');
        const regenBtn = document.getElementById('regenBtn');
        if (regenBtn) regenBtn.disabled = !chat.messages.some(x => x.sender === 'user');
    }

    async renameChat(chatId, currentTitle) {
        if (!this.chatStorage) {
            alert('Please sign in to rename chat');
            return;
        }

        const newTitle = prompt('Enter new name for chat:', currentTitle);
        if (newTitle && newTitle !== currentTitle) {
            const result = await this.chatStorage.updateChatTitle(chatId, newTitle);
            if (result.success) {
                await this.loadChatHistory();
            } else {
                alert('Error renaming chat: ' + result.error);
            }
        }
    }

    async deleteChat(chatId) {
        if (!this.chatStorage) {
            alert('Please sign in to delete chat');
            return;
        }

        if (confirm('Are you sure you want to delete this chat?')) {
            const result = await this.chatStorage.deleteChat(chatId);
            if (result.success) {
                await this.loadChatHistory();
                if (this.currentChatId === chatId) {
                    this.resetChat();
                }
            } else {
                alert('Error deleting chat: ' + result.error);
            }
        }
    }
}

function askQuestion(question) {
    const messageInput = document.getElementById('messageInput');
    messageInput.value = question;
    messageInput.focus();
}

// Global app instance
let app;

document.addEventListener('DOMContentLoaded', () => {
    app = new DocBotApp();
});
