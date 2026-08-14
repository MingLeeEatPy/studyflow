export class DataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DataError";
  }
}

export class NotFoundError extends DataError {
  constructor(entity: string) {
    super(`${entity}不存在`);
    this.name = "NotFoundError";
  }
}

export class ConflictError extends DataError {
  constructor(message: string) {
    super(message);
    this.name = "ConflictError";
  }
}

