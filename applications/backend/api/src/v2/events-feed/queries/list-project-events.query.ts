export class ListProjectEventsQuery {
  constructor(
    public readonly filter: {
      orgId?: string;
      projectId?: string;
      repoId?: string;
    },
    public readonly since?: string,
    public readonly limit: number = 50,
    public readonly types?: string,
  ) {}
}
