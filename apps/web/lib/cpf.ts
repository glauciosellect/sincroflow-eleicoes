export function validarCPF(cpf: string): boolean {
  const nums = cpf.replace(/\D/g, '')
  if (nums.length !== 11) return false
  // Rejeita sequências como 00000000000, 11111111111, etc.
  if (/^(\d)\1{10}$/.test(nums)) return false

  const calc = (len: number) => {
    let sum = 0
    for (let i = 0; i < len; i++) sum += parseInt(nums[i]) * (len + 1 - i)
    const r = (sum * 10) % 11
    return r >= 10 ? 0 : r
  }

  return calc(9) === parseInt(nums[9]) && calc(10) === parseInt(nums[10])
}

export function formatarCPF(cpf: string): string {
  const nums = cpf.replace(/\D/g, '').slice(0, 11)
  return nums
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
}
