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
        this.currentChatId = null; // server session id
        this.firstUserMessageRenamed = false; // rename session after first user message
        this._fileListHandlersBound = false; // avoid duplicate listeners
        this._startingNewChat = false; // guard to prevent duplicate session creation
        this._suppressSignInAutoOpen = true; // suppress first SIGNED_IN auto-open on initial load
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
                // Must login before using app
                window.location.href = '../login/index.html';
                return;
            }
            // Set up auth state change listener
            this.authManager.handleAuthStateChange((event, session) => {
                if (event === 'SIGNED_OUT') {
                    this.currentUser = null;
                    this.updateUserInterface();
                    window.location.href = '../login/index.html';
                } else if (event === 'SIGNED_IN') {
                    // Always use authManager.currentUser for info
                    this.currentUser = this.authManager.currentUser;
                    this.updateUserInterface();
                    // After a true sign-in (not initial page load), prefer to open a default chat; if none exist, create one
                    if (this._suppressSignInAutoOpen) { this._suppressSignInAutoOpen = false; return; }
                    setTimeout(async () => {
                        try {
                            const chats = await this.loadChatHistory();
                            if (Array.isArray(chats) && chats.length > 0) {
                                // Find newest default (no files) chat
                                let opened = false;
                                for (const c of chats) {
                                    try {
                                        const filesRes = await apiClient.getChatFiles(c.id);
                                        const files = filesRes.data || [];
                                        if (!files || files.length === 0) {
                                            await this.loadChat(c);
                                            const list = document.getElementById('historyList');
                                            if (list) {
                                                list.querySelectorAll('li').forEach(x => x.classList.remove('active'));
                                                const li = list.querySelector(`li[data-id="${c.id}"]`);
                                                if (li) li.classList.add('active');
                                            }
                                            opened = true;
                                            break;
                                        }
                                    } catch {}
                                }
                                if (!opened) {
                                    await this.openDefaultOrCreate();
                                }
                            } else {
                                await this.openDefaultOrCreate();
                            }
                        } catch (e) { console.warn('Post-sign-in open default chat failed:', e); }
                    }, 0);
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
        const chats = await this.loadChatHistory();
        this.initializeEventListeners();
        this.setupAutoResize();
        // On reload, restore the last active chat if it still exists; if none exist at all, create a default chat silently
        try {
            const lastId = localStorage.getItem('lastChatId');
            if (lastId && Array.isArray(chats) && chats.length > 0) {
                const target = chats.find(c => String(c.id) === String(lastId));
                if (target) {
                    await this.loadChat(target);
                    const list = document.getElementById('historyList');
                    if (list) {
                        list.querySelectorAll('li').forEach(x => x.classList.remove('active'));
                        const li = list.querySelector(`li[data-id="${target.id}"]`);
                        if (li) li.classList.add('active');
                    }
                }
            } else if (Array.isArray(chats) && chats.length === 0) {
                // Create a default chat in the background, but keep Welcome visible
                await this.createDefaultChatSilently();
            }
        } catch (e) { console.warn('Init restore chat failed:', e); }
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
    // const exportChatBtn = document.getElementById('exportChatBtn');
        const charCounter = document.getElementById('charCounter');
        const copyLastBtn = document.getElementById('copyLastBtn');
        const regenBtn = document.getElementById('regenBtn');
        const themeToggleBtn = document.getElementById('themeToggleBtn');
        const saveChatBtn = document.getElementById('saveChatBtn');

        fileInput.addEventListener('change', (e) => {
            this.handleFileUpload(e);
            // Allow re-adding same files after deletion by resetting input
            e.target.value = '';
        });
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
    if (newChatBtn) newChatBtn.addEventListener('click', async (e) => { e.preventDefault(); if (this._startingNewChat) return; this._startingNewChat = true; try { await this.openDefaultOrCreate(); } finally { this._startingNewChat = false; } });
    // if (exportChatBtn) exportChatBtn.addEventListener('click', () => this.exportChat());
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
            // Export chat removed from UI
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
        
        const MAX_FILE_SIZE_MB = 20;
        const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
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
            // Size limit check
            if (file.size > MAX_FILE_SIZE_BYTES) {
                this.updateStatus('error', `File "${file.name}" is too large. Maximum allowed size is ${MAX_FILE_SIZE_MB} MB.`);
                continue;
            }
            
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
        if (!fileInfo || !fileName || !fileSize) return;

        // No files: hide the section and clear contents
        if (!this.uploadedFiles || this.uploadedFiles.length === 0) {
            if (fileList) fileList.innerHTML = '';
            fileName.textContent = '';
            fileSize.textContent = '';
            fileInfo.classList.remove('show');
            return;
        }
        if (!fileList) {
            fileList = document.createElement('div');
            fileList.id = 'fileList';
            fileList.className = 'file-list';
            fileInfo.appendChild(fileList);
        }

        // Summary text
        if (this.uploadedFiles.length === 1) {
            fileName.textContent = this.uploadedFiles[0].name;
            fileSize.textContent = `${(this.uploadedFiles[0].size / 1024 / 1024).toFixed(2)} MB`;
        } else {
            fileName.textContent = this.uploadedFiles.length > 0 ? 'Files' : '';
            fileSize.textContent = '';
        }
        // Always render list items so files are clickable (even when only one)
        fileList.innerHTML = this.uploadedFiles.map(f => {
            const mb = f.size ? (f.size / 1024 / 1024).toFixed(2) : '';
            const link = f.file_url ? `<a class="file-link" href="${f.file_url}" target="_blank" rel="noopener noreferrer">${f.name}</a>` : `<span class="file-item-name">${f.name}</span>`;
            const delBtn = f.id ? `<button class="file-delete" data-file-id="${f.id}" title="Remove file">&times;</button>` : '';
            return `<div class="file-item" data-file-id="${f.id || ''}">${link}<span class="file-item-size">${mb ? `${mb} MB` : ''}</span>${delBtn}</div>`;
        }).join('');

        fileInfo.classList.add('show');

        // Bind file list actions (once)
        if (!this._fileListHandlersBound) {
            this._fileListHandlersBound = true;
            fileList.addEventListener('click', async (e) => {
                const delBtn = e.target.closest && e.target.closest('.file-delete');
                if (delBtn) {
                    e.preventDefault();
                    const fileId = parseInt(delBtn.getAttribute('data-file-id'), 10);
                    if (!isNaN(fileId)) {
                        try {
                            await apiClient.deleteFile(fileId);
                            // Remove from local list
                            const removed = this.uploadedFiles.find(f => f.id === fileId);
                            this.uploadedFiles = this.uploadedFiles.filter(f => f.id !== fileId);
                            this.updateFileDisplay();
                            // Inform user and persist bot message about file removal
                            const removedName = removed?.name ? `"${removed.name}"` : 'the file';
                            const removedMsg = `I have removed ${removedName} from this chat.`;
                            this.addMessage(removedMsg, 'bot');
                            try { await apiClient.createChatMessage(this.currentChatId, 'bot', removedMsg); } catch {}
                            // If no files left, disable input and update status
                            if (this.uploadedFiles.length === 0) {
                                const messageInput = document.getElementById('messageInput');
                                const sendBtn = document.getElementById('sendBtn');
                                if (messageInput) { messageInput.disabled = true; messageInput.placeholder = 'Upload documents to start chatting...'; }
                                if (sendBtn) sendBtn.disabled = true;
                                const statusIndicator = document.getElementById('statusIndicator');
                                if (statusIndicator) {
                                    statusIndicator.className = 'status-indicator waiting';
                                    statusIndicator.innerHTML = '<i class="fas fa-clock"></i> Waiting for documents';
                                }
                                // Reset file input so same files can be added again
                                const fileInputEl = document.getElementById('fileInput');
                                if (fileInputEl) fileInputEl.value = '';
                            }
                        } catch (err) {
                            console.warn('Delete file failed', err);
                        }
                    }
                }
            });
        }
    }

    async processUploadedFiles() {
        const processingIndicator = document.getElementById('processingIndicator');
        const statusIndicator = document.getElementById('statusIndicator');
        this.isProcessing = true;
        processingIndicator.classList.add('show');
        statusIndicator.className = 'status-indicator processing';
        statusIndicator.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
        try {
            // Ensure a session exists for uploads
            await this.ensureChatSession();
            // Upload files to this.currentChatId
            if (this.authManager && this.authManager.canSaveChat()) {
                const uploadedNames = await this.uploadFilesToServer();
                // After successful upload, inform user with analyzed filenames (Req #8)
                if (uploadedNames && uploadedNames.length) {
                    const namesStr = uploadedNames.join(', ');
                    const analyzedMsg = `I have finished reading and analyzing: ${namesStr}.`;
                    this.addMessage(analyzedMsg, 'bot');
                    try { await apiClient.createChatMessage(this.currentChatId, 'bot', analyzedMsg); } catch {}
                }
            }
        } catch (e) {
            console.warn('Processing/upload error:', e);
        } finally {
            processingIndicator.classList.remove('show');
            this.isProcessing = false;
            const hasFiles = Array.isArray(this.uploadedFiles) && this.uploadedFiles.length > 0;
            this.filesUploaded = hasFiles;
            const messageInput = document.getElementById('messageInput');
            const sendBtn = document.getElementById('sendBtn');
            const welcomeScreen = document.getElementById('welcomeScreen');
            if (hasFiles) {
                if (messageInput) { messageInput.disabled = false; messageInput.placeholder = 'Type your question about the documents...'; }
                if (sendBtn) sendBtn.disabled = false;
                statusIndicator.className = 'status-indicator ready';
                statusIndicator.innerHTML = '<i class="fas fa-check-circle"></i> Ready';
                if (welcomeScreen) welcomeScreen.style.display = 'none';
                const fileText = this.uploadedFiles.length === 1 ? 'document' : 'documents';
                const readyMsg = `Your ${fileText} ${this.uploadedFiles.length === 1 ? 'is' : 'are'} ready. Ask me anything about ${this.uploadedFiles.length === 1 ? 'it' : 'them'}.`;
                this.addMessage(readyMsg, 'bot');
                try { await apiClient.createChatMessage(this.currentChatId, 'bot', readyMsg); } catch {}
            } else {
                if (messageInput) { messageInput.disabled = true; messageInput.placeholder = 'Upload documents to start chatting...'; }
                if (sendBtn) sendBtn.disabled = true;
                statusIndicator.className = 'status-indicator waiting';
                statusIndicator.innerHTML = '<i class="fas fa-clock"></i> Waiting for documents';
                // keep welcome screen visible
                if (welcomeScreen) welcomeScreen.style.display = 'flex';
            }
        }
    }    
    async sendMessage() {
        const messageInput = document.getElementById('messageInput');
        const message = messageInput.value.trim();
        if (!message || this.isProcessing) return;
        // Disallow sending if session has no file (requirement #3)
        if (!this.uploadedFiles || this.uploadedFiles.length === 0) {
            this.addMessage('Please upload at least one document to start chatting.', 'bot');
            return;
        }
        // Rename chat on first user message (requirement #7)
        try {
            await this.ensureChatSession();
            if (!this.firstUserMessageRenamed) {
                // Verify from server whether title is still default before renaming
                let shouldRename = true;
                try {
                    const sessionRes = await apiClient.getChatSession(this.currentChatId);
                    const srvTitle = (sessionRes?.data?.session_name || sessionRes?.data?.title || '').trim().toLowerCase();
                    shouldRename = (srvTitle === 'new chat');
                } catch (_) {
                    // If we cannot retrieve session title, do not force rename to avoid overwriting a custom title
                    shouldRename = false;
                }
                if (shouldRename) {
                    const newTitle = message.slice(0, 60);
                    await apiClient.renameChat(this.currentChatId, newTitle);
                    this.firstUserMessageRenamed = true;
                    // Visual pulse on active history item
                    const activeLi = document.querySelector(`#historyList li[data-id="${this.currentChatId}"]`);
                    if (activeLi) { activeLi.classList.add('pulse'); setTimeout(() => activeLi.classList.remove('pulse'), 700); }
                    // Refresh history
                    await this.loadChatHistory();
                }
            }
        } catch {}
        this.addMessage(message, 'user');
        // Persist user message before processing
        try { await apiClient.createChatMessage(this.currentChatId, 'user', message); } catch {}
        messageInput.value = '';
        messageInput.style.height = 'auto';
        try {
            const thinking = this.addTypingIndicator();
            const res = await apiClient.processMessage(this.currentChatId, message);
            if (thinking && thinking.remove) thinking.remove();
            const answer = res?.data?.answer || res?.answer || 'No answer';
            this.addMessage(answer, 'bot');
            const copyLastBtnRef = document.getElementById('copyLastBtn');
            if (copyLastBtnRef) copyLastBtnRef.disabled = false;
            const regenBtnRef = document.getElementById('regenBtn');
            if (regenBtnRef) regenBtnRef.disabled = false;
        } catch (e) {
            this.addMessage(`Error: ${e.message || e}`, 'bot');
        }
    }

    async uploadFilesToServer() {
        const filesToUpload = this.uploadedFiles.filter(f => f.file && !f.file_url);
        if (!filesToUpload.length) return;
        const uploadedNames = [];
        for (const f of [...filesToUpload]) {
            try {
                const uploaded = await apiClient.uploadFileToSession(this.currentChatId, f.file);
                // uploaded.data contains file record { id, db_response: [ { filename, file_url, file_type, file_size, id } ] }
                const info = uploaded?.data?.db_response?.[0] || {};
                f.id = uploaded?.data?.id || info.id || f.id;
                f.file_url = info.file_url || f.file_url || null;
                f.type = f.type || info.file_type || f.file?.type || '';
                f.size = f.size || info.file_size || f.file?.size || 0;
                uploadedNames.push(f.name || info.filename || `file_${f.id || ''}`);
            } catch (err) {
                // Remove failed file from UI and notify user
                const failedName = f?.name || 'the file';
                const errMsg = String(err?.message || '').toLowerCase();
                const isTooLarge = errMsg.includes('file too large') || errMsg.includes('413');
                const msg = isTooLarge
                    ? `"${failedName}" is too large. The maximum allowed size is 20 MB. Please upload a smaller file.`
                    : `I could not read "${failedName}" due to an internal error. Please try uploading a different file.`;
                this.addMessage(msg, 'bot');
                try { await apiClient.createChatMessage(this.currentChatId, 'bot', msg); } catch {}
                this.uploadedFiles = this.uploadedFiles.filter(x => x !== f);
            }
        }
        this.updateFileDisplay();
        return uploadedNames;
    }

    formatBotAnswer(text) {
        if (text == null) return '';
        let s = String(text).replace(/\r\n/g, '\n');
        // Capture markdown bold **...** before escaping
        const boldSegments = [];
        s = s.replace(/\*\*(.+?)\*\*/gs, (_, p1) => {
            boldSegments.push(p1);
            return `\u0000B${boldSegments.length - 1}\u0000`;
        });
        // Escape HTML
        const escape = (str) => str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\"/g, '&quot;')
            .replace(/'/g, '&#39;');
        s = escape(s);
        // Restore bold segments with their own escaping
        s = s.replace(/\u0000B(\d+)\u0000/g, (_, idx) => {
            const content = boldSegments[Number(idx)] ?? '';
            return `<strong>${escape(String(content))}</strong>`;
        });
        // Convert newlines to <br>
        s = s.replace(/\n/g, '<br>');
        return s;
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
        if (sender === 'bot') {
            content.innerHTML = this.formatBotAnswer(message);
        } else {
            content.textContent = message;
        }
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

    addTypingIndicator() {
        const chatMessages = document.getElementById('chatMessages');
        const wrap = document.createElement('div');
        wrap.className = 'message bot';
        const avatar = document.createElement('div');
        avatar.className = 'message-avatar';
        const avatarImg = document.createElement('div');
        avatarImg.className = 'avatar-bot';
        const icon = document.createElement('i');
        icon.className = 'fas fa-robot';
        avatarImg.appendChild(icon);
        avatar.appendChild(avatarImg);
        const content = document.createElement('div');
        content.className = 'message-content';
        content.innerHTML = '<span class="typing-dots"><span>.</span><span>.</span><span>.</span></span>';
        wrap.appendChild(avatar);
        wrap.appendChild(content);
        chatMessages.appendChild(wrap);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        return wrap;
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

        await this.startNewChatSession();
    }

    async startNewChatSession() {
        // Reset UI for a brand new chat
        this.chatHistory = [];
        this.filesUploaded = false;
        this.isProcessing = false;
        this.uploadedFiles = [];
        this.currentChatId = null;
        this.firstUserMessageRenamed = false;

        this.clearChatMessages();

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

        // Create (or reuse) a fresh/unattached session via API and show it
        try {
            if (!this.authManager || !this.authManager.isLoggedIn()) {
                throw new Error('Please sign in to start chatting');
            }
            const created = await apiClient.createChat('New chat');
            this.currentChatId = created.data.id;
            try { localStorage.setItem('lastChatId', String(this.currentChatId)); } catch {}

            // Load messages to check if greeting exists
            let hasMessages = false;
            try {
                const existing = await apiClient.getChatMessages(this.currentChatId);
                const msgs = existing.data || existing || [];
                hasMessages = Array.isArray(msgs) && msgs.length > 0;
            } catch (err) {
                hasMessages = false; // 404 => no messages
            }
            if (!hasMessages) {
                const greet = 'Hello! Upload your documents (PDF, WORD, TXT, MARKDOWN) and ask me questions. I will answer based on your files.';
                try { await apiClient.createChatMessage(this.currentChatId, 'bot', greet); } catch {}
                if (welcomeScreen) welcomeScreen.style.display = 'none';
                this.addMessage(greet, 'bot');
            }

            // Refresh history and mark this session active
            await this.loadChatHistory();
            const list = document.getElementById('historyList');
            if (list) {
                list.querySelectorAll('li').forEach(x => x.classList.remove('active'));
                const li = list.querySelector(`li[data-id="${this.currentChatId}"]`);
                if (li) li.classList.add('active');
            }
        } catch (err) {
            console.warn('Unable to start new chat session:', err);
        }
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
            // Normalize to expected shape
            const chats = (result.data || []).map(s => ({
                id: s.id,
                title: s.session_name || s.title || 'New Chat',
                created_at: s.created_at,
                updated_at: s.updated_at,
            }));
            // Sort by updated_at desc, fallback to created_at
            chats.sort((a, b) => {
                const ta = new Date(a.updated_at || a.created_at || 0).getTime();
                const tb = new Date(b.updated_at || b.created_at || 0).getTime();
                return tb - ta;
            });
            this.refreshHistoryList(chats);
            // Keep current chat highlighted after reload
            if (this.currentChatId) {
                const list = document.getElementById('historyList');
                if (list) {
                    list.querySelectorAll('li').forEach(x => x.classList.remove('active'));
                    const li = list.querySelector(`li[data-id="${this.currentChatId}"]`);
                    if (li) li.classList.add('active');
                }
            }
            return chats;
        }
        return [];
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
                    <span class="chat-meta">${new Date(chat.updated_at || chat.created_at).toLocaleString()}</span>
                    <div class="chat-actions">
                        <button class="btn-rename" onclick="event.stopPropagation(); app.renameChatInline('${chat.id}')">Rename</button>
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

    renameChatInline(chatId) {
        const list = document.getElementById('historyList');
        if (!list) return;
        const li = list.querySelector(`li[data-id="${chatId}"]`);
        if (!li) return;
        const titleSpan = li.querySelector('.chat-title');
        if (!titleSpan) return;
        const currentTitle = titleSpan.textContent;
        // Prevent multiple editors
        if (li.querySelector('.rename-input')) return;
        const input = document.createElement('input');
        input.type = 'text';
        input.value = currentTitle;
        input.className = 'rename-input';
        input.style.marginRight = '8px';
        const saveBtn = document.createElement('button');
        saveBtn.textContent = 'Save';
        saveBtn.className = 'btn-small';
        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        cancelBtn.className = 'btn-small';
        // Replace titleSpan temporarily
        const parent = titleSpan.parentElement;
        titleSpan.style.display = 'none';
        parent.insertBefore(input, titleSpan);
        parent.insertBefore(saveBtn, titleSpan);
        parent.insertBefore(cancelBtn, titleSpan);
        const cleanup = () => { input.remove(); saveBtn.remove(); cancelBtn.remove(); titleSpan.style.display = ''; };
        cancelBtn.onclick = (e) => { e.preventDefault(); cleanup(); };
        saveBtn.onclick = async (e) => {
            e.preventDefault();
            const newTitle = input.value.trim();
            if (!newTitle || newTitle === currentTitle) { cleanup(); return; }
            try {
                const res = await this.chatStorage.updateChatTitle(chatId, newTitle);
                if (res && res.success) {
                    titleSpan.textContent = newTitle;
                    cleanup();
                    // pulse effect
                    li.classList.add('pulse');
                    setTimeout(() => li.classList.remove('pulse'), 700);
                } else {
                    cleanup();
                }
            } catch { cleanup(); }
        };
        input.focus();
        input.select();
    }

    // Removed confirmDeleteChatInline: delete now happens immediately from history action

    async loadChat(chat) {
        this.clearChatMessages();
        const chatMessages = document.getElementById('chatMessages');
        this.chatHistory = [];
        this.currentChatId = chat.id;
        try { localStorage.setItem('lastChatId', String(this.currentChatId)); } catch {}
        // Don't assume renamed; we'll determine after loading messages and title
        // Immediately reset file UI to avoid bleed from previous chat
        this.uploadedFiles = [];
        this.updateFileDisplay();
        const messageInput = document.getElementById('messageInput');
        const sendBtn = document.getElementById('sendBtn');
        if (messageInput) { messageInput.disabled = true; messageInput.placeholder = 'Upload documents to start chatting...'; }
        if (sendBtn) sendBtn.disabled = true;
        const statusIndicator = document.getElementById('statusIndicator');
        if (statusIndicator) { statusIndicator.className = 'status-indicator waiting'; statusIndicator.innerHTML = '<i class="fas fa-clock"></i> Waiting for documents'; }
        
        // Load files info from server (session_files -> fetch each file detail)
        try {
            const filesRes = await apiClient.getChatFiles(chat.id);
            const files = filesRes.data || [];
            const detailed = await Promise.all(files.map(async (sf) => {
                try {
                    const infoRes = await apiClient.getFile(sf.file_id);
                    const info = infoRes.data || infoRes;
                    return {
                        id: info.id || sf.file_id,
                        file: null,
                        name: info.filename || 'file',
                        size: info.file_size || 0,
                        type: info.file_type || '',
                        lastModified: null,
                        file_url: info.file_url || null,
                    };
                } catch {
                    return { id: sf.file_id, file: null, name: `file_${sf.file_id}`, size: 0, type: '', lastModified: null, file_url: null };
                }
            }));
            this.uploadedFiles = detailed;
        } catch {}

        // Render file section using common renderer
        this.updateFileDisplay();
        this.filesUploaded = this.uploadedFiles.length > 0;
        // Enable/disable input based on files exist
        if (this.filesUploaded) {
            messageInput.disabled = false; sendBtn.disabled = false;
            messageInput.placeholder = 'Type your question about the documents...';
            const statusIndicator = document.getElementById('statusIndicator');
            if (statusIndicator) { statusIndicator.className = 'status-indicator ready'; statusIndicator.innerHTML = '<i class="fas fa-check-circle"></i> Ready'; }
        } else {
            messageInput.disabled = true; sendBtn.disabled = true;
            messageInput.placeholder = 'Upload documents to start chatting...';
            const statusIndicator = document.getElementById('statusIndicator');
            if (statusIndicator) { statusIndicator.className = 'status-indicator waiting'; statusIndicator.innerHTML = '<i class="fas fa-clock"></i> Waiting for documents'; }
        }

        // Load messages from server
        let msgs = [];
        try {
            const msgRes = await apiClient.getChatMessages(chat.id);
            msgs = msgRes.data || [];
            msgs.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
            msgs.forEach(m => {
                const sender = m.role === 'user' ? 'user' : 'bot';
                const contentText = m.message || m.content || '';
                const msg = { sender, message: contentText, at: new Date(m.created_at).getTime() };
                this.addMessage(msg.message, msg.sender);
                // Replace last pushed timestamp with actual
                this.chatHistory[this.chatHistory.length - 1].at = msg.at;
            });
        } catch {}
        chatMessages.scrollTop = chatMessages.scrollHeight;
        
        const copyLastBtn = document.getElementById('copyLastBtn');
        if (copyLastBtn) copyLastBtn.disabled = !this.chatHistory.some(x => x.sender === 'bot');
        const regenBtn = document.getElementById('regenBtn');
        if (regenBtn) regenBtn.disabled = !this.chatHistory.some(x => x.sender === 'user');

        // Decide if we should auto-rename on first user message for this chat
        const hasUserMsg = Array.isArray(msgs) && msgs.some(m => (m.role === 'user' || m.sender === 'user'));
        const isDefaultTitle = ((chat.title || '').trim().toLowerCase() === 'new chat');
        // If there's already any user message, or the title is not the default, consider it already renamed
        this.firstUserMessageRenamed = hasUserMsg || !isDefaultTitle ? true : false;
    }

    async renameChat(chatId, currentTitle) { this.renameChatInline(chatId); }

    async deleteChat(chatId) {
        if (!this.chatStorage) { return; }
        // Fade-out effect on the item
        const list = document.getElementById('historyList');
        const li = list ? list.querySelector(`li[data-id="${chatId}"]`) : null;
        if (li) {
            li.classList.add('fade-out');
            await new Promise(res => setTimeout(res, 250));
        }
        const result = await this.chatStorage.deleteChat(chatId);
        if (result.success) {
            const deletedIdStr = String(chatId ?? '');
            const currentIdStr = String(this.currentChatId ?? '');
            const wasCurrent = deletedIdStr === currentIdStr;
            if (wasCurrent) {
                // Ensure we create and switch to a fresh default chat
                this.currentChatId = null;
                try {
                    if (this._startingNewChat) return;
                    this._startingNewChat = true;
                    await this.startNewChatSession();
                } finally {
                    this._startingNewChat = false;
                }
            } else {
                await this.loadChatHistory();
            }
        } else {
            // silently fail without alert; optionally log
            console.warn('Delete chat failed:', result.error);
        }
    }

    async ensureChatSession() {
        if (this.currentChatId) return this.currentChatId;
        if (!this.authManager || !this.authManager.isLoggedIn()) {
            throw new Error('Please sign in to start chatting');
        }
        // Create with default title (requirement #7)
        const created = await apiClient.createChat('New chat');
        this.currentChatId = created.data.id;
    try { localStorage.setItem('lastChatId', String(this.currentChatId)); } catch {}
        // Greeting bot message if empty (requirement #8)
        let hasMessages = false;
        try {
            const existing = await apiClient.getChatMessages(this.currentChatId);
            const msgs = existing.data || existing || [];
            hasMessages = Array.isArray(msgs) && msgs.length > 0;
        } catch (err) { hasMessages = false; }
        if (!hasMessages) {
            const greet = 'Hello! Upload your documents (PDF, WORD, TXT, MARKDOWN) and ask me questions. I will answer based on your files.';
            try { await apiClient.createChatMessage(this.currentChatId, 'bot', greet); } catch {}
            const welcomeScreen = document.getElementById('welcomeScreen');
            if (welcomeScreen) welcomeScreen.style.display = 'none';
            this.addMessage(greet, 'bot');
        }
        return this.currentChatId;
    }

    async createDefaultChatSilently() {
        try {
            if (!this.authManager || !this.authManager.isLoggedIn()) return;
            const created = await apiClient.createChat('New chat');
            const newId = created.data.id;
            try { localStorage.setItem('lastChatId', String(newId)); } catch {}
            // Just refresh history; do not navigate away from welcome screen
            await this.loadChatHistory();
        } catch (e) {
            console.warn('Silent default chat creation failed:', e);
        }
    }

    async openDefaultOrCreate() {
        // Prefer an existing default chat (no files). If none, create a new one.
        const chats = await this.loadChatHistory();
        if (Array.isArray(chats) && chats.length > 0) {
            // Find the newest chat with zero files
            for (const c of chats) {
                let isDefault = false;
                try {
                    const filesRes = await apiClient.getChatFiles(c.id);
                    const files = filesRes.data || [];
                    isDefault = !files || files.length === 0;
                } catch (e) {
                    // If the API returns an error (e.g., 404), treat as no files
                    isDefault = true;
                }
                if (isDefault) {
                    this.currentChatId = c.id;
                    await this.loadChat(c);
                    const list = document.getElementById('historyList');
                    if (list) {
                        list.querySelectorAll('li').forEach(x => x.classList.remove('active'));
                        const li = list.querySelector(`li[data-id="${this.currentChatId}"]`);
                        if (li) li.classList.add('active');
                    }
                    return;
                }
            }
        }
        // No existing default chat found → create new default chat and switch to it
        await this.startNewChatSession();
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
