# NestJS framework hint

NestJS is a TypeScript application framework using decorators for routing, DI, and configuration. Apply these starter rules; drop anything not actually present in the snapshot; promote anything frequent that the snapshot shows.

## Slug → decorators

### service
- `@Module` — every NestJS module file (high-confidence service signal)
- `@Injectable` — providers / services
- `@Global` — global modules
- `@Inject` / `@Optional` — DI plumbing (weaker signal)

### contracts
- `@Controller` — HTTP route group
- `@MessagePattern`, `@EventPattern` — microservice request-reply / event consumer
- HTTP verbs: `@Get`, `@Post`, `@Put`, `@Patch`, `@Delete`, `@Options`, `@Head`, `@All`
- `@WebSocketGateway`, `@SubscribeMessage` — WebSocket
- `@GrpcMethod`, `@GrpcStreamMethod` — gRPC

### config
- `@Expose` (from class-transformer, when used on config classes — verify with file pattern)
- ConfigModule / ConfigService import is a stronger signal than decorators alone
- AVOID treating class-validator decorators (`@IsString`, `@IsInt`, `@IsOptional`, `@IsNotEmpty`, `@IsArray`, `@ValidateNested`, `@Transform`, `@Type`) as config signals — they are generic and used in any data class; let file patterns decide

### integrations
- `@Entity`, `@Column`, `@PrimaryGeneratedColumn`, `@PrimaryColumn`, `@ManyToOne`, `@OneToMany`, `@OneToOne`, `@ManyToMany`, `@JoinColumn`, `@CreateDateColumn`, `@UpdateDateColumn`, `@Index`, `@Unique` — TypeORM (PostgreSQL/MySQL/etc.)
- `@Prop`, `@Schema` — Mongoose / NestJS Mongoose
- `@InjectRepository`, `@InjectDataSource`, `@InjectModel`, `@InjectConnection` — ORM injection

## Slug → file patterns

| Pattern               | Slug(s)                    |
|-----------------------|----------------------------|
| `*.module.ts`         | service                    |
| `*.controller.ts`     | contracts                  |
| `*.gateway.ts`        | contracts                  |
| `*.resolver.ts`       | contracts (GraphQL)        |
| `*.service.ts`        | service                    |
| `*.config.ts`         | config                     |
| `*.entity.ts`         | integrations               |
| `*.schema.ts`         | integrations (Mongoose)    |
| `*.repository.ts`     | integrations               |
| `*.migration.ts`      | integrations               |
| `*/database/**`       | integrations               |
| `*/migrations/**`     | integrations               |
| `*.dto.ts`            | contracts                  |
| `*.contract.ts`       | contracts                  |
| `*.strategy.ts`       | service (auth/context)     |
| `sentinel.options.ts` | service (project-specific) |
| `main.ts`             | service                    |
| `*.spec.ts`           | (skip — test)              |
| `*.e2e-spec.ts`       | (skip — test)              |
| `index.ts`            | (skip — barrel re-export)  |
| `docker-compose*.yml` | service                    |
| `Dockerfile*`         | service                    |

## Slug → imports

### service
- `@nestjs/common`
- `@nestjs/core`
- `@nestjs/platform-express`
- `@nestjs/platform-fastify`
- `@nestjs/terminus` (health checks for the service itself)

### contracts
- `@nestjs/microservices`
- `@nestjs/websockets`
- `@nestjs/graphql`

### config
- `@nestjs/config`
- `class-validator` / `class-transformer` (file-level signal, not decorator-level)

### integrations (external SDKs only)
- `@nestjs/typeorm` + `typeorm` — TypeORM (PostgreSQL / MySQL / SQLite)
- `@nestjs/mongoose` + `mongoose` — MongoDB
- `@nestjs/sequelize` — Sequelize
- `kafkajs` — Apache Kafka
- `ioredis` / `redis` — Redis
- `bullmq` / `bull` — job queues backed by Redis
- `@google-cloud/storage` — GCS
- `@google-cloud/bigquery` — BigQuery
- `@google-cloud/pubsub` — Cloud Pub/Sub
- `@aws-sdk/*` — AWS
- `@azure/*` — Azure
- `@nestjs/axios` / `axios` — HTTP client for external APIs
- `nats` — NATS broker
- `amqplib` — RabbitMQ

## Monorepo layout

If `nest-cli.json` has `"projects"`, treat each as an app:
- `nest-cli.json.projects[<name>].root` → app root path
- `nest-cli.json.projects[<name>].sourceRoot` → src dir
- `nest-cli.json.projects[<name>].type` → `application` (service) or `library`

Common monorepo run commands: `nest start <app>`, `npm run start <app>`, `npm run start:dev <app>`.

## Gotchas

- `@nestjs/microservices/external/kafka.interface` is an internal NestJS re-export of kafkajs interfaces — count it under contracts/service, not integrations.
- Validators (`class-validator`) appear on both config classes AND DTOs — never use a single class-validator decorator as a slug signal.
- An `@Injectable()` annotated class is service infrastructure even when it imports an external SDK; the SDK import is the integration signal, the file is still a `service.md` citizen by primary kind.
- `*.spec.ts` and `*.e2e-spec.ts` are tests — exclude from wiki routing.
- `index.ts` barrel files re-export from siblings — exclude from routing; their content is documented through the re-exported files.
