export class DomainError extends Error {
  constructor(status,code,message) {super(message);this.status=status;this.code=code;}
}
export function fail(status,code,message) {throw new DomainError(status,code,message);}
