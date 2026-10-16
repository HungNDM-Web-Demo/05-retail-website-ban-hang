'use client'

import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { SizeChart } from '@/types/shop'

const EMPTY: SizeChart = { title: 'Bảng size', columns: ['Size', 'Ngực (cm)', 'Dài (cm)'], rows: [] }

/** Bảng size (FR-17): tiêu đề, cột, dòng nhập tay; để trống thì không lưu */
export function SizeChartEditor({
  value,
  onChange,
  sizes,
  readOnly,
}: {
  value?: SizeChart
  onChange: (v: SizeChart | undefined) => void
  sizes: string[]
  readOnly?: boolean
}) {
  if (!value) {
    if (readOnly) return <p className="text-muted-foreground text-sm">Chưa có bảng size.</p>
    return (
      <Button
        type="button"
        variant="outline"
        onClick={() => onChange({ ...EMPTY, rows: (sizes.length ? sizes : ['']).map((s) => [s, '', '']) })}
      >
        <Plus aria-hidden="true" />
        Thêm bảng size
      </Button>
    )
  }
  const set = (patch: Partial<SizeChart>) => onChange({ ...value, ...patch })
  const setCell = (r: number, c: number, v: string) => set({ rows: value.rows.map((row, i) => (i === r ? row.map((x, j) => (j === c ? v : x)) : row)) })
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input value={value.title} onChange={(e) => set({ title: e.target.value })} aria-label="Tiêu đề bảng size" className="max-w-xs" disabled={readOnly} />
        {!readOnly && (
          <>
            <Button type="button" size="sm" variant="outline" onClick={() => set({ columns: [...value.columns, ''], rows: value.rows.map((r) => [...r, '']) })}>
              <Plus aria-hidden="true" />
              Cột
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => set({ rows: [...value.rows, value.columns.map(() => '')] })}>
              <Plus aria-hidden="true" />
              Dòng
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => onChange(undefined)}>
              <Trash2 aria-hidden="true" />
              Bỏ bảng size
            </Button>
          </>
        )}
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              {value.columns.map((c, j) => (
                <th key={j} className="p-1.5">
                  <div className="flex items-center gap-1">
                    <Input
                      value={c}
                      disabled={readOnly}
                      aria-label={`Tên cột ${j + 1}`}
                      onChange={(e) => set({ columns: value.columns.map((x, k) => (k === j ? e.target.value : x)) })}
                      className="h-8 font-semibold"
                    />
                    {!readOnly && value.columns.length > 1 && (
                      <Button
                        type="button"
                        size="icon-xs"
                        variant="ghost"
                        aria-label={`Bỏ cột ${j + 1}`}
                        onClick={() => set({ columns: value.columns.filter((_, k) => k !== j), rows: value.rows.map((r) => r.filter((_, k) => k !== j)) })}
                      >
                        <Trash2 aria-hidden="true" />
                      </Button>
                    )}
                  </div>
                </th>
              ))}
              {!readOnly && <th className="w-8" />}
            </tr>
          </thead>
          <tbody>
            {value.rows.map((row, i) => (
              <tr key={i} className="border-t">
                {row.map((cell, j) => (
                  <td key={j} className="p-1.5">
                    <Input value={cell} disabled={readOnly} aria-label={`Dòng ${i + 1} cột ${j + 1}`} onChange={(e) => setCell(i, j, e.target.value)} className="h-8" />
                  </td>
                ))}
                {!readOnly && (
                  <td className="p-1.5">
                    <Button type="button" size="icon-xs" variant="ghost" aria-label={`Bỏ dòng ${i + 1}`} onClick={() => set({ rows: value.rows.filter((_, k) => k !== i) })}>
                      <Trash2 aria-hidden="true" />
                    </Button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
