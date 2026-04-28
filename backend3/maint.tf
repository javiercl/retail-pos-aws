terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

data "aws_caller_identity" "current" {}

variable "aws_region" {
  description = "AWS region for all resources"
  type        = string
  default     = "mx-central-1"
}

variable "project_name" {
  description = "Prefix for resource naming"
  type        = string
  default     = "retail-pos"
}

variable "backend_image_tag" {
  description = "Tag to deploy from ECR for backend3 image"
  type        = string
  default     = "latest"
}

variable "instance_type" {
  description = "EC2 instance type for backend container host"
  type        = string
  default     = "t3.micro"
}

variable "key_name" {
  description = "Optional EC2 key pair name for SSH"
  type        = string
  default     = null
}

variable "ssh_cidr" {
  description = "CIDR allowed to SSH into EC2"
  type        = string
  default     = "0.0.0.0/0"
}

variable "terraform_runner_principal_arn" {
  description = "Optional IAM user/role ARN to attach Terraform runner policy"
  type        = string
  default     = null
}

variable "db_name" {
  description = "PostgreSQL database name"
  type        = string
  default     = "postgres"
}

variable "db_username" {
  description = "PostgreSQL master username"
  type        = string
  default     = "postgres"
}

variable "db_password" {
  description = "PostgreSQL master password (min 8 chars)"
  type        = string
  sensitive   = true
}

variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t3.micro"
}

variable "cognito_callback_urls" {
  description = "Allowed callback URLs for app client (if using Hosted UI)"
  type        = list(string)
  default     = ["http://localhost:5173"]
}

variable "cognito_logout_urls" {
  description = "Allowed logout URLs for app client (if using Hosted UI)"
  type        = list(string)
  default     = ["http://localhost:5173"]
}

variable "generate_client_secret" {
  description = "Set true if backend will use client secret hash"
  type        = bool
  default     = false
}

data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "default_vpc" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}

data "aws_ami" "al2023" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-*-x86_64"]
  }
}

resource "aws_security_group" "backend_sg" {
  name        = "${var.project_name}-backend3-ec2-sg"
  description = "Allow HTTP and SSH to backend3 host"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    from_port   = 3000
    to_port     = 3000
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = [var.ssh_cidr]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_security_group" "rds_sg" {
  name        = "${var.project_name}-backend3-rds-sg"
  description = "Allow PostgreSQL only from backend EC2 SG"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.backend_sg.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_db_subnet_group" "backend3_db_subnets" {
  name       = "${var.project_name}-backend3-db-subnets"
  subnet_ids = slice(data.aws_subnets.default_vpc.ids, 0, 2)
}

resource "aws_db_instance" "backend3_postgres" {
  identifier             = "${var.project_name}-backend3-postgres"
  engine                 = "postgres"
  engine_version         = "16.3"
  instance_class         = var.db_instance_class
  allocated_storage      = 20
  max_allocated_storage  = 100
  storage_type           = "gp3"
  db_name                = var.db_name
  username               = var.db_username
  password               = var.db_password
  skip_final_snapshot    = true
  publicly_accessible    = false
  db_subnet_group_name   = aws_db_subnet_group.backend3_db_subnets.name
  vpc_security_group_ids = [aws_security_group.rds_sg.id]
}

resource "aws_ecr_repository" "backend3" {
  name                 = "${var.project_name}-backend3"
  image_tag_mutability = "MUTABLE"
}

resource "aws_iam_role" "ec2_role" {
  name = "${var.project_name}-backend3-ec2-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = "sts:AssumeRole"
      Principal = { Service = "ec2.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "ecr_read" {
  role       = aws_iam_role.ec2_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly"
}

resource "aws_iam_role_policy_attachment" "ssm_core" {
  role       = aws_iam_role.ec2_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_instance_profile" "ec2_profile" {
  name = "${var.project_name}-backend3-ec2-profile"
  role = aws_iam_role.ec2_role.name
}

resource "aws_iam_policy" "terraform_runner_policy" {
  name        = "${var.project_name}-backend3-terraform-runner"
  description = "Permissions to manage backend3 Terraform stack resources"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "Ec2VpcReadAndManage"
        Effect = "Allow"
        Action = [
          "ec2:Describe*",
          "ec2:RunInstances",
          "ec2:TerminateInstances",
          "ec2:CreateTags",
          "ec2:DeleteTags",
          "ec2:CreateSecurityGroup",
          "ec2:DeleteSecurityGroup",
          "ec2:AuthorizeSecurityGroupIngress",
          "ec2:RevokeSecurityGroupIngress",
          "ec2:AuthorizeSecurityGroupEgress",
          "ec2:RevokeSecurityGroupEgress",
          "ec2:ModifyInstanceAttribute"
        ]
        Resource = "*"
      },
      {
        Sid    = "RdsManage"
        Effect = "Allow"
        Action = [
          "rds:CreateDBInstance",
          "rds:ModifyDBInstance",
          "rds:DeleteDBInstance",
          "rds:DescribeDBInstances",
          "rds:CreateDBSubnetGroup",
          "rds:ModifyDBSubnetGroup",
          "rds:DeleteDBSubnetGroup",
          "rds:DescribeDBSubnetGroups",
          "rds:AddTagsToResource",
          "rds:ListTagsForResource"
        ]
        Resource = "*"
      },
      {
        Sid    = "CognitoManage"
        Effect = "Allow"
        Action = [
          "cognito-idp:CreateUserPool",
          "cognito-idp:UpdateUserPool",
          "cognito-idp:DeleteUserPool",
          "cognito-idp:DescribeUserPool",
          "cognito-idp:CreateUserPoolClient",
          "cognito-idp:UpdateUserPoolClient",
          "cognito-idp:DeleteUserPoolClient",
          "cognito-idp:DescribeUserPoolClient",
          "cognito-idp:ListUserPools",
          "cognito-idp:ListUserPoolClients",
          "cognito-idp:TagResource",
          "cognito-idp:UntagResource",
          "cognito-idp:ListTagsForResource"
        ]
        Resource = "*"
      },
      {
        Sid    = "EcrManage"
        Effect = "Allow"
        Action = [
          "ecr:CreateRepository",
          "ecr:DeleteRepository",
          "ecr:DescribeRepositories",
          "ecr:ListTagsForResource",
          "ecr:TagResource",
          "ecr:UntagResource",
          "ecr:SetRepositoryPolicy",
          "ecr:GetAuthorizationToken"
        ]
        Resource = "*"
      },
      {
        Sid    = "IamRoleAndProfileForEc2"
        Effect = "Allow"
        Action = [
          "iam:CreateRole",
          "iam:DeleteRole",
          "iam:GetRole",
          "iam:TagRole",
          "iam:UntagRole",
          "iam:PutRolePolicy",
          "iam:DeleteRolePolicy",
          "iam:AttachRolePolicy",
          "iam:DetachRolePolicy",
          "iam:CreateInstanceProfile",
          "iam:DeleteInstanceProfile",
          "iam:GetInstanceProfile",
          "iam:AddRoleToInstanceProfile",
          "iam:RemoveRoleFromInstanceProfile"
        ]
        Resource = [
          "arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/${var.project_name}-backend3-ec2-role",
          "arn:aws:iam::${data.aws_caller_identity.current.account_id}:instance-profile/${var.project_name}-backend3-ec2-profile"
        ]
      },
      {
        Sid      = "PassRoleToEc2"
        Effect   = "Allow"
        Action   = "iam:PassRole"
        Resource = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/${var.project_name}-backend3-ec2-role"
        Condition = {
          StringEquals = {
            "iam:PassedToService" = "ec2.amazonaws.com"
          }
        }
      }
    ]
  })
}

resource "aws_iam_user_policy_attachment" "terraform_runner_user_attach" {
  count      = var.terraform_runner_principal_arn != null && can(regex(":user/", var.terraform_runner_principal_arn)) ? 1 : 0
  user       = element(reverse(split("/", var.terraform_runner_principal_arn)), 0)
  policy_arn = aws_iam_policy.terraform_runner_policy.arn
}

resource "aws_iam_role_policy_attachment" "terraform_runner_role_attach" {
  count      = var.terraform_runner_principal_arn != null && can(regex(":role/", var.terraform_runner_principal_arn)) ? 1 : 0
  role       = element(reverse(split("/", var.terraform_runner_principal_arn)), 0)
  policy_arn = aws_iam_policy.terraform_runner_policy.arn
}

resource "aws_cognito_user_pool" "backend3_pool" {
  name = "${var.project_name}-backend3-user-pool"

  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]

  password_policy {
    minimum_length                   = 8
    require_lowercase                = true
    require_numbers                  = true
    require_symbols                  = true
    require_uppercase                = true
    temporary_password_validity_days = 7
  }

  verification_message_template {
    default_email_option = "CONFIRM_WITH_CODE"
  }

  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }

  schema {
    attribute_data_type = "String"
    name                = "email"
    required            = true
    mutable             = true

    string_attribute_constraints {
      min_length = 5
      max_length = 256
    }
  }

  schema {
    attribute_data_type = "String"
    name                = "name"
    required            = false
    mutable             = true

    string_attribute_constraints {
      min_length = 1
      max_length = 256
    }
  }
}

resource "aws_cognito_user_pool_client" "backend3_client" {
  name         = "${var.project_name}-backend3-client"
  user_pool_id = aws_cognito_user_pool.backend3_pool.id

  generate_secret = var.generate_client_secret

  explicit_auth_flows = [
    "ALLOW_USER_PASSWORD_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH",
    "ALLOW_USER_SRP_AUTH"
  ]

  supported_identity_providers = ["COGNITO"]

  callback_urls = var.cognito_callback_urls
  logout_urls   = var.cognito_logout_urls

  allowed_oauth_flows_user_pool_client = false

  prevent_user_existence_errors = "ENABLED"
}

locals {
  backend3_image = "${aws_ecr_repository.backend3.repository_url}:${var.backend_image_tag}"
}

resource "aws_instance" "backend3_ec2" {
  ami                         = data.aws_ami.al2023.id
  instance_type               = var.instance_type
  subnet_id                   = data.aws_subnets.default_vpc.ids[0]
  vpc_security_group_ids      = [aws_security_group.backend_sg.id]
  iam_instance_profile        = aws_iam_instance_profile.ec2_profile.name
  associate_public_ip_address = true
  key_name                    = var.key_name

  user_data = <<-EOF
    #!/bin/bash
    set -eux
    dnf update -y
    dnf install -y docker
    systemctl enable docker
    systemctl start docker
    usermod -aG docker ec2-user

    aws ecr get-login-password --region ${var.aws_region} | docker login --username AWS --password-stdin ${aws_ecr_repository.backend3.repository_url}
    docker pull ${local.backend3_image}
    docker rm -f backend3 || true
    docker run -d --name backend3 -p 3000:3000 \
      -e PORT=3000 \
      -e DB_HOST=${aws_db_instance.backend3_postgres.address} \
      -e DB_PORT=5432 \
      -e DB_USER=${var.db_username} \
      -e DB_PASSWORD='${var.db_password}' \
      -e DB_NAME=${var.db_name} \
      -e COGNITO_REGION=${var.aws_region} \
      -e COGNITO_USER_POOL_ID=${aws_cognito_user_pool.backend3_pool.id} \
      -e COGNITO_CLIENT_ID=${aws_cognito_user_pool_client.backend3_client.id} \
      -e COGNITO_CLIENT_SECRET='${aws_cognito_user_pool_client.backend3_client.client_secret}' \
      ${local.backend3_image}
  EOF

  depends_on = [aws_db_instance.backend3_postgres]
}

output "cognito_region" {
  description = "Use as COGNITO_REGION in backend3"
  value       = var.aws_region
}

output "cognito_user_pool_id" {
  description = "Use as COGNITO_USER_POOL_ID in backend3"
  value       = aws_cognito_user_pool.backend3_pool.id
}

output "cognito_client_id" {
  description = "Use as COGNITO_CLIENT_ID in backend3"
  value       = aws_cognito_user_pool_client.backend3_client.id
}

output "cognito_client_secret" {
  description = "Use as COGNITO_CLIENT_SECRET in backend3 when generate_client_secret=true"
  value       = aws_cognito_user_pool_client.backend3_client.client_secret
  sensitive   = true
}

output "ecr_repository_url" {
  description = "ECR repository URL for backend3 image push"
  value       = aws_ecr_repository.backend3.repository_url
}

output "backend_public_url" {
  description = "Public URL for backend3 running in EC2 container"
  value       = "http://${aws_instance.backend3_ec2.public_ip}:3000"
}

output "rds_endpoint" {
  description = "RDS PostgreSQL endpoint hostname"
  value       = aws_db_instance.backend3_postgres.address
}

output "terraform_runner_policy_arn" {
  description = "IAM policy ARN with permissions required to apply backend3 Terraform"
  value       = aws_iam_policy.terraform_runner_policy.arn
}
