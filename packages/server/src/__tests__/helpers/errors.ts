export class TestDbConnectionError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'TestDbConnectionError';
  }
}

export class TestDbMigrationError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'TestDbMigrationError';
  }
}

export class TestDbSeedError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'TestDbSeedError';
  }
}
