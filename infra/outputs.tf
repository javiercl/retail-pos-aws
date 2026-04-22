output "backend_public_url" {
  description = "Backend API base URL over EC2 public IP"
  value       = "http://${aws_instance.backend.public_ip}:8080"
}

output "ecr_repository_url" {
  description = "ECR repository URL for backend image push"
  value       = aws_ecr_repository.backend.repository_url
}
