# ATSF v3.0 - Terraform Configuration (AWS)
# ==========================================
#
# Infrastructure as Code for deploying ATSF on AWS.
#
# Usage:
#   terraform init
#   terraform plan
#   terraform apply

terraform {
  required_version = ">= 1.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.23"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.11"
    }
  }
  
  backend "s3" {
    bucket         = "atsf-terraform-state"
    key            = "production/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "atsf-terraform-locks"
  }
}

# =============================================================================
# VARIABLES
# =============================================================================

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "production"
}

variable "region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "vpc_cidr" {
  description = "VPC CIDR block"
  type        = string
  default     = "10.0.0.0/16"
}

variable "cluster_name" {
  description = "EKS cluster name"
  type        = string
  default     = "atsf-cluster"
}

variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t3.medium"
}

variable "redis_node_type" {
  description = "ElastiCache node type"
  type        = string
  default     = "cache.t3.small"
}

# =============================================================================
# PROVIDER
# =============================================================================

provider "aws" {
  region = var.region
  
  default_tags {
    tags = {
      Project     = "ATSF"
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  }
}

# =============================================================================
# VPC
# =============================================================================

module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "5.1.0"
  
  name = "atsf-vpc"
  cidr = var.vpc_cidr
  
  azs             = ["${var.region}a", "${var.region}b", "${var.region}c"]
  private_subnets = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
  public_subnets  = ["10.0.101.0/24", "10.0.102.0/24", "10.0.103.0/24"]
  
  enable_nat_gateway     = true
  single_nat_gateway     = false
  one_nat_gateway_per_az = true
  
  enable_dns_hostnames = true
  enable_dns_support   = true
  
  # Tags for EKS
  public_subnet_tags = {
    "kubernetes.io/cluster/${var.cluster_name}" = "shared"
    "kubernetes.io/role/elb"                    = "1"
  }
  
  private_subnet_tags = {
    "kubernetes.io/cluster/${var.cluster_name}" = "shared"
    "kubernetes.io/role/internal-elb"           = "1"
  }
}

# =============================================================================
# EKS CLUSTER
# =============================================================================

module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "19.16.0"
  
  cluster_name    = var.cluster_name
  cluster_version = "1.28"
  
  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.private_subnets
  
  cluster_endpoint_public_access = true
  
  eks_managed_node_groups = {
    main = {
      name           = "atsf-nodes"
      instance_types = ["t3.large"]
      
      min_size     = 3
      max_size     = 10
      desired_size = 3
      
      labels = {
        Environment = var.environment
      }
    }
  }
  
  # Cluster addons
  cluster_addons = {
    coredns = {
      most_recent = true
    }
    kube-proxy = {
      most_recent = true
    }
    vpc-cni = {
      most_recent = true
    }
  }
}

# =============================================================================
# RDS (PostgreSQL)
# =============================================================================

resource "aws_db_subnet_group" "atsf" {
  name       = "atsf-db-subnet"
  subnet_ids = module.vpc.private_subnets
}

resource "aws_security_group" "rds" {
  name        = "atsf-rds-sg"
  description = "Security group for ATSF RDS"
  vpc_id      = module.vpc.vpc_id
  
  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [module.eks.cluster_security_group_id]
  }
  
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_db_instance" "atsf" {
  identifier = "atsf-db"
  
  engine               = "postgres"
  engine_version       = "15.3"
  instance_class       = var.db_instance_class
  allocated_storage    = 100
  max_allocated_storage = 500
  
  db_name  = "atsf"
  username = "atsf"
  password = random_password.db_password.result
  
  db_subnet_group_name   = aws_db_subnet_group.atsf.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  
  backup_retention_period = 7
  backup_window          = "03:00-04:00"
  maintenance_window     = "Mon:04:00-Mon:05:00"
  
  multi_az            = true
  storage_encrypted   = true
  deletion_protection = true
  
  performance_insights_enabled = true
  
  skip_final_snapshot = false
  final_snapshot_identifier = "atsf-db-final-snapshot"
}

resource "random_password" "db_password" {
  length  = 32
  special = true
}

# =============================================================================
# ELASTICACHE (Redis)
# =============================================================================

resource "aws_elasticache_subnet_group" "atsf" {
  name       = "atsf-redis-subnet"
  subnet_ids = module.vpc.private_subnets
}

resource "aws_security_group" "redis" {
  name        = "atsf-redis-sg"
  description = "Security group for ATSF Redis"
  vpc_id      = module.vpc.vpc_id
  
  ingress {
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [module.eks.cluster_security_group_id]
  }
  
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_elasticache_replication_group" "atsf" {
  replication_group_id       = "atsf-redis"
  description                = "ATSF Redis cluster"
  
  node_type            = var.redis_node_type
  num_cache_clusters   = 2
  port                 = 6379
  
  subnet_group_name    = aws_elasticache_subnet_group.atsf.name
  security_group_ids   = [aws_security_group.redis.id]
  
  automatic_failover_enabled = true
  multi_az_enabled          = true
  
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  
  snapshot_retention_limit = 7
  snapshot_window         = "05:00-06:00"
  maintenance_window      = "sun:06:00-sun:07:00"
}

# =============================================================================
# SECRETS MANAGER
# =============================================================================

resource "aws_secretsmanager_secret" "atsf" {
  name = "atsf/production/secrets"
  
  recovery_window_in_days = 7
}

resource "aws_secretsmanager_secret_version" "atsf" {
  secret_id = aws_secretsmanager_secret.atsf.id
  
  secret_string = jsonencode({
    DATABASE_URL = "postgresql://atsf:${random_password.db_password.result}@${aws_db_instance.atsf.endpoint}/atsf"
    REDIS_URL    = "redis://${aws_elasticache_replication_group.atsf.primary_endpoint_address}:6379/0"
    JWT_SECRET   = random_password.jwt_secret.result
  })
}

resource "random_password" "jwt_secret" {
  length  = 64
  special = false
}

# =============================================================================
# S3 (Backups & Logs)
# =============================================================================

resource "aws_s3_bucket" "backups" {
  bucket = "atsf-backups-${var.environment}"
}

resource "aws_s3_bucket_versioning" "backups" {
  bucket = aws_s3_bucket.backups.id
  
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "backups" {
  bucket = aws_s3_bucket.backups.id
  
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "aws:kms"
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "backups" {
  bucket = aws_s3_bucket.backups.id
  
  rule {
    id     = "archive-old-backups"
    status = "Enabled"
    
    transition {
      days          = 30
      storage_class = "GLACIER"
    }
    
    expiration {
      days = 365
    }
  }
}

# =============================================================================
# OUTPUTS
# =============================================================================

output "vpc_id" {
  description = "VPC ID"
  value       = module.vpc.vpc_id
}

output "eks_cluster_endpoint" {
  description = "EKS cluster endpoint"
  value       = module.eks.cluster_endpoint
}

output "eks_cluster_name" {
  description = "EKS cluster name"
  value       = module.eks.cluster_name
}

output "rds_endpoint" {
  description = "RDS endpoint"
  value       = aws_db_instance.atsf.endpoint
  sensitive   = true
}

output "redis_endpoint" {
  description = "Redis endpoint"
  value       = aws_elasticache_replication_group.atsf.primary_endpoint_address
  sensitive   = true
}

output "secrets_arn" {
  description = "Secrets Manager ARN"
  value       = aws_secretsmanager_secret.atsf.arn
}
