import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UploadContextDto } from './upload-context.dto';

describe('UploadContextDto', () => {
  it('defaults triggerSynthesis to false when not provided', async () => {
    const dto = plainToInstance(UploadContextDto, {});
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.triggerSynthesis).toBeUndefined();
  });

  it('transforms string "true" to boolean true', async () => {
    const dto = plainToInstance(UploadContextDto, { triggerSynthesis: 'true' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.triggerSynthesis).toBe(true);
  });

  it('transforms string "false" to boolean false', async () => {
    const dto = plainToInstance(UploadContextDto, { triggerSynthesis: 'false' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.triggerSynthesis).toBe(false);
  });

  it('accepts boolean true directly', async () => {
    const dto = plainToInstance(UploadContextDto, { triggerSynthesis: true });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.triggerSynthesis).toBe(true);
  });

  it('accepts boolean false directly', async () => {
    const dto = plainToInstance(UploadContextDto, { triggerSynthesis: false });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.triggerSynthesis).toBe(false);
  });
});
