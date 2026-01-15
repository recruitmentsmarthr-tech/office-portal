### Detailed Instructions for Testing the Application

With the updated `docker/init.sql` now including table creation and seed data (roles, permissions, and associations), the application should be fully set up for testing. The database will initialize with the necessary tables and default data (e.g., "user" role with read/write vector permissions, "admin" role with all permissions), allowing registration and permission checks to work out of the box.

Follow these step-by-step instructions to test the vector management application. This covers starting services, verifying functionality via API and UI, and running automated tests. Assume you've created a `.env` file in the project root with actual values (e.g., `POSTGRES_PASSWORD=StrongPass123!`) based on `.env.example`.

#### Prerequisites
- Docker Desktop running.
- `.env` file populated and in project root.
- Terminal in project root.

#### Step 1: Start Services
1. Run: `docker-compose up --build`
   - Builds and starts `db`, `backend`, `frontend`.
   - Wait for health checks (logs show "healthy" for each).
   - If errors (e.g., password issues), check `.env` and run `docker-compose config`.

#### Step 2: Verify Services
- `docker-compose ps`: All "Up" or "Healthy".
- Test connectivity:
  - Backend: `curl http://localhost:8000/` → `{"message": "Hey, world!"}`
  - Frontend: `curl http://localhost:3000` → HTML content.

#### Step 3: Test Backend API (Using curl or Postman)
1. **Register User** (gets default "user" role):
   ```
   curl -X POST "http://localhost:8000/register" -H "Content-Type: application/json" -d '{"username": "testuser", "email": "test@example.com", "password": "testpass123"}'
   ```
   - Response: `{"access_token": "...", "token_type": "bearer"}` (save token).

2. **Login**:
   ```
   curl -X POST "http://localhost:8000/token" -H "Content-Type: application/x-www-form-urlencoded" -d "username=testuser&password=testpass123"
   ```
   - Response: Token.

3. **Get User Info**:
   ```
   curl -X GET "http://localhost:8000/users/me" -H "Authorization: Bearer <token>"
   ```
   - Response: `{"username": "testuser", "role": "user"}`

4. **Create Vector** (requires "write_vectors" permission):
   ```
   curl -X POST "http://localhost:8000/vectors" -H "Authorization: Bearer <token>" -H "Content-Type: application/json" -d '{"embedding": [0.1, 0.2, 0.3], "metadata": {"key": "value"}}'
   ```
   - Response: `{"id": 1}`

5. **Read Vectors** (requires "read_vectors"):
   ```
   curl -X GET "http://localhost:8000/vectors" -H "Authorization: Bearer <token>"
   ```
   - Response: List of vectors.

6. **Admin: Create Role** (requires "admin" permission; use admin user if created):
   ```
   curl -X POST "http://localhost:8000/admin/roles" -H "Authorization: Bearer <token>" -H "Content-Type: application/json" -d '{"name": "moderator"}'
   ```
   - Response: `{"id": 3, "name": "moderator"}`

7. **Admin: Create User**:
   ```
   curl -X POST "http://localhost:8000/admin/users" -H "Authorization: Bearer <token>" -H "Content-Type: application/json" -d '{"username": "adminuser", "email": "admin@example.com", "password": "adminpass123", "role_id": 2}'  # role_id 2 = admin
   ```
   - Response: `{"id": 2, "username": "adminuser"}`

- **Permissions Note**: Default "user" role has vector permissions. For admin actions, create an admin user first.

#### Step 4: Test Frontend UI
1. Open `http://localhost:3000` in your browser.
2. Register/Login via forms.
3. Check Dashboard for user info.
4. Vectors page: Create/fetch vectors.
5. Admin page: Create roles/users (if admin).
6. Monitor browser console for errors.

#### Step 5: Run Automated Tests
- `docker-compose --profile test up test`
- Check logs for pytest results.

#### Step 6: Stop Services
- `docker-compose down` (add `-v` to reset DB).

If issues (e.g., 403 errors), verify seeded data: `docker-compose exec db psql -U <POSTGRES_USER> -d <POSTGRES_DB>` then `SELECT * FROM roles;`. Share logs/errors for fixes. All core features should work now!
