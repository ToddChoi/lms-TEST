'use client'

import { useState, useRef } from 'react'
import {
  CreditCard, Receipt, Loader2, AlertCircle, User, Building2, Plus, X, Upload, CheckCircle2,
} from 'lucide-react'
import {
  parseAttendeesCsv,
  CSV_MAX_BYTES,
  CSV_MAX_ROWS,
  type ParsedAttendee,
} from '@/lib/offline/csv-attendees'

interface CompanyInfo {
  id: string
  name: string
  contact_name: string | null
  contact_email: string | null
  contact_phone: string | null
}

interface Props {
  sessionId: string
  unitPrice: number
  vatIncluded: boolean
  applicantName: string
  applicantEmail: string
  applicantPhone: string
  /** 본인이 협약기업 멤버면 자동 입력. 없으면 null (단체 신청 비활성) */
  company: CompanyInfo | null
  /**
   * P2-4c (2026-05-15): 단체 신청 권한.
   * 회사 매니저 (is_manager=true) 또는 서비스 admin/superadmin/org_admin 만 true.
   * false 면 corporate 옵션 disabled + 안내 (회사 매니저에게 요청).
   */
  canCorporate: boolean
}

type ApplicantType = 'individual' | 'corporate'
type PaymentMethod = 'card' | 'invoice'

interface AttendeeRow {
  name: string
  email: string
  phone: string
  department: string
  position: string
}

function emptyAttendee(): AttendeeRow {
  return { name: '', email: '', phone: '', department: '', position: '' }
}

export function OfflineApplyForm({
  sessionId,
  unitPrice,
  vatIncluded,
  applicantName,
  applicantEmail,
  applicantPhone,
  company,
  canCorporate,
}: Props) {
  const [type, setType] = useState<ApplicantType>('individual')
  const [method, setMethod] = useState<PaymentMethod>('card')
  const [agreed, setAgreed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 단체 — 담당자 (default 회사 contact 또는 본인 정보)
  const [contactName, setContactName] = useState(company?.contact_name ?? applicantName)
  const [contactEmail, setContactEmail] = useState(company?.contact_email ?? applicantEmail)
  const [contactPhone, setContactPhone] = useState(company?.contact_phone ?? applicantPhone)

  // 단체 — 참석자 (default 1명 빈 row)
  const [attendees, setAttendees] = useState<AttendeeRow[]>([emptyAttendee()])

  // P2-4c — 회사 멤버 + 권한 (매니저 / admin) 둘 다 만족해야 단체 신청 가능.
  const corporateAvailable = !!company && canCorporate

  // 단체 신청 시 결제 방식 강제 invoice 권장이지만 카드도 허용
  // (단체 카드 결제도 가능 — 한 번에 합산 금액)
  const attendeeCount = type === 'corporate' ? attendees.length : 1
  const totalAmount = unitPrice * attendeeCount

  function updateAttendee(i: number, patch: Partial<AttendeeRow>) {
    setAttendees((prev) => prev.map((a, idx) => (idx === i ? { ...a, ...patch } : a)))
  }
  function addAttendee() {
    if (attendees.length >= CSV_MAX_ROWS) {
      setError(`참석자는 최대 ${CSV_MAX_ROWS}명까지 입력 가능합니다.`)
      return
    }
    setAttendees((prev) => [...prev, emptyAttendee()])
  }
  function removeAttendee(i: number) {
    setAttendees((prev) => prev.filter((_, idx) => idx !== i))
  }

  async function handleCsvUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)

    if (file.size > CSV_MAX_BYTES) {
      setError(`CSV 파일이 너무 큽니다 (최대 1MB, 현재 ${(file.size / 1024).toFixed(0)}KB).`)
      e.target.value = ''
      return
    }

    try {
      const text = await file.text()
      const result = parseAttendeesCsv(text)
      if (!result.ok) {
        setError(`CSV 파싱 실패: ${result.error}`)
        e.target.value = ''
        return
      }
      // 기존 빈 row 1개 (default) 면 대체, 아니면 append
      setAttendees(toRows(result.rows))
    } catch (err: any) {
      setError(`CSV 읽기 오류: ${err.message ?? 'unknown'}`)
    } finally {
      e.target.value = ''
    }
  }

  function toRows(parsed: ParsedAttendee[]): AttendeeRow[] {
    return parsed.map((p) => ({
      name: p.name,
      email: p.email ?? '',
      phone: p.phone ?? '',
      department: p.department ?? '',
      position: p.position ?? '',
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!agreed) {
      setError('환불 정책 및 안내 사항에 동의해주세요.')
      return
    }

    if (type === 'corporate') {
      if (!corporateAvailable) {
        setError('단체 신청 권한이 없습니다. 운영팀에 문의해주세요.')
        return
      }
      if (!contactName.trim() || !contactEmail.trim() || !contactPhone.trim()) {
        setError('단체 담당자 정보를 모두 입력해주세요.')
        return
      }
      const validAttendees = attendees.filter((a) => a.name.trim())
      if (validAttendees.length === 0) {
        setError('참석자 1명 이상 입력해주세요.')
        return
      }
      if (validAttendees.length > CSV_MAX_ROWS) {
        setError(`참석자는 최대 ${CSV_MAX_ROWS}명까지 가능합니다.`)
        return
      }
    }

    setError(null)
    setSubmitting(true)
    try {
      const body =
        type === 'individual'
          ? { session_id: sessionId, applicant_type: 'individual', payment_method: method }
          : {
              session_id: sessionId,
              applicant_type: 'corporate',
              payment_method: method,
              company_id: company!.id,
              company_contact_name: contactName.trim(),
              company_contact_email: contactEmail.trim(),
              company_contact_phone: contactPhone.trim(),
              attendees: attendees
                .filter((a) => a.name.trim())
                .map((a) => ({
                  name: a.name.trim(),
                  email: a.email.trim() || null,
                  phone: a.phone.trim() || null,
                  department: a.department.trim() || null,
                  position: a.position.trim() || null,
                })),
            }

      const res = await fetch('/api/offline/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || `신청 실패 (HTTP ${res.status})`)
      }
      if (data.redirect_url) {
        // invoice: 입금 안내 페이지 / card: Stripe Checkout
        window.location.href = data.redirect_url
        return
      }
      if (data.url) {
        // 하위호환 (Phase 2)
        window.location.href = data.url
        return
      }
      throw new Error('서버로부터 다음 단계 URL 을 받지 못했습니다.')
    } catch (e: any) {
      setError(e.message ?? '신청 중 오류가 발생했습니다.')
      setSubmitting(false)
    }
  }

  // ─── 렌더 ─────────────────────────────────────────────
  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 신청 유형 */}
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-bold text-navy">신청 유형</h2>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <TypeOption
            checked={type === 'individual'}
            onSelect={() => setType('individual')}
            icon={<User className="h-5 w-5 text-accent" />}
            title="개인 신청"
            description="본인 1명 신청 + 카드 결제"
          />
          <TypeOption
            checked={type === 'corporate'}
            onSelect={() => corporateAvailable && setType('corporate')}
            disabled={!corporateAvailable}
            icon={<Building2 className="h-5 w-5 text-amber-600" />}
            title="기업 단체"
            description={
              corporateAvailable
                ? `${company!.name} — 다수 참석자 + 카드 / 세금계산서`
                : !company
                  ? '협약 기업 매니저에게 문의'
                  : '회사 매니저만 단체 신청 가능 — 매니저에게 요청해주세요'
            }
          />
        </div>
        {company && !canCorporate && (
          <p className="mt-3 rounded-lg bg-amber-50 p-3 text-[11px] leading-relaxed text-amber-700">
            <strong>📢 안내</strong>: <strong>{company.name}</strong> 의 멤버이지만 단체 신청
            권한이 없습니다. 회사 매니저에게 신청을 요청하시거나 운영팀에 문의해주세요.
          </p>
        )}
      </section>

      {/* 개인 — 신청자 정보 */}
      {type === 'individual' && (
        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-bold text-navy">신청자 정보</h2>
          <div className="flex flex-col gap-2 text-sm text-gray-700">
            <Row label="이름" value={applicantName || '(이름 없음)'} />
            <Row label="이메일" value={applicantEmail} />
          </div>
          <p className="mt-3 text-xs text-gray-500">
            정보 수정은 <a href="/my/profile" className="text-accent hover:underline">마이페이지</a> 에서.
          </p>
        </section>
      )}

      {/* 단체 — 회사 + 담당자 */}
      {type === 'corporate' && corporateAvailable && (
        <>
          <section className="rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-bold text-navy">소속 기업</h2>
            <p className="text-sm font-medium text-navy">{company!.name}</p>
            <p className="mt-1 text-xs text-gray-500">
              본인 계정에 등록된 협약 기업입니다.
            </p>
          </section>

          <section className="rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-bold text-navy">담당자 (수신처)</h2>
            <p className="mb-3 text-xs text-gray-500">
              신청 접수 / 입금 안내 / 자리 확정 알림이 이 담당자에게 발송됩니다.
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <LabeledInput
                label="이름 *"
                value={contactName}
                onChange={setContactName}
                required
              />
              <LabeledInput
                label="이메일 *"
                type="email"
                value={contactEmail}
                onChange={setContactEmail}
                required
              />
              <LabeledInput
                label="전화 *"
                type="tel"
                value={contactPhone}
                onChange={setContactPhone}
                required
              />
            </div>
          </section>

          <section className="rounded-2xl bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-start justify-between gap-2">
              <div>
                <h2 className="text-sm font-bold text-navy">참석자 명단</h2>
                <p className="mt-1 text-xs text-gray-500">
                  현재 <strong>{attendees.filter((a) => a.name.trim()).length}명</strong> 입력 (최대 {CSV_MAX_ROWS}명)
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:border-accent hover:text-accent"
                >
                  <Upload className="h-3.5 w-3.5" /> CSV 업로드
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={handleCsvUpload}
                />
                <button
                  type="button"
                  onClick={addAttendee}
                  className="inline-flex items-center gap-1 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-light"
                >
                  <Plus className="h-3.5 w-3.5" /> 추가
                </button>
              </div>
            </div>

            <div className="mb-3 rounded-lg bg-blue-50 px-3 py-2 text-[11px] text-blue-700">
              📋 <strong>CSV 형식</strong>: 첫 행 헤더 <code className="font-mono">name, email, phone, department, position</code> (또는 이름, 이메일, 전화, 부서, 직책). 최대 1MB / {CSV_MAX_ROWS}행.
            </div>

            <div className="flex flex-col gap-2">
              {attendees.map((a, i) => (
                <div key={i} className="grid grid-cols-1 gap-2 rounded-lg border border-gray-100 p-3 sm:grid-cols-[1fr_1.5fr_1fr_1fr_1fr_auto]">
                  <input
                    className="rounded-md border border-gray-200 px-2 py-1.5 text-sm focus:border-accent focus:outline-none"
                    placeholder="이름 *"
                    value={a.name}
                    onChange={(e) => updateAttendee(i, { name: e.target.value })}
                    required
                  />
                  <input
                    className="rounded-md border border-gray-200 px-2 py-1.5 text-sm focus:border-accent focus:outline-none"
                    placeholder="이메일"
                    type="email"
                    value={a.email}
                    onChange={(e) => updateAttendee(i, { email: e.target.value })}
                  />
                  <input
                    className="rounded-md border border-gray-200 px-2 py-1.5 text-sm focus:border-accent focus:outline-none"
                    placeholder="전화"
                    value={a.phone}
                    onChange={(e) => updateAttendee(i, { phone: e.target.value })}
                  />
                  <input
                    className="rounded-md border border-gray-200 px-2 py-1.5 text-sm focus:border-accent focus:outline-none"
                    placeholder="부서"
                    value={a.department}
                    onChange={(e) => updateAttendee(i, { department: e.target.value })}
                  />
                  <input
                    className="rounded-md border border-gray-200 px-2 py-1.5 text-sm focus:border-accent focus:outline-none"
                    placeholder="직책"
                    value={a.position}
                    onChange={(e) => updateAttendee(i, { position: e.target.value })}
                  />
                  <button
                    type="button"
                    onClick={() => removeAttendee(i)}
                    disabled={attendees.length === 1}
                    className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-30"
                    aria-label="참석자 삭제"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      {/* 결제 방식 */}
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-bold text-navy">결제 방식</h2>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <PaymentOption
            checked={method === 'card'}
            onSelect={() => setMethod('card')}
            icon={<CreditCard className="h-5 w-5 text-accent" />}
            title="카드 결제"
            description="Stripe — 즉시 결제 후 자리 확정"
          />
          <PaymentOption
            checked={method === 'invoice'}
            onSelect={() => type === 'corporate' && setMethod('invoice')}
            disabled={type !== 'corporate'}
            icon={<Receipt className="h-5 w-5 text-amber-600" />}
            title="세금계산서"
            description={
              type === 'corporate'
                ? '입금 안내 → 관리자 확인 후 자리 확정'
                : '기업 단체 신청만 가능'
            }
          />
        </div>
      </section>

      {/* 결제 금액 */}
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-bold text-navy">결제 금액</h2>
        {type === 'corporate' && (
          <div className="mb-2 flex items-center justify-between text-xs text-gray-600">
            <span>1인당 {unitPrice.toLocaleString()}원 × {attendeeCount}명</span>
          </div>
        )}
        <div className="flex items-baseline justify-between border-t border-gray-100 pt-3 text-navy">
          <span className="text-sm font-medium">총 결제 금액</span>
          <span className="text-xl font-bold">
            {totalAmount.toLocaleString()}원
            {!vatIncluded && (
              <span className="ml-1 text-xs font-normal text-gray-500">(VAT 별도)</span>
            )}
          </span>
        </div>
      </section>

      {/* 동의 */}
      <section className="rounded-2xl bg-amber-50 p-5">
        <label className="flex items-start gap-3 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-1 h-4 w-4 accent-accent"
          />
          <span>
            <strong>환불 정책 및 안내 사항에 동의합니다.</strong>
            <br />
            <span className="text-xs text-gray-600">
              · 강좌 시작 7일 전까지 100% 환불, 3~6일 전 50%, 2일 이내 환불 불가 (회차별 정책 우선).
              <br />
              · 정원 초과 발생 시 자동 환불 처리됩니다.
              <br />
              · 카드 결제는 즉시 자리 확정 / 세금계산서는 관리자 입금 확인 후 자리 확정.
            </span>
          </span>
        </label>
      </section>

      <button
        type="submit"
        disabled={submitting || !agreed}
        className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-white transition hover:bg-accent-light disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            처리 중...
          </>
        ) : method === 'card' ? (
          <>
            <CreditCard className="h-4 w-4" />
            {totalAmount.toLocaleString()}원 결제하고 신청 완료
          </>
        ) : (
          <>
            <Receipt className="h-4 w-4" />
            세금계산서 신청 접수 ({totalAmount.toLocaleString()}원)
          </>
        )}
      </button>
    </form>
  )
}

// ─── 서브 컴포넌트 ─────────────────────────────────────

function TypeOption({
  checked, onSelect, disabled, icon, title, description,
}: {
  checked: boolean
  onSelect: () => void
  disabled?: boolean
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <label
      className={`flex cursor-pointer items-center gap-3 rounded-xl border p-4 transition ${
        disabled
          ? 'cursor-not-allowed border-gray-200 bg-gray-50 opacity-60'
          : checked
          ? 'border-accent bg-accent-pale/40'
          : 'border-gray-200 bg-white hover:border-accent/40'
      }`}
    >
      <input
        type="radio"
        checked={checked}
        onChange={onSelect}
        disabled={disabled}
        className="h-4 w-4 accent-accent"
      />
      {icon}
      <div className="flex-1">
        <p className={`text-sm font-medium ${disabled ? 'text-gray-500' : 'text-navy'}`}>{title}</p>
        <p className={`text-[11px] ${disabled ? 'text-gray-400' : 'text-gray-500'}`}>{description}</p>
      </div>
      {checked && !disabled && <CheckCircle2 className="h-4 w-4 text-accent" />}
    </label>
  )
}

function PaymentOption(props: Parameters<typeof TypeOption>[0]) {
  return <TypeOption {...props} />
}

function LabeledInput({
  label, value, onChange, type = 'text', required,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  required?: boolean
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-gray-600">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-accent focus:outline-none"
      />
    </label>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex">
      <span className="w-20 shrink-0 text-gray-500">{label}</span>
      <span className="font-medium text-navy">{value}</span>
    </div>
  )
}
