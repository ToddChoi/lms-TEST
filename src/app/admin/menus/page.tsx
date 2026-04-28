import { redirect } from 'next/navigation'

// 메뉴 관리는 /admin/cms/menus 로 이동되었습니다.
export default function AdminMenusPage() {
  redirect('/admin/cms/menus')
}
