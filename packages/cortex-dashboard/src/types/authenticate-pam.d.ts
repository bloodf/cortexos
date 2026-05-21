declare module "authenticate-pam" {
  export function authenticate(
    username: string,
    password: string,
    callback: (err?: Error | string | null) => void,
  ): void;
}
