'use client'

import { useState } from 'react'
import { Loader2, Send } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { internalNoteSuggestions } from '@/config/shop-labels'
import { getErrorMessage } from '@/lib/api-error'
import { useOrderAction } from '../hooks/use-orders'

/** Ô ghi chú nội bộ (FR-23): 1–500 ký tự, gợi ý nhanh; không hiện cho khách */
export function InternalNoteBox({ orderId }: { orderId: string }) {
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const add = useOrderAction(orderId, 'addNote')
  const submit = async () => {
    const content = text.trim()
    if (!content || content.length > 500) {
      setError('Nhập ghi chú, tối đa 500 ký tự')
      return
    }
    try {
      await add.mutateAsync({ content })
      setText('')
      setError(null)
      toast.success('Đã lưu ghi chú')
    } catch (e) {
      toast.error(getErrorMessage(e))
    }
  }
  return (
    <div className="space-y-2">
      <label htmlFor="internal-note" className="text-sm font-medium">
        Ghi chú nội bộ
      </label>
      <Textarea
        id="internal-note"
        value={text}
        maxLength={500}
        rows={3}
        aria-invalid={!!error || undefined}
        aria-describedby={error ? 'internal-note-error' : undefined}
        placeholder="Chỉ nhân viên thấy, khách không thấy"
        onChange={(e) => {
          setText(e.target.value)
          if (error) setError(null)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) void submit()
        }}
      />
      {error && (
        <p id="internal-note-error" role="alert" className="text-destructive text-[0.8125rem]">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-1.5">
        {internalNoteSuggestions.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setText(s)}
            className="hover:bg-muted focus-visible:ring-ring/50 rounded-full border px-2.5 py-1 text-xs transition-colors outline-none focus-visible:ring-3"
          >
            {s}
          </button>
        ))}
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-muted-foreground text-xs tabular-nums">{text.length}/500</span>
        <Button size="sm" onClick={submit} disabled={add.isPending}>
          {add.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Send aria-hidden="true" />}
          Lưu ghi chú
        </Button>
      </div>
    </div>
  )
}
