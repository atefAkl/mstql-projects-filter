export class MostaqlAuthError extends Error {
  constructor(message: string = 'Authentication required or session expired for Mostaql') {
    super(message);
    this.name = 'MostaqlAuthError';
  }
}

export class MostaqlParsingError extends Error {
  constructor(message: string, public readonly rawHtmlSnippet?: string) {
    super(message);
    this.name = 'MostaqlParsingError';
  }
}

export class MostaqlNetworkError extends Error {
  constructor(message: string, public readonly statusCode?: number) {
    super(message);
    this.name = 'MostaqlNetworkError';
  }
}
