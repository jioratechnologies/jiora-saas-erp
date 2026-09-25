/**
 * Standardized client-friendly error formatter.
 *
 * Transforms raw HTTP responses, JSON payloads, and technical exceptions
 * into short, concise, understandable messages for end users.
 */
export function formatErrorMessage(error: unknown, fallback = "Something went wrong. Please try again."): string {
  if (!error) return fallback;

  // If already a string, check if it's a JSON payload like '{"statusCode":500,"message":"..."}'
  if (typeof error === "string") {
    const trimmed = error.trim();
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      try {
        const parsed = JSON.parse(trimmed);
        return formatErrorMessage(parsed, fallback);
      } catch {
        // Not valid JSON, continue with string translation
      }
    }
    return cleanMessage(trimmed, fallback);
  }

  // If Error instance or object with message/status
  if (typeof error === "object") {
    const err = error as Record<string, any>;

    // Handle nested response from fetch / axios / NestJS
    const status = err.status ?? err.statusCode ?? err.response?.status;
    const rawMessage = err.response?.data?.message ?? err.message ?? err.error;

    if (Array.isArray(rawMessage)) {
      // NestJS ValidationPipe returns array of validation strings
      const first = rawMessage[0];
      if (typeof first === "string") return cleanMessage(first, fallback);
    }

    if (typeof rawMessage === "string") {
      const trimmed = rawMessage.trim();
      if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
        try {
          const parsed = JSON.parse(trimmed);
          return formatErrorMessage(parsed, fallback);
        } catch {
          // Fall through
        }
      }
      return cleanMessage(trimmed, fallback, status);
    }

    // Status-based clean fallbacks
    if (status) {
      return statusToMessage(Number(status), fallback);
    }
  }

  return fallback;
}

function cleanMessage(msg: string, fallback: string, status?: number): string {
  const lower = msg.toLowerCase();

  // Network / Connection
  if (lower.includes("failed to fetch") || lower.includes("networkerror") || lower.includes("econnrefused")) {
    return "Unable to connect to server. Please check your internet connection.";
  }

  // Duplicate / Unique conflicts
  if (
    lower.includes("already exists") ||
    lower.includes("unique constraint") ||
    lower.includes("p2002") ||
    lower.includes("duplicate") ||
    status === 409
  ) {
    return "This name or record already exists. Please choose a different one.";
  }

  // Permissions / Auth
  if (status === 401 || lower.includes("unauthorized") || lower.includes("token expired")) {
    return "Your session has expired. Please sign in again.";
  }
  if (status === 403 || lower.includes("forbidden") || lower.includes("permission")) {
    return "You do not have permission to perform this action.";
  }

  // Not found
  if (status === 404 || lower.includes("not found")) {
    return "The requested item could not be found.";
  }

  // Server errors (500)
  if (
    status === 500 ||
    lower.includes("internal server error") ||
    lower.includes("prisma") ||
    lower.includes("database")
  ) {
    return "Server is temporarily unable to complete this request. The item may already exist.";
  }

  // If short human-readable message without technical symbols, return capitalized
  if (!msg.includes("{") && !msg.includes("}") && !msg.includes("Exception") && msg.length < 120) {
    return msg.charAt(0).toUpperCase() + msg.slice(1);
  }

  return fallback;
}

function statusToMessage(status: number, fallback: string): string {
  switch (status) {
    case 400:
      return "Invalid input. Please check your entries and try again.";
    case 401:
      return "Your session has expired. Please sign in again.";
    case 403:
      return "You do not have permission to perform this action.";
    case 404:
      return "The requested record could not be found.";
    case 409:
      return "This record already exists. Please use a different value.";
    case 422:
      return "Validation failed. Please verify the entered information.";
    case 500:
    case 502:
    case 503:
      return "The server encountered a temporary issue. Please try again shortly.";
    default:
      return fallback;
  }
}
