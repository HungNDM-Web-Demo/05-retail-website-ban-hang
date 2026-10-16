'use client'

import { useEffect, useRef } from 'react'
import JsBarcode from 'jsbarcode'

/** Mã vạch Code 128 vẽ vào <svg> bằng `jsbarcode` (07 §4.7), chữ đen nền trắng */
export function Barcode({ value, height = 40, className }: { value: string; height?: number; className?: string }) {
  const ref = useRef<SVGSVGElement>(null)
  useEffect(() => {
    if (!ref.current || !value) return
    try {
      JsBarcode(ref.current, value, {
        format: 'CODE128',
        height,
        width: 1.6,
        margin: 0,
        displayValue: true,
        fontSize: 13,
        textMargin: 2,
        lineColor: '#000000',
        background: '#ffffff',
      })
    } catch {
      // Giá trị không hợp lệ: để trống, chữ mã vẫn hiện bên cạnh
    }
  }, [value, height])
  return <svg ref={ref} role="img" aria-label={`Mã vạch ${value}`} className={className} />
}
