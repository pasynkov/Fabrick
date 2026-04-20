variable "location" {
  description = "Azure region"
  type        = string
  default     = "westeurope"
}

variable "domain_name" {
  description = "Apex domain for the landing page"
  type        = string
  default     = "fabrick.me"
}
