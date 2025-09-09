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
        } else {
            // Nếu đã vào login mà có session guest thì xóa guest
            sessionStorage.removeItem('guestMode');
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

        document.getElementById('guestLogin').addEventListener('click', () => {
            this.handleGuestLogin();
        });
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
            alert('Please wait, system is initializing...');
            return;
        }

        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;

        const result = await this.authManager.signIn(email, password);
        
        if (result.success) {
            this.redirectToApp();
        } else {
            alert('Login error: ' + result.error);
        }
    }

    async handleRegister() {
        if (!this.authManager) {
            alert('Please wait, system is initializing...');
            return;
        }

        const email = document.getElementById('registerEmail').value;
        const password = document.getElementById('registerPassword').value;
        const confirmPassword = document.getElementById('registerConfirmPassword').value;

        if (password !== confirmPassword) {
            alert('Password confirmation does not match');
            return;
        }

        const result = await this.authManager.signUp(email, password);
        
        if (result.success) {
            alert('Registration successful! Please check your email to confirm your account.');
            document.getElementById('registerForm').style.display = 'none';
            document.getElementById('loginForm').style.display = 'block';
            this.clearForms();
        } else {
            alert('Registration error: ' + result.error);
        }
    }

    handleGuestLogin() {
        // Set guest mode flag
        sessionStorage.setItem('guestMode', 'true');
        
        if (!this.authManager) {
            // For guest mode, we can still proceed without authManager
            // Just redirect directly
            this.redirectToApp();
            return;
        }
        
        this.authManager.setGuestMode();
        this.redirectToApp();
    }

    redirectToApp() {
    window.location.href = '../app/';
    }

    clearForms() {
        document.getElementById('loginEmail').value = '';
        document.getElementById('loginPassword').value = '';
        document.getElementById('registerEmail').value = '';
        document.getElementById('registerPassword').value = '';
        document.getElementById('registerConfirmPassword').value = '';
    }
}

// Initialize login manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new LoginManager();
});
