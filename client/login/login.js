class LoginManager {
    constructor() {
        this.authManager = null;
        this.initializeEventListeners();
        this.initAuth();
    }

    async initAuth() {
        // Wait for AuthManager to be available
        if (typeof AuthManager !== 'undefined') {
            this.authManager = new AuthManager();
            await this.checkExistingSession();
        } else {
            // Retry after a short delay
            setTimeout(() => this.initAuth(), 100);
        }
    }

    async checkExistingSession() {
        const isLoggedIn = await this.authManager.init();
        if (isLoggedIn) {
            this.redirectToApp();
        }
    }

    initializeEventListeners() {
        // Theme toggle
        this.createThemeToggle();
        
        // Form switching
        document.getElementById('showRegister').addEventListener('click', (e) => {
            e.preventDefault();
            document.getElementById('loginForm').style.display = 'none';
            document.getElementById('registerForm').style.display = 'block';
        });

        document.getElementById('showLogin').addEventListener('click', (e) => {
            e.preventDefault();
            document.getElementById('registerForm').style.display = 'none';
            document.getElementById('loginForm').style.display = 'block';
        });

        // Form submissions
        document.getElementById('loginFormElement').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin();
        });

        document.getElementById('registerFormElement').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleRegister();
        });

        // Forgot password unified flow
        document.getElementById('forgotPassword').addEventListener('click', (e) => {
            e.preventDefault();
            this.showResetConfirmModal();
        });

        const resetConfirmForm = document.getElementById('resetConfirmForm');
        if (resetConfirmForm) {
            resetConfirmForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleConfirmPasswordReset();
            });
        }

        const resetSendLinkBtn = document.getElementById('resetSendLinkBtn');
        if (resetSendLinkBtn) {
            resetSendLinkBtn.addEventListener('click', () => this.handlePasswordResetSendFromConfirm());
        }

        // Toggle show/hide password buttons (login)
        const toggleLoginPw = document.getElementById('toggleLoginPw');
        if (toggleLoginPw) {
            toggleLoginPw.addEventListener('click', () => {
                const input = document.getElementById('loginPassword');
                if (!input) return;
                const icon = toggleLoginPw.querySelector('i');
                const isPwd = input.type === 'password';
                input.type = isPwd ? 'text' : 'password';
                icon.className = isPwd ? 'fas fa-eye-slash' : 'fas fa-eye';
            });
        }

        // Toggle show/hide password buttons (register)
        const toggleRegisterPw = document.getElementById('toggleRegisterPw');
        const toggleRegisterPw2 = document.getElementById('toggleRegisterPw2');
        if (toggleRegisterPw) {
            toggleRegisterPw.addEventListener('click', () => {
                const input = document.getElementById('registerPassword');
                if (!input) return;
                const icon = toggleRegisterPw.querySelector('i');
                const isPwd = input.type === 'password';
                input.type = isPwd ? 'text' : 'password';
                icon.className = isPwd ? 'fas fa-eye-slash' : 'fas fa-eye';
            });
        }
        if (toggleRegisterPw2) {
            toggleRegisterPw2.addEventListener('click', () => {
                const input = document.getElementById('registerConfirmPassword');
                if (!input) return;
                const icon = toggleRegisterPw2.querySelector('i');
                const isPwd = input.type === 'password';
                input.type = isPwd ? 'text' : 'password';
                icon.className = isPwd ? 'fas fa-eye-slash' : 'fas fa-eye';
            });
        }
        // Reset password modal toggles
        const toggleResetPw = document.getElementById('toggleResetPw');
        if (toggleResetPw) {
            toggleResetPw.addEventListener('click', () => {
                const input = document.getElementById('resetNewPassword');
                if (!input) return;
                const icon = toggleResetPw.querySelector('i');
                const isPwd = input.type === 'password';
                input.type = isPwd ? 'text' : 'password';
                icon.className = isPwd ? 'fas fa-eye-slash' : 'fas fa-eye';
            });
        }
        const toggleResetPw2 = document.getElementById('toggleResetPw2');
        if (toggleResetPw2) {
            toggleResetPw2.addEventListener('click', () => {
                const input = document.getElementById('resetConfirmPassword');
                if (!input) return;
                const icon = toggleResetPw2.querySelector('i');
                const isPwd = input.type === 'password';
                input.type = isPwd ? 'text' : 'password';
                icon.className = isPwd ? 'fas fa-eye-slash' : 'fas fa-eye';
            });
        }

        const resetConfirmModal = document.getElementById('resetConfirmModal');
        if (resetConfirmModal) {
            resetConfirmModal.addEventListener('click', (e) => {
                if (e.target.id === 'resetConfirmModal') {
                    this.hideResetConfirmModal();
                }
            });
        }

        const closeResetConfirmModal = document.getElementById('closeResetConfirmModal');
        if (closeResetConfirmModal) {
            closeResetConfirmModal.addEventListener('click', () => {
                this.hideResetConfirmModal();
            });
        }
    }

    createThemeToggle() {
        const themeToggle = document.createElement('div');
        themeToggle.className = 'theme-toggle';
        themeToggle.innerHTML = '<button class="theme-toggle-btn" id="themeToggleBtn">Dark mode</button>';
        document.body.appendChild(themeToggle);

        const themeToggleBtn = document.getElementById('themeToggleBtn');
        const applyTheme = (mode) => {
            document.body.classList.toggle('dark', mode === 'dark');
        };
        
        const saved = localStorage.getItem('theme') || 'light';
        applyTheme(saved);
        themeToggleBtn.textContent = (saved === 'dark') ? 'Light mode' : 'Dark mode';
        
        themeToggleBtn.addEventListener('click', () => {
            const current = document.body.classList.contains('dark') ? 'dark' : 'light';
            const next = current === 'dark' ? 'light' : 'dark';
            localStorage.setItem('theme', next);
            applyTheme(next);
            themeToggleBtn.textContent = next === 'dark' ? 'Light mode' : 'Dark mode';
        });
    }

    async handleLogin() {
        if (!this.authManager) {
            this.showMessage('Please wait, system is initializing...', 'error');
            return;
        }

        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        const loginBtn = document.getElementById('loginBtn');

        // Show loading state
        loginBtn.disabled = true;
        loginBtn.classList.add('loading');
        loginBtn.textContent = 'Signing in...';

        try {
            const result = await this.authManager.signIn(email, password);
            
            if (result.success) {
                this.showMessage('Login successful! Redirecting...', 'success');
                setTimeout(() => {
                    this.redirectToApp();
                }, 1000);
            } else {
                this.showMessage('Login error: ' + result.error, 'error');
            }
        } catch (error) {
            this.showMessage('An unexpected error occurred. Please try again.', 'error');
        } finally {
            // Reset button state
            loginBtn.disabled = false;
            loginBtn.classList.remove('loading');
            loginBtn.textContent = 'Sign In';
        }
    }

    async handleRegister() {
        if (!this.authManager) {
            this.showMessage('Please wait, system is initializing...', 'error');
            return;
        }

        const email = document.getElementById('registerEmail').value;
        const password = document.getElementById('registerPassword').value;
        const confirmPassword = document.getElementById('registerConfirmPassword').value;
        const registerBtn = document.getElementById('registerBtn');

        if (password !== confirmPassword) {
            this.showMessage('Password confirmation does not match', 'error');
            return;
        }

        if (password.length < 6) {
            this.showMessage('Password must be at least 6 characters long', 'error');
            return;
        }

        // Show loading state
        registerBtn.disabled = true;
        registerBtn.classList.add('loading');
        registerBtn.textContent = 'Creating account...';

        try {
            console.log('Starting registration for:', email);
            const result = await this.authManager.signUp(email, password);
            console.log('Registration result:', result);
            
            if (result.success) {
                this.showMessage('Registration successful! Please check your email to confirm your account.', 'success');
                // Redirect to verification page with email parameter
                setTimeout(() => {
                    window.location.href = `../verify-email.html?email=${encodeURIComponent(email)}`;
                }, 2000);
            } else {
                this.showMessage('Registration error: ' + result.error, 'error');
            }
        } catch (error) {
            console.error('Registration error:', error);
            this.showMessage('Registration error: ' + error.message, 'error');
        } finally {
            // Reset button state
            registerBtn.disabled = false;
            registerBtn.classList.remove('loading');
            registerBtn.textContent = 'Sign Up';
        }
    }


    redirectToApp() {
        window.location.href = '/app';
    }

    async handlePasswordResetSendFromConfirm() {
        const email = document.getElementById('resetConfirmEmail').value.trim();
        const btn = document.getElementById('resetSendLinkBtn');
        if (!email) {
            this.showMessage('Please enter your email address', 'error');
            return;
        }
        btn.disabled = true;
        btn.classList.add('loading');
        try {
            const result = await this.authManager.requestPasswordReset(email);
            if (result.success) {
                this.showMessage('Reset code sent! Check your email.', 'success');
                const otp = document.getElementById('resetOtp');
                if (otp) otp.focus();
            } else {
                this.showMessage('Error: ' + result.error, 'error');
            }
        } catch (error) {
            this.showMessage('An unexpected error occurred. Please try again.', 'error');
        } finally {
            btn.disabled = false;
            btn.classList.remove('loading');
        }
    }

    async handleConfirmPasswordReset() {
        if (!this.authManager) {
            this.showMessage('Please wait, system is initializing...', 'error');
            return;
        }

        const email = document.getElementById('resetConfirmEmail').value.trim();
        const otp = document.getElementById('resetOtp').value.trim();
        const newPw = document.getElementById('resetNewPassword').value;
        const confirmPw = document.getElementById('resetConfirmPassword').value;
        const btn = document.getElementById('resetConfirmBtn');

        if (!email || !otp || !newPw || !confirmPw) {
            this.showMessage('Please fill in all fields', 'error');
            return;
        }
        if (newPw !== confirmPw) {
            this.showMessage('Password confirmation does not match', 'error');
            return;
        }
        if (newPw.length < 6) {
            this.showMessage('Password must be at least 6 characters long', 'error');
            return;
        }

        btn.disabled = true;
        btn.classList.add('loading');
        btn.textContent = 'Updating...';

        try {
            const result = await this.authManager.confirmPasswordReset(email, otp, newPw);
            if (result.success) {
                this.showMessage('Password updated successfully! Please sign in.', 'success');
                this.hideResetConfirmModal();
                document.getElementById('loginEmail').value = email;
                document.getElementById('loginPassword').focus();
            } else {
                this.showMessage('Error: ' + result.error, 'error');
            }
        } catch (error) {
            this.showMessage('An unexpected error occurred. Please try again.', 'error');
        } finally {
            btn.disabled = false;
            btn.classList.remove('loading');
            btn.textContent = 'Update Password';
        }
    }

    showResetConfirmModal() {
        document.getElementById('resetConfirmModal').style.display = 'flex';
        const email = document.getElementById('loginEmail')?.value || '';
        const emailInput = document.getElementById('resetConfirmEmail');
        if (emailInput && email) emailInput.value = email;
    }

    hideResetConfirmModal() {
        document.getElementById('resetConfirmModal').style.display = 'none';
        document.getElementById('resetConfirmEmail').value = '';
        document.getElementById('resetOtp').value = '';
        document.getElementById('resetNewPassword').value = '';
        document.getElementById('resetConfirmPassword').value = '';
        this.clearMessages();
    }

    showMessage(text, type = 'info') {
        this.clearMessages();
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;
        messageDiv.innerHTML = `
            <div class="message-content">
                <i class="fas fa-${type === 'error' ? 'exclamation-triangle' : type === 'success' ? 'check-circle' : 'info-circle'}"></i>
                <span class="message-text">${text}</span>
            </div>
        `;
        
        // Insert message at the top of the login container
        const loginContainer = document.querySelector('.login-container');
        loginContainer.insertBefore(messageDiv, loginContainer.firstChild);
        
        // Auto-hide success messages after 5 seconds
        if (type === 'success') {
            setTimeout(() => {
                if (messageDiv.parentNode) {
                    messageDiv.remove();
                }
            }, 5000);
        }
    }

    clearMessages() {
        const messages = document.querySelectorAll('.message');
        messages.forEach(message => message.remove());
    }

    clearForms() {
        document.getElementById('loginEmail').value = '';
        document.getElementById('loginPassword').value = '';
        document.getElementById('registerEmail').value = '';
        document.getElementById('registerPassword').value = '';
        document.getElementById('registerConfirmPassword').value = '';
        this.clearMessages();
    }
}

// Initialize login manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new LoginManager();
});
