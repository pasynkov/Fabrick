variable "subscription_id" {
  description = "Azure subscription ID"
  type        = string
}

variable "anthropic_api_key" {
  description = "Anthropic API key for synthesis service"
  type        = string
  sensitive   = true
}
