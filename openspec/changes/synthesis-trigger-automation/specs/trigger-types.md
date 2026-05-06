# Trigger Types Specification

## Push Trigger
Automatically triggers synthesis when code is pushed to the repository.

### Configuration
- `enabled`: Whether this trigger is active
- `branches`: Optional array of branch patterns to watch

## Schedule Trigger
Triggers synthesis on a recurring schedule using cron expressions.

### Configuration
- `cronExpression`: Standard cron format (e.g., "0 2 * * *" for 2 AM daily)
- `timezone`: Optional timezone for cron evaluation
- `enabled`: Whether this trigger is active

## Webhook Trigger
Reserved for future implementation. Allows external systems to trigger synthesis via webhook.

### Configuration
- `url`: Webhook endpoint URL
- `secret`: Optional webhook signature secret
- `enabled`: Whether this trigger is active
