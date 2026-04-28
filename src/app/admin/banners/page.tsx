import { redirect } from 'next/navigation'

// 배너 관리는 홈페이지 관리 > banner 타입 섹션으로 통합되었습니다.
export default function AdminBannersPage() {
  redirect('/admin/cms')
}
