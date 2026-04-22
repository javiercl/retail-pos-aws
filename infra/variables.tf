variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Base name for resources"
  type        = string
  default     = "retail-pos"
}

variable "backend_image_tag" {
  description = "Tag to deploy from ECR"
  type        = string
  default     = "latest"
}

variable "ssh_cidr" {
  description = "CIDR allowed to SSH into EC2"
  type        = string
  default     = "0.0.0.0/0"
}

variable "key_name" {
  description = "Optional key pair name for SSH"
  type        = string
  default     = null
}

variable "jwt_secret" {
  description = "Secret for signing JWTs (HS256)"
  type        = string
  sensitive   = true
}
