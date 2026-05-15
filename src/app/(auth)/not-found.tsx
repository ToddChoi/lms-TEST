import Link from 'next/link'

export default function AuthNotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-4 text-center">
      <h2 className="text-xl font-semibold text-navy">페이지를 찾을 수 없습니다</h2>
      <p className="text-sm text-gray-500">로그인 또는 회원가입을 진행해주세요.</p>
      <div className="mt-2 flex gap-2">
        <Link
          href="/login"
          className="rounded-lg bg-accent px-5 py-2 text-sm text-white hover:bg-accent/90"
        >
          로그인
        </Link>
        <Link
          href="/"
          className="rounded-lg border border-gray-200 bg-white px-5 py-2 text-sm text-gray-700 hover:border-accent hover:text-accent"
        >
          홈으로
        </Link>
      </div>
    </div>
  )
}
