/** A confirm problem the person can fix (shown as-is, with the HTTP status to send). */
export class ConfirmError extends Error {
  constructor(message: string, readonly status: number, readonly details?: string[]) {
    super(message);
    this.name = "ConfirmError";
  }
}
