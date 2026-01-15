CREATE EXTENSION IF NOT EXISTS vector;

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
ON CONFLICT DO NOTHING;

-- 'admin' role gets all permissions ('read_vectors', 'write_vectors', 'admin')
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'admin'
ON CONFLICT DO NOTHING;
