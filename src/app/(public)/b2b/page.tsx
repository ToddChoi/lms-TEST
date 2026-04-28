import { Building2, CheckCircle, BarChart3, Users, Award, BookOpen } from 'lucide-react'
import B2BContactForm from '@/components/public/B2BContactForm'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '기업 도입',
  description: '기업 맞춤형 이러닝 솔루션 — Ingrow LMS B2B',
}

const benefits = [
  { icon: Users, title: '임직원 통합 관리', desc: '소속 임직원의 수강 현황을 한눈에 관리하세요.' },
  { icon: BookOpen, title: '맞춤형 커리큘럼', desc: '기업 니즈에 맞는 강좌를 선별·구성할 수 있습니다.' },
  { icon: BarChart3, title: '학습 현황 대시보드', desc: '부서별·개인별 학습 진도와 수료율을 실시간으로 확인.' },
  { icon: Award, title: '수료증 일괄 발급', desc: '이수 완료 임직원에게 수료증을 자동 발급합니다.' },
]

export default function B2BPage() {
  return (
    <div className="flex flex-col">
      {/* 히어로 */}
      <section className="bg-gradient-to-br from-navy to-navy-light py-20 text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-sm">
            <Building2 className="h-4 w-4" /> 기업 도입 문의
          </div>
          <h1 className="text-4xl font-bold leading-tight sm:text-5xl">
            임직원 교육,<br />
            <span className="text-accent-light">Ingrow LMS로 한 번에</span>
          </h1>
          <p className="mt-6 text-lg text-gray-300 max-w-2xl mx-auto">
            기업 맞춤형 커리큘럼부터 학습 현황 관리까지.<br />
            AI 시대에 필요한 실무 역량을 체계적으로 키워드립니다.
          </p>
          <div className="mt-8">
            <a href="#b2b-form">
              <button className="inline-flex items-center gap-2 rounded-xl bg-accent hover:bg-accent-light px-6 py-3 text-sm font-medium text-white transition">
                아래에서 상담 신청하기 ↓
              </button>
            </a>
          </div>
        </div>
      </section>

      {/* 혜택 */}
      <section className="bg-silver py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-center text-2xl font-bold text-navy mb-10">기업 도입 혜택</h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {benefits.map((b) => (
              <div key={b.title} className="rounded-2xl bg-white p-6 shadow-sm">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-accent-pale">
                  <b.icon className="h-5 w-5 text-accent" />
                </div>
                <h3 className="font-semibold text-navy mb-2">{b.title}</h3>
                <p className="text-sm text-gray-500">{b.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA + 상담 신청 폼 */}
      <section id="b2b-form" className="bg-white py-16">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-navy">지금 바로 도입 상담을 신청하세요</h2>
            <p className="mt-3 text-gray-500">담당자가 빠르게 연락드립니다.</p>
            <ul className="mt-6 mb-8 flex flex-col gap-2 items-center text-sm text-gray-600">
              {['무료 데모 제공', '도입 후 전담 CS 지원', '기업 규모에 맞는 요금제'].map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 shrink-0" /> {item}
                </li>
              ))}
            </ul>
          </div>

          <B2BContactForm />
        </div>
      </section>
    </div>
  )
}
