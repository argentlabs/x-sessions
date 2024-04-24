export class SignSessionError extends Error {
  constructor(
    message: string,
    public cause: any,
  ) {
    super(message)

    Error.captureStackTrace(this, this.constructor)
  }
}
