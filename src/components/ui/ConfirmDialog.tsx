'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'

interface ConfirmOptions {
  title?: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'default' | 'danger'
}

interface State extends ConfirmOptions {
  resolve: (ok: boolean) => void
}

/**
 * 전역 confirm() 대체용. window.confirm() 보다 일관된 디자인 + 비동기 호출.
 *
 * 사용:
 *   import { useConfirm } from '@/components/ui/ConfirmDialog'
 *
 *   function MyComp() {
 *     const confirm = useConfirm()
 *     const handle = async () => {
 *       const ok = await confirm({
 *         title: '삭제하시겠습니까?',
 *         message: '되돌릴 수 없습니다.',
 *         variant: 'danger',
 *       })
 *       if (!ok) return
 *       // 진행
 *     }
 *   }
 *
 * 그리고 앱 어딘가(레이아웃)에 <ConfirmDialogHost /> 한 번만 마운트.
 */

let externalShow: ((opts: ConfirmOptions) => Promise<boolean>) | null = null

export function useConfirm() {
  return (opts: ConfirmOptions): Promise<boolean> => {
    if (!externalShow) {
      // host 가 마운트 안 되어있을 때 fallback → 브라우저 confirm
      return Promise.resolve(window.confirm(opts.message))
    }
    return externalShow(opts)
  }
}

export function ConfirmDialogHost() {
  const [state, setState] = useState<State | null>(null)

  useEffect(() => {
    externalShow = (opts) =>
      new Promise<boolean>((resolve) => {
        setState({ ...opts, resolve })
      })
    return () => { externalShow = null }
  }, [])

  if (!state) return null

  const close = (ok: boolean) => {
    state.resolve(ok)
    setState(null)
  }

  const confirmLabel = state.confirmLabel ?? '확인'
  const cancelLabel = state.cancelLabel ?? '취소'
  const isDanger = state.variant === 'danger'

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 px-4"
      role="dialog"
      aria-modal="true"
      onClick={() => close(false)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl bg-white shadow-xl"
      >
        <div className="px-6 pt-6 pb-4">
          {state.title && (
            <div className="mb-3 flex items-center gap-2.5">
              {isDanger && (
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-red-50">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                </span>
              )}
              <h3 className="text-base font-semibold text-[#0B1F3A]">
                {state.title}
              </h3>
            </div>
          )}
          <p className="text-sm leading-relaxed text-gray-600 whitespace-pre-line">
            {state.message}
          </p>
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-100 px-4 py-3 bg-gray-50 rounded-b-2xl">
          <button
            onClick={() => close(false)}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 transition"
          >
            {cancelLabel}
          </button>
          <button
            onClick={() => close(true)}
            className={`rounded-lg px-4 py-2 text-sm font-medium text-white transition ${
              isDanger
                ? 'bg-red-500 hover:bg-red-600'
                : 'bg-[#2D7DD2] hover:bg-[#2566b0]'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
