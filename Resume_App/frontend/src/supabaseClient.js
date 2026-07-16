import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://ampqhrkhngogtjclmokl.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFtcHFocmtobmdvZ3RqY2xtb2tsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMwMDA2NzIsImV4cCI6MjA5ODU3NjY3Mn0.nirhNTgRxA8zfBbflIxOh8xAjF_CzWnSpYAhghcG0VU'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
