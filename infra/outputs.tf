output "backend_api_url" {
  value       = "http://${aws_instance.backend.public_ip}:8080"
  description = "URL publica del backend"
}

output "ecr_repository_url" {
  value       = aws_ecr_repository.backend.repository_url
  description = "Repositorio ECR para la imagen backend"
}

output "cognito_user_pool_id" {
  value       = aws_cognito_user_pool.users.id
  description = "User Pool de Cognito"
}

output "cognito_client_id" {
  value       = aws_cognito_user_pool_client.web_client.id
  description = "Client ID para frontend"
}

output "rds_endpoint" {
  value       = aws_db_instance.postgres.address
  description = "Host de RDS PostgreSQL"
}
output "backend_public_url" {
  description = "Backend API base URL over EC2 public IP"
  value       = "http://${aws_instance.backend.public_ip}:8080"
}

output "ecr_repository_url" {
  description = "ECR repository URL for backend image push"
  value       = aws_ecr_repository.backend.repository_url
}

output "cognito_user_pool_id" {
  description = "Cognito User Pool ID"
  value       = aws_cognito_user_pool.users.id
}

output "cognito_client_id" {
  description = "Cognito User Pool Client ID"
  value       = aws_cognito_user_pool_client.web.id
}

output "rds_endpoint" {
  description = "RDS endpoint host"
  value       = aws_db_instance.postgres.address
}
