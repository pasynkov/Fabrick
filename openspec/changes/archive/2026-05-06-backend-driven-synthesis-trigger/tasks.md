## 1. Create UploadContextDto

- [x] 1.1 Create UploadContextDto with triggerSynthesis boolean field and proper @Transform decorator
- [x] 1.2 Add validation for DTO fields
- [x] 1.3 Add JSDoc documentation for DTO

## 2. Update ReposController.uploadContext

- [x] 2.1 Inject SynthesisService into ReposController
- [x] 2.2 Update uploadContext method signature to accept UploadContextDto
- [x] 2.3 Resolve project from repository after context upload
- [x] 2.4 Check project's autoSynthesisEnabled setting
- [x] 2.5 Trigger synthesis via SynthesisService.triggerForProject if needed
- [x] 2.6 Wrap synthesis trigger in try-catch to prevent context upload failure

## 3. Update CLI push.command.ts

- [x] 3.1 Remove handleSynthesis method call after context upload
- [x] 3.2 Add logic to prompt user when autoSynthesisEnabled is false
- [x] 3.3 Include triggerSynthesis flag in context upload form data
- [x] 3.4 Remove synthesis endpoint triggering code

## 4. Testing

- [x] 4.1 Write unit tests for UploadContextDto transformation
- [x] 4.2 Add tests for ReposController upload with/without triggerSynthesis flag
- [x] 4.3 Add tests for autoSynthesisEnabled true/false scenarios
- [x] 4.4 Add integration tests for complete CLI-to-backend flow
