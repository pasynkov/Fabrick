import { PushDossierUpdateDto } from '../dto/push-dossier-update.dto';

export class PushDossierUpdateCommand {
  constructor(
    public readonly repoId: string,
    public readonly userId: string,
    public readonly dto: PushDossierUpdateDto,
  ) {}
}
