import Link from 'next/link'

export default function UserProfileNotFound() {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 px-4 text-center">
      <h2 className="text-base font-semibold text-navy">프로필이 존재하지 않습니다</h2>
      <p className="text-sm text-gray-500">탈퇴했거나 비공개 사용자일 수 있습니다.</p>
      <Link
        href="/"
        className="mt-1 rounded-lg bg-accent px-4 py-1.5 text-sm text-white hover:bg-accent/90"
      >
        홈으로
      </Link>
    </div>
  )
}
