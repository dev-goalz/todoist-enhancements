/** A request the server cannot read. Answered with HTTP 400, never 401 or 403. */
export class BadRequest extends Error {
  readonly statusCode = 400;
}
