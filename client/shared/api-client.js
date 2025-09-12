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
        if (!response.ok) {
            let errorMessage = 'Request failed';
            try { const errorData = await response.json(); errorMessage = errorData.detail || errorData.error || errorMessage; } catch {}
            throw new Error(errorMessage);
        }
        return await response.json();
    }

    register(email, password) { return this.request('/user/register', { method: 'POST', body: JSON.stringify({ email, password }) }); }
    login(email, password) { return this.request('/user/login', { method: 'POST', body: JSON.stringify({ email, password }) }); }
    logout() { return this.request('/user/logout', { method: 'POST' }); }
    refreshAccessToken() { return this.request('/user/refresh-token', { method: 'POST' }); }
    requestPasswordReset(email) { return this.request('/user/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }); }
    confirmPasswordReset(email, otpCode, newPassword) { return this.request('/user/reset-password', { method: 'POST', body: JSON.stringify({ email, otp_code: otpCode, new_password: newPassword }) }); }
    verifyEmail(email, otpCode) { return this.request('/user/verify', { method: 'POST', body: JSON.stringify({ email, otp_code: otpCode }) }); }
    resendVerification(email) { return this.request('/user/resend-verification', { method: 'POST', body: JSON.stringify({ email }) }); }
    getUserInfo() { return this.request('/user/profile'); }
    saveChat(chatData) { return this.request('/chat/save', { method: 'POST', body: JSON.stringify(chatData) }); }
    getChats() { return this.request('/chat/list'); }
    getChat(chatId) { return this.request(`/chat/${chatId}`); }
    updateChatTitle(chatId, newTitle) { return this.request(`/chat/${chatId}/title`, { method: 'PUT', body: JSON.stringify({ title: newTitle }) }); }
    deleteChat(chatId) { return this.request(`/chat/${chatId}`, { method: 'DELETE' }); }
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
        return await apiClient.saveChat(chatData);
    }

    async getChats() {
        if (!this.authManager.canSaveChat()) return { success: false, error: 'Please sign in to view chat history' };
        return await apiClient.getChats();
    }

    async updateChatTitle(chatId, newTitle) {
        if (!this.authManager.canSaveChat()) return { success: false, error: 'Please sign in to update chat' };
        return await apiClient.updateChatTitle(chatId, newTitle);
    }

    async deleteChat(chatId) {
        if (!this.authManager.canSaveChat()) return { success: false, error: 'Please sign in to delete chat' };
        return await apiClient.deleteChat(chatId);
    }
}

window.AuthManager = AuthManager;
window.ChatStorage = ChatStorage;
window.apiClient = apiClient;
