-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- USERS
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    is_verified BOOLEAN DEFAULT FALSE,
    avatar_url TEXT DEFAULT 'https://desagkrnfvonxzkpuiyc.supabase.co/storage/v1/object/public/Avatar/avt.jpg',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- REFRESH TOKENS
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(512) UNIQUE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    revoked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- OTP CODES
CREATE TABLE IF NOT EXISTS otp_codes (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    otp_code VARCHAR(6) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- FILES
CREATE TABLE IF NOT EXISTS files (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    file_url TEXT NOT NULL,
    file_type VARCHAR(50) NOT NULL,
    file_size BIGINT,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- CHAT SESSIONS
CREATE TABLE IF NOT EXISTS chat_sessions (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- SESSION FILES
CREATE TABLE IF NOT EXISTS session_files (
    id SERIAL PRIMARY KEY,
    session_id INT NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    file_id INT NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(session_id, file_id)
);

-- MESSAGE ROLE ENUM
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'message_role') THEN
        CREATE TYPE message_role AS ENUM ('user', 'bot');
    END IF;
END$$;

-- CHAT MESSAGES
CREATE TABLE IF NOT EXISTS chat_messages (
    id SERIAL PRIMARY KEY,
    session_id INT NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    role message_role NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- FILE CHUNKS (có embedding vector 384 chiều)
CREATE TABLE IF NOT EXISTS file_chunks (
    id SERIAL PRIMARY KEY,
    session_id INT NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    file_id INT NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    chunk_index INT NOT NULL,
    text TEXT NOT NULL,
    embedding vector(384), -- embedding 384 chiều
    embedding_model VARCHAR(255) DEFAULT 'all-MiniLM-L6-v2',
    chunk_size INT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(session_id, file_id, chunk_index)
);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_otp_codes_user_id ON otp_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_otp_codes_code ON otp_codes(otp_code);
CREATE INDEX IF NOT EXISTS idx_files_user_id ON files(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_session_files_session_id ON session_files(session_id);
CREATE INDEX IF NOT EXISTS idx_session_files_file_id ON session_files(file_id);
CREATE INDEX IF NOT EXISTS idx_messages_session_id ON chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_file_chunks_session_id ON file_chunks(session_id);
CREATE INDEX IF NOT EXISTS idx_file_chunks_file_id ON file_chunks(file_id);
CREATE INDEX IF NOT EXISTS idx_file_chunks_session_chunk ON file_chunks(session_id, chunk_index);
CREATE INDEX IF NOT EXISTS idx_file_chunks_embedding ON file_chunks USING ivfflat (embedding vector_cosine_ops);

-- RLS ENABLE
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE refresh_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE otp_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE files ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE file_chunks ENABLE ROW LEVEL SECURITY;

-- POLICIES
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'users_select_policy') THEN
        CREATE POLICY users_select_policy ON users
        FOR SELECT USING (id = current_setting('jwt.claims.user_id')::int);
    END IF;
END$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'users_update_policy') THEN
        CREATE POLICY users_update_policy ON users
        FOR UPDATE USING (id = current_setting('jwt.claims.user_id')::int);
    END IF;
END$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'refresh_tokens_policy') THEN
        CREATE POLICY refresh_tokens_policy ON refresh_tokens
        FOR ALL USING (user_id = current_setting('jwt.claims.user_id')::int);
    END IF;
END$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'otp_codes_policy') THEN
        CREATE POLICY otp_codes_policy ON otp_codes
        FOR ALL USING (user_id = current_setting('jwt.claims.user_id')::int);
    END IF;
END$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'files_policy') THEN
        CREATE POLICY files_policy ON files
        FOR ALL USING (user_id = current_setting('jwt.claims.user_id')::int);
    END IF;
END$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'chat_sessions_policy') THEN
        CREATE POLICY chat_sessions_policy ON chat_sessions
        FOR ALL USING (user_id = current_setting('jwt.claims.user_id')::int);
    END IF;
END$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'session_files_policy') THEN
        CREATE POLICY session_files_policy ON session_files
        FOR SELECT USING (session_id IN (
            SELECT id FROM chat_sessions WHERE user_id = current_setting('jwt.claims.user_id')::int
        ));
    END IF;
END$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'chat_messages_policy') THEN
        CREATE POLICY chat_messages_policy ON chat_messages
        FOR SELECT USING (session_id IN (
            SELECT id FROM chat_sessions WHERE user_id = current_setting('jwt.claims.user_id')::int
        ));
    END IF;
END$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'file_chunks_select_policy') THEN
        CREATE POLICY file_chunks_select_policy ON file_chunks
        FOR SELECT USING (
            session_id IN (
                SELECT id FROM chat_sessions WHERE user_id = current_setting('jwt.claims.user_id')::int
            )
        );
    END IF;
END$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'file_chunks_insert_policy') THEN
        CREATE POLICY file_chunks_insert_policy ON file_chunks
        FOR INSERT WITH CHECK (
            session_id IN (
                SELECT id FROM chat_sessions WHERE user_id = current_setting('jwt.claims.user_id')::int
            )
        );
    END IF;
END$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'file_chunks_update_policy') THEN
        CREATE POLICY file_chunks_update_policy ON file_chunks
        FOR UPDATE USING (
            session_id IN (
                SELECT id FROM chat_sessions WHERE user_id = current_setting('jwt.claims.user_id')::int
            )
        );
    END IF;
END$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'file_chunks_delete_policy') THEN
        CREATE POLICY file_chunks_delete_policy ON file_chunks
        FOR DELETE USING (
            session_id IN (
                SELECT id FROM chat_sessions WHERE user_id = current_setting('jwt.claims.user_id')::int
            )
        );
    END IF;
END$$;
