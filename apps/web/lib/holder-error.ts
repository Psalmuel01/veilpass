/** Translate generated circuit assertions into holder-facing actions. */
export function holderError(error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : "The operation could not be completed.";
  if (message.includes("Credential not active in current registry"))
    return "This credential is not active in the current registry. Ask your issuer to confirm its status.";
  if (message.includes("Qualification level too low"))
    return "This credential does not meet the selected qualification level.";
  if (message.includes("Credential expired"))
    return "This credential has expired. Ask your issuer for a new qualification.";
  if (
    message.startsWith("Unexpected error executing") ||
    message.includes("failed assert:")
  )
    return "The credential did not pass verification. Check its issuer, status and the selected policy.";
  return message;
}
