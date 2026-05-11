/**
 * Admin 사이드바 NAV 정의 — server (layout) + client (mobile drawer) 공용.
 * 두 곳에서 import 해서 같은 메뉴 구조 보여줌.
 */
import {
  LayoutDashboard,
  BookOpen,
  Users,
  ClipboardList,
  Award,
  Building2,
  BarChart3,
  Bell,
  Settings,
  Tag,
  Upload,
  CreditCard,
  HelpCircle,
  MessageSquare,
  Navigation,
  LayoutTemplate,
  Blocks,
  FileText,
  Image as ImageIcon,
  Briefcase,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  href: string
  label: string
  icon: LucideIcon
  exact?: boolean
}
export interface NavGroup {
  label: string
  items: NavItem[]
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: '개요',
    items: [
      { href: '/admin',            label: '대시보드',     icon: LayoutDashboard, exact: true },
      { href: '/admin/statistics', label: '통계',         icon: BarChart3 },
    ],
  },
  {
    label: '학습 콘텐츠',
    items: [
      { href: '/admin/courses',    label: '강좌 관리',    icon: BookOpen },
      { href: '/admin/categories', label: '카테고리',     icon: Tag },
    ],
  },
  {
    label: '회원·결제',
    items: [
      { href: '/admin/users',        label: '회원 관리',  icon: Users },
      { href: '/admin/enrollments',  label: '수강 신청',  icon: ClipboardList },
      { href: '/admin/certificates', label: '수료증',           icon: Award },
      { href: '/admin/certificates/templates', label: '수료증 템플릿', icon: FileText },
      { href: '/admin/payments',     label: '결제 내역',  icon: CreditCard },
      { href: '/admin/companies',    label: '협약기업',   icon: Building2 },
      { href: '/admin/bulk',         label: '일괄 업로드', icon: Upload },
    ],
  },
  {
    label: '콘텐츠 (CMS)',
    items: [
      { href: '/admin/cms/builder/home', label: '페이지 빌더 (홈)',  icon: Blocks },
      { href: '/admin/cms/builder/b2b',  label: '페이지 빌더 (B2B)', icon: LayoutTemplate },
      { href: '/admin/pages',            label: '정적 페이지',       icon: FileText },
      { href: '/admin/notices',          label: '공지사항',          icon: Bell },
      { href: '/admin/faqs',             label: 'FAQ',               icon: HelpCircle },
      { href: '/admin/contacts',         label: '이용문의',          icon: MessageSquare },
      { href: '/admin/cms/menus',        label: '네비게이션',        icon: Navigation },
      { href: '/admin/media',            label: '미디어 라이브러리', icon: ImageIcon },
    ],
  },
  {
    label: '오프라인 교육',
    items: [
      { href: '/admin/offline/programs', label: '프로그램 관리', icon: Briefcase },
      // 회차/신청·결제/대기열/출결/수료증/설정 — Phase 1 후속 세션에서 추가
    ],
  },
  {
    label: '시스템',
    items: [
      { href: '/admin/settings', label: '사이트 설정', icon: Settings },
    ],
  },
]
