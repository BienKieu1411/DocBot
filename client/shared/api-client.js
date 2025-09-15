class APIClient {
    constructor() {
        const globalBase = (typeof window !== 'undefined' && (window.API_BASE_URL || window.__API_BASE_URL__)) || null;
        const inferredLocal = (typeof window !== 'undefined') ? `${window.location.protocol}//${window.location.hostname}${window.location.port ? ':' + window.location.port : ''}` : null;
        this.baseURL = globalBase || (inferredLocal && inferredLocal !== 'file://' ? inferredLocal.replace(/:\d+$/, ':8000').replace('http://', 'https://') : 'https://localhost:8000');
    }

    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const config = {
            headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
            credentials: 'include',
            ...options
        };
        let response = await fetch(url, config);
        if (response.status === 401 && !options._retry && !options.skipAuthRefresh) {
            // Try to refresh access token once, then retry original request
            try {
                await this.refreshAccessToken({ skipAuthRefresh: true });
                response = await fetch(url, { ...config, _retry: true });
            } catch (e) {
                // fall through to normal error handling
            }
        }
        if (!response.ok) {
            let errorMessage = 'Request failed';
            try { const errorData = await response.json(); errorMessage = errorData.detail || errorData.error || errorMessage; } catch {}
            throw new Error(errorMessage);
        }
        return await response.json();
    }

    async requestForm(endpoint, formData, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const config = {
            method: options.method || 'POST',
            body: formData,
            credentials: 'include',
            // IMPORTANT: Do not set Content-Type for multipart; browser will set boundary
            headers: { ...(options.headers || {}) },
        };
        let response = await fetch(url, config);
        if (response.status === 401 && !options._retry && !options.skipAuthRefresh) {
            try {
                await this.refreshAccessToken({ skipAuthRefresh: true });
                response = await fetch(url, { ...config, _retry: true });
            } catch (e) {}
        }
        if (!response.ok) {
            let errorMessage = 'Request failed';
            try { const errorData = await response.json(); errorMessage = errorData.detail || errorData.error || errorMessage; } catch {}
            throw new Error(errorMessage);
        }
        return await response.json();
    }

    // Auth APIs (unchanged)
    register(email, password) { return this.request('/user/register', { method: 'POST', body: JSON.stringify({ email, password }) }); }
    login(email, password) { return this.request('/user/login', { method: 'POST', body: JSON.stringify({ email, password }) }); }
    logout() { return this.request('/user/logout', { method: 'POST' }); }
    refreshAccessToken(options = {}) { return this.request('/user/refresh-token', { method: 'POST', ...(options || {}), skipAuthRefresh: true }); }
    requestPasswordReset(email) { return this.request('/user/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }); }
    confirmPasswordReset(email, otpCode, newPassword) { return this.request('/user/reset-password', { method: 'POST', body: JSON.stringify({ email, otp_code: otpCode, new_password: newPassword }) }); }
    verifyEmail(email, otpCode) { return this.request('/user/verify', { method: 'POST', body: JSON.stringify({ email, otp_code: otpCode }) }); }
    resendVerification(email) { return this.request('/user/resend-verification', { method: 'POST', body: JSON.stringify({ email }) }); }
    getUserInfo() { return this.request('/user/profile'); }

    // Chat APIs mapped to server
    async listUserChats() {
        const data = await this.request('/chat/user/');
        return { success: true, data };
    }

    async createChat(title = 'New Chat') {
        const data = await this.request(`/chat/create?title=${encodeURIComponent(title)}`, { method: 'POST' });
        return { success: true, data };
    }

    async getChatSession(chatId) {
        const data = await this.request(`/chat/session/${chatId}`);
        return { success: true, data };
    }

    async getChatMessages(chatId) {
        const data = await this.request(`/chat/session/${chatId}/messages`);
        return { success: true, data };
    }

    async getChatFiles(chatId) {
        const data = await this.request(`/chat/session/${chatId}/files`);
        return { success: true, data };
    }

    async getFile(fileId) {
        const data = await this.request(`/chat/file/${fileId}`);
        return { success: true, data };
    }

    async uploadFileToSession(sessionId, file) {
        const form = new FormData();
        form.append('file', file, file.name);
        const data = await this.requestForm(`/chat/session/${sessionId}/upload`, form);
        return { success: true, data };
    }

    async createChatMessage(chatId, role, content) {
        const data = await this.request(`/chat/session/${chatId}/messages`, { method: 'POST', body: JSON.stringify({ role, content }) });
        return { success: true, data };
    }

    async processMessage(chatId, userMessage) {
        const data = await this.request(`/chat/session/${chatId}/process`, { method: 'POST', body: JSON.stringify({ user_message: userMessage }) });
        return { success: true, data };
    }

    async renameChat(chatId, newName) {
        const data = await this.request(`/chat/session/${chatId}/rename`, { method: 'PUT', body: JSON.stringify({ new_name: newName }) });
        return { success: true, data };
    }

    async deleteChat(chatId) {
        await this.request(`/chat/session/${chatId}`, { method: 'DELETE' });
        return { success: true };
    }

    async deleteFile(fileId) {
        await this.request(`/chat/file/${fileId}`, { method: 'DELETE' });
        return { success: true };
    }

    healthCheck() { return this.request('/health'); }
}

const apiClient = new APIClient();

class AuthManager {
    static instance;

    constructor() {
        if (AuthManager.instance) return AuthManager.instance;
        AuthManager.instance = this;
        this.currentUser = null;
        this.isGuest = false;
    }

    async init() {
        try {
            const result = await apiClient.getUserInfo();
            if (result.success) {
                this.currentUser = result.user;
                this.isGuest = false;
                return true;
            }
        } catch {}
        this.currentUser = null;
        this.isGuest = false;
        return false;
    }

    async signUp(email, password) {
        const result = await apiClient.register(email, password);
        return { success: result.success, ...result };
    }

    async signIn(email, password) {
        const result = await apiClient.login(email, password);
        if (result.success) this.currentUser = result.user;
        return result;
    }

    async signOut() {
        try { await apiClient.logout(); } catch {}
        this.currentUser = null;
        this.isGuest = false;
        return { success: true };
    }

    isLoggedIn() {
        return this.currentUser !== null;
    }

    canSaveChat() {
        return this.currentUser !== null;
    }

    async requestPasswordReset(email) { return await apiClient.requestPasswordReset(email); }
    async confirmPasswordReset(email, otpCode, newPassword) { return await apiClient.confirmPasswordReset(email, otpCode, newPassword); }
    async resendVerificationEmail(email) { return await apiClient.resendVerification(email); }
    async verifyEmail(email, otpCode) {
        const result = await apiClient.verifyEmail(email, otpCode);
        if (result.success) this.currentUser = result.user;
        return result;
    }

    async handleAuthStateChange(callback) {
        const checkAuth = async () => {
            const isLoggedIn = await this.init();
            callback(isLoggedIn ? 'SIGNED_IN' : 'SIGNED_OUT', isLoggedIn ? { user: this.currentUser } : null);
        };
        checkAuth();
        document.addEventListener('visibilitychange', () => { if (!document.hidden) checkAuth(); });
    }
}

class ChatStorage {
    constructor() {
        this.authManager = new AuthManager();
    }

    async saveChat(chatData) {
        if (!this.authManager.canSaveChat()) return { success: false, error: 'Please sign in to save chat' };
        // Create a session (and optionally backfill messages)
        const created = await apiClient.createChat(chatData.title || 'New Chat');
        const session = created.data;
        if (Array.isArray(chatData.messages)) {
            // Best-effort backfill (ignore failures)
            for (const m of chatData.messages) {
                const role = m.sender === 'user' ? 'user' : 'bot';
                const content = m.message || m.content || '';
                if (!content) continue;
                try { await apiClient.createChatMessage(session.id, role, content); } catch {}
            }
        }
        return { success: true, data: session };
    }

    async getChats() {
        if (!this.authManager.canSaveChat()) return { success: false, error: 'Please sign in to view chat history' };
        return await apiClient.listUserChats();
    }

    async updateChatTitle(chatId, newTitle) {
        if (!this.authManager.canSaveChat()) return { success: false, error: 'Please sign in to update chat' };
        return await apiClient.renameChat(chatId, newTitle);
    }

    async deleteChat(chatId) {
        if (!this.authManager.canSaveChat()) return { success: false, error: 'Please sign in to delete chat' };
        return await apiClient.deleteChat(chatId);
    }
}

// expose to window for browser usage (no module exports)
window.AuthManager = AuthManager;
window.ChatStorage = ChatStorage;
window.apiClient = apiClient;
