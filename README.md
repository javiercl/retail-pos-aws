# retail-pos-aws

Stack para POS retail:

- `frontend/`: React + Vite
- `backend/`: Node.js + Express, JWT propio (HS256), SQLite en archivo local
- `infra/`: Terraform para ECR + EC2 (Docker), sin RDS ni Cognito

## Flujo

1. (Opcional) Provisionar infra con Terraform en `infra/`.
2. Construir y subir la imagen del backend a ECR.
3. EC2 ejecuta el contenedor del backend (SQLite persistido en volumen en la instancia).
4. El frontend consume la API; login/registro van a `POST /auth/login` y `POST /auth/register`.

## Variables backend (local)

Ver `backend/.env.example`: `PORT`, `SQLITE_PATH`, `JWT_SECRET`.

En Terraform, define `jwt_secret` en `terraform.tfvars` (ver `terraform.tfvars.example`).
