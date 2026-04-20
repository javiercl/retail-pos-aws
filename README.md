# retail-pos-aws

Stack completo para POS retail:

- `frontend/`: React + Vite
- `backend/`: Node.js + Express con JWT de Cognito y PostgreSQL (RDS)
- `infra/`: Terraform para Cognito + RDS + ECR + EC2 micro con Docker

## Flujo

1. Provisionar infra con Terraform.
2. Construir y subir imagen del backend a ECR.
3. EC2 corre el contenedor del backend.
4. Frontend consume API y autentica con Cognito.
# Retail POS AWS

Proyecto full-stack para un POS retail con:

- Frontend: React + Vite
- Backend: Node.js + Express (contenedor Docker)
- Auth: Amazon Cognito (JWT)
- Persistencia: Amazon RDS PostgreSQL
- Infra: Terraform (EC2 t3.micro + RDS + Cognito + ECR)

## Estructura

- `frontend/`: app React para login y operaciones POS
- `backend/`: API REST con validacion JWT y conexion a PostgreSQL
- `infra/`: Terraform para aprovisionar servicios AWS

## Flujo rapido

1. Provisionar infraestructura en `infra/`.
2. Build y push de imagen backend a ECR.
3. EC2 levanta contenedor backend desde ECR.
4. Frontend consume API y usa Cognito para autenticacion.
