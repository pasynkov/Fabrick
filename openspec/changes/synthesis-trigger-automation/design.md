## Synthesis Trigger Automation Design

### Overview
This component provides a flexible, extensible framework for automatically triggering synthesis based on configurable events and conditions. It supports multiple trigger types and integrates with the existing synthesis service.

### Architecture

#### Trigger Types
1. **Push Trigger**: Triggered when code is pushed to the repository
2. **Schedule Trigger**: Triggered based on cron expressions for scheduled synthesis
3. **Webhook Trigger**: Triggered via external webhooks

#### Core Components
- **TriggerService**: Manages trigger lifecycle (register, unregister, evaluate)
- **BaseTrigger**: Abstract base class for all trigger implementations
- **TriggerRegistry**: Tracks active triggers per project
- **TriggerScheduler**: Evaluates and executes time-based triggers
- **TriggersController**: REST API for trigger management

#### Database Schema
- `synthesis_triggers`: Stores trigger configurations
- `synthesis_trigger_logs`: Records trigger execution history

### Integration Points
- Works with existing `SynthesisService.triggerForProject`
- Respects project-level `autoSynthesisEnabled` setting
- Publishes jobs to existing synthesis queue system
