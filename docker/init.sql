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
    vector_metadata JSON
);

-- Insert initial permissions
INSERT INTO permissions (name) SELECT 'read_vectors' WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'read_vectors');
INSERT INTO permissions (name) SELECT 'write_vectors' WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'write_vectors');
INSERT INTO permissions (name) SELECT 'admin' WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'admin');

-- Insert initial roles
INSERT INTO roles (name) SELECT 'user' WHERE NOT EXISTS (SELECT 1 FROM roles WHERE name = 'user');
INSERT INTO roles (name) SELECT 'admin' WHERE NOT EXISTS (SELECT 1 FROM roles WHERE name = 'admin');

-- Associate permissions with roles
-- 'user' role gets 'read_vectors' and 'write_vectors'
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'user' AND p.name IN ('read_vectors', 'write_vectors')
ON CONFLICT DO NOTHING;

-- 'admin' role gets all permissions ('read_vectors', 'write_vectors', 'admin')
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'admin'
ON CONFLICT DO NOTHING;
