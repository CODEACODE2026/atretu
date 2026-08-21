import { BadRequestException } from "@nestjs/common";

const MIN_PASSWORD_LENGTH = 8;

const OBVIOUS_PASSWORDS = new Set([
  "123456",
  "12345678",
  "123456789",
  "password",
  "senha",
  "senha123",
  "admin123",
  "atretu123",
]);

export function assertPasswordPolicy(input: {
  password: string;
  currentPassword?: string;
  name?: string;
  email?: string;
}): void {
  const password = input.password;
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new BadRequestException("A senha deve ter pelo menos 8 caracteres");
  }
  if (!/[A-Z]/.test(password)) {
    throw new BadRequestException("A senha deve conter letra maiuscula");
  }
  if (!/[a-z]/.test(password)) {
    throw new BadRequestException("A senha deve conter letra minuscula");
  }
  if (!/\d/.test(password)) {
    throw new BadRequestException("A senha deve conter numero");
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    throw new BadRequestException("A senha deve conter caractere especial");
  }
  if (input.currentPassword && password === input.currentPassword) {
    throw new BadRequestException("A nova senha deve ser diferente da atual");
  }

  const normalizedPassword = normalizeComparable(password);
  if (OBVIOUS_PASSWORDS.has(normalizedPassword)) {
    throw new BadRequestException("A nova senha nao atende a politica minima");
  }
  if (input.email && normalizedPassword === normalizeComparable(input.email)) {
    throw new BadRequestException("A senha nao pode ser igual ao e-mail");
  }
  if (input.name && normalizedPassword === normalizeComparable(input.name)) {
    throw new BadRequestException("A senha nao pode ser igual ao nome");
  }
}

function normalizeComparable(value: string): string {
  return value.trim().toLowerCase();
}
