CREATE EXTENSION IF NOT EXISTS vector;

-- Create tables if they do not exist
CREATE TABLE IF NOT EXISTS roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR UNIQUE
);

CREATE TABLE IF NOT EXISTS permissions (
    id SERIAL PRIMARY KEY,
    name VARCHAR UNIQUE
);

CREATE TABLE IF NOT EXISTS role_permissions (
    role_id INTEGER REFERENCES roles(id),
    permission_id INTEGER REFERENCES permissions(id),
    PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR UNIQUE,
    email VARCHAR UNIQUE,
    hashed_password VARCHAR,
    role_id INTEGER REFERENCES roles(id)
);

CREATE TABLE IF NOT EXISTS vectors (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    embedding vector(384),
    metadata JSON
);

-- Insert initial permissions
INSERT INTO permissions (name) VALUES ('read_vectors') ON CONFLICT (name) DO NOTHING;
INSERT INTO permissions (name) VALUES ('write_vectors') ON CONFLICT (name) DO NOTHING;
INSERT INTO permissions (name) VALUES ('admin') ON CONFLICT (name) DO NOTHING;

-- Insert initial roles
INSERT INTO roles (name) VALUES ('user') ON CONFLICT (name) DO NOTHING;
INSERT INTO roles (name) VALUES ('admin') ON CONFLICT (name) DO NOTHING;

-- Associate permissions with roles
-- 'user' role gets 'read_vectors' and 'write_vectors'
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'user' AND p.name IN ('read_vectors', 'write_vectors')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 'admin' role gets all permissions ('read_vectors', 'write_vectors', 'admin')
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'admin'
ON CONFLICT (role_id, permission_id) DO NOTHING;
