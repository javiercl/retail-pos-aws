variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "project_name" {
  type    = string
  default = "retail-pos"
}

variable "db_name" {
  type    = string
  default = "retail_pos"
}

variable "db_username" {
  type    = string
  default = "retail_admin"
}

variable "db_password" {
  type      = string
  sensitive = true
}

variable "backend_image_tag" {
  type    = string
  default = "latest"
}

variable "ssh_cidr" {
  type    = string
  default = "0.0.0.0/0"
}

variable "key_name" {
  type    = string
  default = null
}

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

variable "db_name" {
  description = "PostgreSQL database name"
  type        = string
  default     = "retail_pos"
}

variable "db_username" {
  description = "PostgreSQL admin username"
  type        = string
  default     = "retail_admin"
}

variable "db_password" {
  description = "PostgreSQL admin password"
  type        = string
  sensitive   = true
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
