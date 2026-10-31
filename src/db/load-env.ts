export function loadLocalEnv(): void {
  try {
    process.loadEnvFile?.(".env");
  } catch {
    // .env is optional; environment variables may be provided directly.
  }
}
