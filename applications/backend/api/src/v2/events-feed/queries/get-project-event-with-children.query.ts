export class GetProjectEventWithChildrenQuery {
  constructor(
    public readonly repoId: string,
    public readonly eventId: string,
  ) {}
}
