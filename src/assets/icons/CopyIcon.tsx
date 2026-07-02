import type { ComponentProps } from 'react'
import { Copy } from 'lucide-react'

export function CopyIcon(props: ComponentProps<typeof Copy>) {
  return <Copy aria-hidden="true" {...props} />
}
