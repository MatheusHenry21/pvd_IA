export interface CurrentUser { id: number; name: string; is_staff: boolean }
let token = ''
export function authHeaders(): Record<string, string> { return token ? {Authorization: `Token ${token}`} : {} }
const base = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api').replace(/\/$/, '')
export async function login(username: string, password: string): Promise<CurrentUser> {
  let response: Response
  try { response = await fetch(`${base}/auth/login/`, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({username, password})}) }
  catch { throw new Error('Não foi possível conectar ao servidor.') }
  if (!response.ok) throw new Error(response.status === 429 ? 'Muitas tentativas. Aguarde um minuto.' : 'Usuário ou senha incorretos.')
  const data = await response.json()
  token = data.token
  return data.user
}
export async function logout() {
  try { await fetch(`${base}/auth/logout/`, {method: 'POST', headers: authHeaders()}) }
  finally { token = '' }
}
