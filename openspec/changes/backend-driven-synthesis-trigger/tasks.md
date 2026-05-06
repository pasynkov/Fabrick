## 1. Create UploadContextDto

- [ ] 1.1 Create UploadContextDto with triggerSynthesis boolean field and proper @Transform decorator
- [ ] 1.2 Add validation for DTO fields
- [ ] 1.3 Add JSDoc documentation for DTO

## 2. Update ReposController.uploadContext

- [ ] 2.1 Inject SynthesisService into ReposController
- [ ] 2.2 Update uploadContext method signature to accept UploadContextDto
- [ ] 2.3 Resolve project from repository after context upload
- [ ] 2.4 Check project's autoSynthesisEnabled setting
- [ ] 2.5 Trigger synthesis via SynthesisService.triggerForProject if needed
- [ ] 2.6 Wrap synthesis trigger in try-catch to prevent context upload failure

## 3. Update CLI push.command.ts

- [ ] 3.1 Remove handleSynthesis method call after context upload
- [ ] 3.2 Add logic to prompt user when autoSynthesisEnabled is false
- [ ] 3.3 Include triggerSynthesis flag in context upload form data
- [ ] 3.4 Remove synthesis endpoint triggering code

## 4. Testing

- [ ] 4.1 Write unit tests for UploadContextDto transformation
- [ ] 4.2 Add tests for ReposController upload with/without triggerSynthesis flag
- [ ] 4.3 Add tests for autoSynthesisEnabled true/false scenarios
- [ ] 4.4 Add integration tests for complete CLI-to-backend flow
