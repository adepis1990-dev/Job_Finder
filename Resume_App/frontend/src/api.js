import { supabase } from './supabaseClient'

const API = 'http://localhost:8000'

/**
 * Fetch wrapper that automatically adds the Supabase auth token.
 */
export async function authFetch(path, options = {}) {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token

  const headers = {
    ...(options.headers || {}),
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  // Don't set Content-Type for FormData (browser sets it with boundary)
  if (options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json'
  }

  return fetch(`${API}${path}`, { ...options, headers })
}

export { API }
