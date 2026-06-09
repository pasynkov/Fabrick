import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

export interface CompendiumCallbackPayload {
  sub: string;
  scope: string;
}

@Injectable()
export class CompendiumJwtService {
  constructor(private readonly jwtService: JwtService) {}

  sign(dossierUpdatedId: string): string {
    return this.jwtService.sign(
      { sub: dossierUpdatedId, scope: 'compendium-callback' },
      { expiresIn: '1h' },
    );
  }

  verify(token: string, expectedJobId: string): void {
    let payload: CompendiumCallbackPayload;
    try {
      payload = this.jwtService.verify<CompendiumCallbackPayload>(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired callback token');
    }
    if (payload.scope !== 'compendium-callback' || payload.sub !== expectedJobId) {
      throw new UnauthorizedException('Token scope or subject mismatch');
    }
  }
}
