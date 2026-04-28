/**
 * 일반 로그인 사용자용 가드.
 * - 비로그인이면 401 응답을 반환합니다.
 * - 사용 예: const { error, user, supabase } = await requireAuth(); if (error) return error
 *
 * 관리자 전용 가드는 src/app/api/admin/_guard.ts 의 requireAdmin() 을 사용하세요.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export function makeSupabase() {
  return createClient()
}

export async function requireAuth() {
  const supabase = makeSupabase()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return {
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
      user: null,
      supabase: null,
    } as const
  }

  return { error: null, user, supabase } as const
}
