// Simple MD5 implementation for Gravatar (if not present)
function md5(str) {
    // Use a CDN if you want a full implementation, here is a minimal fallback
    // For production, use a proper library
    return CryptoJS ? CryptoJS.MD5(str).toString() : '';
}
class DocBotApp {
    constructor() {
        this.filesUploaded = false;
        this.isProcessing = false;
        this.chatHistory = [];
        this.uploadedFiles = [];
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
                // Guest mode: do not redirect; continue with limited features
                this.currentUser = null;
            }
            
            // Set up auth state change listener
            this.authManager.handleAuthStateChange((event, session) => {
                if (event === 'SIGNED_OUT') {
                    this.currentUser = null;
                    this.updateUserInterface();
                } else if (event === 'SIGNED_IN') {
                    // Always use authManager.currentUser for info
                    this.currentUser = this.authManager.currentUser;
                    this.updateUserInterface();
                }
            });
        } else {
            // If no auth manager, continue in guest mode
            this.currentUser = null;
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
        const accountEmail = document.getElementById('accountEmail');
        const accountAvatar = document.getElementById('accountAvatar');
        const accountStatus = document.getElementById('accountStatus');

        if (!historyInfo) return;

        if (this.authManager.isLoggedIn() && this.authManager.currentUser) {
            const user = this.authManager.currentUser;
            if (userInfo) userInfo.style.display = 'flex';
            if (userEmail) userEmail.textContent = user.email || '';
            historyInfo.innerHTML = '<small class="success-msg">Chats will be saved automatically</small>';
            if (accountEmail) accountEmail.textContent = user.email || '';
            if (accountStatus) accountStatus.textContent = 'Active';
            if (accountAvatar) {
                let avatarUrl = '';
                if (user.avatar_url) {
                    avatarUrl = user.avatar_url;
                } else if (user.email) {
                    avatarUrl = `https://www.gravatar.com/avatar/${md5(user.email.trim().toLowerCase())}?d=identicon`;
                } else {
                    avatarUrl = '';
                }
                accountAvatar.src = avatarUrl;
            }
        } else {
            if (userInfo) userInfo.style.display = 'none';
            historyInfo.innerHTML = '<small class="warn-msg">Sign in to save chats</small>';
            if (accountEmail) accountEmail.textContent = '';
            if (accountStatus) accountStatus.textContent = '';
            if (accountAvatar) accountAvatar.src = '';
        }
    }

    initializeEventListeners() {
        // User info logout button
        // removed external user logout button (handled in settings menu)

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

        // Global fallback toggler for inline onclick
        window.__toggleSettingsMenu = () => {
            if (!settingsMenu) return;
            const isShown = settingsMenu.classList.contains('show');
            settingsMenu.classList.toggle('show', !isShown);
        };

        // Delegated fallback to guarantee click works even if listeners are lost
        document.addEventListener('click', (evt) => {
            const target = evt.target;
            // Settings button or icon inside it
            if (target.id === 'settingsBtn' || (target.closest && target.closest('#settingsBtn'))) {
                console.log('Delegated: settingsBtn');
                if (evt.stopImmediatePropagation) evt.stopImmediatePropagation();
                evt.stopPropagation();
                evt.preventDefault();
                if (settingsMenu) {
                    const isShown = settingsMenu.classList.contains('show');
                    settingsMenu.classList.toggle('show', !isShown);
                }
                return;
            }
            // New chat
            if (target.id === 'newChatBtn' || (target.closest && target.closest('#newChatBtn'))) {
                console.log('Delegated: newChatBtn');
                evt.preventDefault();
                this.resetChat();
                return;
            }
            // Export chat
            if (target.id === 'exportChatBtn' || (target.closest && target.closest('#exportChatBtn'))) {
                console.log('Delegated: exportChatBtn');
                evt.preventDefault();
                this.exportChat();
                return;
            }
            // Click outside settings menu closes it
            if (settingsMenu && settingsBtn && settingsMenu.classList.contains('show')) {
                if (!settingsBtn.contains(target) && !settingsMenu.contains(target)) {
                    settingsMenu.classList.remove('show');
                }
            }
        }, true);

        // Hiển thị hoặc ẩn menu Settings
        if (settingsBtn && settingsMenu) {
            const openCloseMenu = () => {
                const isShown = settingsMenu.classList.contains('show');
                settingsMenu.classList.toggle('show', !isShown);
            };

            // Toggle mở/đóng và chặn lan truyền để không bị đóng ngay lập tức
            const onSettingsBtnClick = (event) => {
                event.preventDefault();
                if (event.stopImmediatePropagation) event.stopImmediatePropagation();
                event.stopPropagation();
                openCloseMenu();
            };
            settingsBtn.addEventListener('click', (e) => { console.log('settingsBtn click'); onSettingsBtnClick(e); });
            settingsBtn.addEventListener('touchstart', (event) => {
                event.preventDefault();
                event.stopPropagation();
                openCloseMenu();
            }, { passive: false });

            // Ngăn click bên trong menu làm đóng menu
            settingsMenu.addEventListener('click', (event) => {
                if (event.stopImmediatePropagation) event.stopImmediatePropagation();
                event.stopPropagation();
            });

            // Đóng menu khi click ra ngoài
            document.addEventListener('click', (event) => {
                if (!settingsBtn.contains(event.target) && !settingsMenu.contains(event.target)) {
                    settingsMenu.classList.remove('show');
                }
            });
        }

        // Chuyển đổi chế độ Light/Dark Mode
        if (toggleThemeBtn && settingsMenu) {
            const toggleThemeHandler = (e) => {
                e.preventDefault();
                e.stopPropagation();
                const currentTheme = document.body.classList.contains('dark') ? 'dark' : 'light';
                const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
                document.body.classList.toggle('dark', nextTheme === 'dark');
                localStorage.setItem('theme', nextTheme);
                settingsMenu.style.display = 'none';
            };
            toggleThemeBtn.addEventListener('click', toggleThemeHandler);
            toggleThemeBtn.addEventListener('touchstart', toggleThemeHandler, { passive: false });
        }

        // Xử lý đăng xuất từ settings menu
        if (settingsLogoutBtn) {
            const logoutHandler = async (e) => {
                e.preventDefault();
                e.stopPropagation();
                try {
                    if (this.authManager) {
                        await this.authManager.signOut();
                    }
                } finally {
                    window.location.href = '../login/index.html';
                }
            };
            settingsLogoutBtn.addEventListener('click', logoutHandler);
            settingsLogoutBtn.addEventListener('touchstart', logoutHandler, { passive: false });
        }

        // Remove unused settings dropdown code
    }

    async handleLogout() {
        await this.authManager.signOut();
        window.location.href = '../login/index.html';
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
        if (!fileList || fileList.length === 0) return;
        
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
        
        // Process each file
        for (let i = 0; i < fileList.length; i++) {
            const file = fileList[i];
            const fileExt = (file.name.split('.').pop() || '').toLowerCase();
            
            if (!allowedMimeTypes.includes(file.type) && !allowedExtensions.includes(fileExt)) {
                this.updateStatus('error', `File "${file.name}" type not supported. Please choose PDF, DOC/DOCX, TXT, MD, RTF, ODT.`);
                continue;
            }
            
            // Add file to uploaded files array
            this.uploadedFiles.push({
                file: file,
                name: file.name,
                size: file.size,
                type: file.type,
                lastModified: file.lastModified,
                file_url: null
            });
        }
        
        if (this.uploadedFiles.length > 0) {
            this.updateFileDisplay();
            this.processUploadedFiles();
        }
    }

    updateFileDisplay() {
        const fileInfo = document.getElementById('fileInfo');
        const fileName = document.getElementById('fileName');
        const fileSize = document.getElementById('fileSize');
        let fileList = document.getElementById('fileList');
        if (!fileList) {
            fileList = document.createElement('div');
            fileList.id = 'fileList';
            fileList.className = 'file-list';
            fileInfo.appendChild(fileList);
        }
        
        if (this.uploadedFiles.length === 1) {
            fileName.textContent = this.uploadedFiles[0].name;
            fileSize.textContent = `${(this.uploadedFiles[0].size / 1024 / 1024).toFixed(2)} MB`;
            fileList.innerHTML = '';
        } else {
            fileName.textContent = 'Files uploaded';
            fileSize.textContent = '';
            fileList.innerHTML = this.uploadedFiles.map(f => {
                const mb = (f.size / 1024 / 1024).toFixed(2);
                return `<div class=\"file-item\"><span class=\"file-item-name\">${f.name}</span><span class=\"file-item-size\">${mb} MB</span></div>`;
            }).join('');
        }
        
        fileInfo.classList.add('show');
    }

    processUploadedFiles() {
        const processingIndicator = document.getElementById('processingIndicator');
        const statusIndicator = document.getElementById('statusIndicator');
        this.isProcessing = true;
        processingIndicator.classList.add('show');
        statusIndicator.className = 'status-indicator processing';
        statusIndicator.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
        setTimeout(async () => {
            // Upload files to server (if logged in) to get file_url for each
            try {
                if (this.authManager && this.authManager.canSaveChat()) {
                    await this.uploadFilesToServer();
                }
            } catch (e) {
                // Non-blocking: continue UI even if upload fails
                console.warn('Upload files failed:', e);
            }
            processingIndicator.classList.remove('show');
            this.filesUploaded = true;
            this.isProcessing = false;
            const messageInput = document.getElementById('messageInput');
            const sendBtn = document.getElementById('sendBtn');
            messageInput.disabled = false;
            sendBtn.disabled = false;
            messageInput.placeholder = 'Type your question about the documents...';
            statusIndicator.className = 'status-indicator ready';
            statusIndicator.innerHTML = '<i class="fas fa-check-circle"></i> Ready';
            const welcomeScreen = document.getElementById('welcomeScreen');
            if (welcomeScreen) welcomeScreen.style.display = 'none';
            const fileText = this.uploadedFiles.length === 1 ? 'document' : 'documents';
            this.addMessage(`Your ${fileText} ${this.uploadedFiles.length === 1 ? 'is' : 'are'} ready. Ask me anything about ${this.uploadedFiles.length === 1 ? 'it' : 'them'}.`, 'bot');
        }, 3000);
    }    

    sendMessage() {
        const messageInput = document.getElementById('messageInput');
        const message = messageInput.value.trim();
        if (!message || !this.filesUploaded || this.isProcessing) return;
        this.addMessage(message, 'user');
        messageInput.value = '';
        messageInput.style.height = 'auto';
        setTimeout(() => {
            this.generateResponse(message);
        }, 1000);
    }

    async uploadFilesToServer() {
        const filesToUpload = this.uploadedFiles.filter(f => f.file && !f.file_url);
        if (!filesToUpload.length) return;
        const form = new FormData();
        filesToUpload.forEach(f => form.append('files', f.file, f.name));
        const res = await fetch(`${apiClient.baseURL}/chat/upload`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${this.authManager.accessToken}`
            },
            body: form
        });
        if (!res.ok) throw new Error('Upload failed');
        const json = await res.json();
        if (!json.success) throw new Error(json.error || 'Upload failed');
        const byName = new Map(json.data.map(x => [x.name, x]));
        this.uploadedFiles = this.uploadedFiles.map(f => {
            const meta = byName.get(f.name);
            return meta ? { ...f, file_url: meta.file_url, type: f.type || meta.type, size: f.size || meta.size } : f;
        });
        this.updateFileDisplay();
    }

    addMessage(message, sender) {
        const chatMessages = document.getElementById('chatMessages');
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}`;
        const avatar = document.createElement('div');
        avatar.className = 'message-avatar';
        const avatarImg = document.createElement('div');
        avatarImg.className = sender === 'user' ? 'avatar-user' : 'avatar-bot';

        if (sender === 'user') {
            let avatarUrl = '';
            if (this.authManager && this.authManager.currentUser && this.authManager.currentUser.avatar_url) {
                avatarUrl = this.authManager.currentUser.avatar_url;
            } else if (this.authManager && this.authManager.currentUser && this.authManager.currentUser.email) {
                avatarUrl = `https://www.gravatar.com/avatar/${md5(this.authManager.currentUser.email.trim().toLowerCase())}?d=identicon`;
            }
            if (avatarUrl) {
                avatarImg.style.backgroundImage = `url('${avatarUrl}')`;
                avatarImg.style.backgroundSize = 'cover';
                avatarImg.style.backgroundPosition = 'center';
            }
        } else {
            // Thêm icon cho bot avatar
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
        this.filesUploaded = false;
        this.isProcessing = false;
        this.uploadedFiles = [];
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
        messageInput.placeholder = 'Upload documents to start chatting...';
        sendBtn.disabled = true;
    
        const statusIndicator = document.getElementById('statusIndicator');
        if (statusIndicator) {
            statusIndicator.className = 'status-indicator waiting';
            statusIndicator.innerHTML = '<i class="fas fa-clock"></i> Waiting for documents';
        }
    
        const fileInfo = document.getElementById('fileInfo');
        if (fileInfo) {
            fileInfo.classList.remove('show');
            const fileList = document.getElementById('fileList');
            if (fileList) fileList.innerHTML = '';
        }
    
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
        const filesData = this.uploadedFiles.map(file => ({
            name: file.name,
            size: file.size,
            type: file.type,
            lastModified: file.lastModified,
            file_url: file.file_url
        }));

        const chatData = {
            title,
            messages: this.chatHistory,
            filesData
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
        const filesData = this.uploadedFiles.map(file => ({
            name: file.name,
            size: file.size,
            type: file.type,
            lastModified: file.lastModified,
            file_url: file.file_url
        }));

        const chatData = {
            title,
            messages: this.chatHistory,
            filesData
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
        
        // Load files info if exists
        if (chat.files_data && chat.files_data.length > 0) {
            this.uploadedFiles = chat.files_data.map(fileData => ({
                file: null, // File object not available when loading from database
                name: fileData.name,
                size: fileData.size,
                type: fileData.type,
                lastModified: fileData.lastModified
            }));
            
            const fileInfo = document.getElementById('fileInfo');
            const fileName = document.getElementById('fileName');
            const fileSize = document.getElementById('fileSize');
            let fileList = document.getElementById('fileList');
            if (!fileList) {
                fileList = document.createElement('div');
                fileList.id = 'fileList';
                fileList.className = 'file-list';
                fileInfo.appendChild(fileList);
            }

            if (this.uploadedFiles.length === 1) {
                fileName.textContent = this.uploadedFiles[0].name;
                fileSize.textContent = `${(this.uploadedFiles[0].size / 1024 / 1024).toFixed(2)} MB`;
                fileList.innerHTML = '';
            } else {
                fileName.textContent = 'Files loaded';
                fileSize.textContent = '';
                fileList.innerHTML = this.uploadedFiles.map(f => {
                    const mb = (f.size / 1024 / 1024).toFixed(2);
                    return `<div class=\"file-item\"><span class=\"file-item-name\">${f.name}</span><span class=\"file-item-size\">${mb} MB</span></div>`;
                }).join('');
            }

            fileInfo.classList.add('show');
            this.filesUploaded = true;
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
