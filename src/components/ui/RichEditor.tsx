'use client'

/**
 * 공용 WYSIWYG 에디터 — TipTap 기반.
 *
 * 사용:
 *   <RichEditor value={html} onChange={setHtml} placeholder="..." />
 *
 * 출력: HTML 문자열. 저장 전 그대로 DB 에 저장하고, 렌더 시 sanitize.
 *
 * 지원 포맷 (StarterKit + Link + Image + Placeholder):
 *   - heading h2/h3, paragraph
 *   - bold / italic / strike / code (인라인)
 *   - bullet/ordered list, blockquote, code block
 *   - link (URL 입력 prompt)
 *   - image (URL 입력 prompt — 미디어 라이브러리 통합은 별도 라운드)
 *   - undo / redo
 *
 * 보안:
 *   - admin role 만 작성 가능 (호출 측 책임).
 *   - 렌더 시 'sanitizeHtml' 로 XSS 방어.
 */
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'
import {
  Bold, Italic, Strikethrough, Heading2, Heading3, List, ListOrdered,
  Quote, Code, Code2, Link2, Image as ImageIcon, Undo2, Redo2, Minus,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  className?: string
  /** false 시 toolbar 만 노출 안 함 (보기 전용 like). 기본 true */
  editable?: boolean
}

export function RichEditor({ value, onChange, placeholder, className, editable = true }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: 'text-accent underline' },
      }),
      Image.configure({
        HTMLAttributes: { class: 'rounded-md max-w-full' },
      }),
      Placeholder.configure({ placeholder: placeholder ?? '내용을 입력하세요...' }),
    ],
    content: value || '',
    editable,
    immediatelyRender: false,    // SSR 안전
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class:
          'prose prose-sm max-w-none min-h-[200px] px-3 py-2 focus:outline-none ' +
          '[&_h2]:text-h3 [&_h2]:mt-6 [&_h2]:mb-3 [&_h2]:text-navy ' +
          '[&_h3]:text-h4 [&_h3]:mt-5 [&_h3]:mb-2 [&_h3]:text-navy ' +
          '[&_p]:my-2 [&_p]:leading-relaxed ' +
          '[&_ul]:list-disc [&_ul]:pl-6 [&_ul]:my-2 ' +
          '[&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:my-2 ' +
          '[&_blockquote]:border-l-4 [&_blockquote]:border-accent/30 [&_blockquote]:pl-4 [&_blockquote]:italic ' +
          '[&_code]:rounded [&_code]:bg-surface-muted [&_code]:px-1 [&_code]:text-caption ' +
          '[&_pre]:rounded-md [&_pre]:bg-navy [&_pre]:p-3 [&_pre]:text-white [&_pre]:overflow-x-auto ' +
          '[&_a]:text-accent [&_a]:underline ' +
          '[&_hr]:my-4 [&_hr]:border-border-subtle',
      },
    },
  })

  if (!editor) return null

  const promptUrl = (current?: string) =>
    typeof window !== 'undefined' ? window.prompt('URL', current ?? '') : null

  const setLink = () => {
    const prev = editor.getAttributes('link').href as string | undefined
    const url = promptUrl(prev)
    if (url === null) return
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url, target: '_blank' }).run()
  }

  const insertImage = () => {
    const url = promptUrl()
    if (url) editor.chain().focus().setImage({ src: url, alt: '' }).run()
  }

  return (
    <div className={cn('rounded-md border border-border-subtle bg-surface', className)}>
      {editable && (
        <div className="flex flex-wrap items-center gap-0.5 border-b border-border-subtle bg-surface-subtle px-2 py-1.5">
          <ToolBtn active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} title="대제목"><Heading2 className="h-4 w-4" /></ToolBtn>
          <ToolBtn active={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} title="중제목"><Heading3 className="h-4 w-4" /></ToolBtn>
          <Sep />
          <ToolBtn active={editor.isActive('bold')}      onClick={() => editor.chain().focus().toggleBold().run()}      title="굵게"><Bold className="h-4 w-4" /></ToolBtn>
          <ToolBtn active={editor.isActive('italic')}    onClick={() => editor.chain().focus().toggleItalic().run()}    title="기울임"><Italic className="h-4 w-4" /></ToolBtn>
          <ToolBtn active={editor.isActive('strike')}    onClick={() => editor.chain().focus().toggleStrike().run()}    title="취소선"><Strikethrough className="h-4 w-4" /></ToolBtn>
          <ToolBtn active={editor.isActive('code')}      onClick={() => editor.chain().focus().toggleCode().run()}      title="인라인 코드"><Code className="h-4 w-4" /></ToolBtn>
          <Sep />
          <ToolBtn active={editor.isActive('bulletList')}  onClick={() => editor.chain().focus().toggleBulletList().run()}  title="불릿"><List className="h-4 w-4" /></ToolBtn>
          <ToolBtn active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="번호"><ListOrdered className="h-4 w-4" /></ToolBtn>
          <ToolBtn active={editor.isActive('blockquote')}  onClick={() => editor.chain().focus().toggleBlockquote().run()}  title="인용"><Quote className="h-4 w-4" /></ToolBtn>
          <ToolBtn active={editor.isActive('codeBlock')}   onClick={() => editor.chain().focus().toggleCodeBlock().run()}   title="코드 블록"><Code2 className="h-4 w-4" /></ToolBtn>
          <Sep />
          <ToolBtn active={editor.isActive('link')} onClick={setLink} title="링크"><Link2 className="h-4 w-4" /></ToolBtn>
          <ToolBtn onClick={insertImage} title="이미지"><ImageIcon className="h-4 w-4" /></ToolBtn>
          <ToolBtn onClick={() => editor.chain().focus().setHorizontalRule().run()} title="구분선"><Minus className="h-4 w-4" /></ToolBtn>
          <Sep />
          <ToolBtn onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="실행 취소"><Undo2 className="h-4 w-4" /></ToolBtn>
          <ToolBtn onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="다시 실행"><Redo2 className="h-4 w-4" /></ToolBtn>
        </div>
      )}
      <EditorContent editor={editor} />
    </div>
  )
}

function ToolBtn({
  children, active, onClick, disabled, title,
}: { children: React.ReactNode; active?: boolean; onClick: () => void; disabled?: boolean; title: string }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'rounded p-1.5 text-gray-600 transition-colors duration-120',
        'hover:bg-surface-muted hover:text-navy',
        'disabled:opacity-30 disabled:hover:bg-transparent',
        active && 'bg-accent-pale text-accent',
      )}
    >
      {children}
    </button>
  )
}

function Sep() {
  return <div className="mx-1 h-5 w-px bg-border-subtle" />
}
