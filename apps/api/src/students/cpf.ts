export function normalizeCpf(cpf: string): string {
  return cpf.replace(/\D/g, "");
}

export function isValidCpf(cpf: string): boolean {
  const normalized = normalizeCpf(cpf);

  if (normalized.length !== 11 || /^(\d)\1+$/.test(normalized)) {
    return false;
  }

  const digits = normalized.split("").map(Number);
  const firstCheck = calculateCheckDigit(digits.slice(0, 9));
  const secondCheck = calculateCheckDigit([...digits.slice(0, 9), firstCheck]);

  return digits[9] === firstCheck && digits[10] === secondCheck;
}

export function maskCpf(cpf: string): string {
  const normalized = normalizeCpf(cpf);
  if (normalized.length !== 11) {
    return "";
  }

  return `${normalized.slice(0, 3)}.***.***-${normalized.slice(9)}`;
}

function calculateCheckDigit(numbers: number[]): number {
  const factorStart = numbers.length + 1;
  const sum = numbers.reduce(
    (total, number, index) => total + number * (factorStart - index),
    0,
  );
  const remainder = (sum * 10) % 11;
  return remainder === 10 ? 0 : remainder;
}
