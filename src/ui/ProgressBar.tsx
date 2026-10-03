import type { Progress } from '../core/types'

const MB = 1024 * 1024

export function progressLabel(p: Progress): string {
  switch (p.phase) {
    case 'download':
      return `Downloading model ${Math.round(p.done / MB)}/${Math.round(p.total / MB)} MB`
    case 'session':
    case 'pre':
      return 'Preparing'
    case 'run':
      return 'Running'
    case 'post':
      return 'Finishing'
  }
}

export function ProgressBar({ progress }: { progress: Progress }) {
  const fraction = progress.phase === 'download' && progress.total > 0 ? progress.done / progress.total : 1
  return (
    <div className="progress" data-testid="progress" role="status">
      {progressLabel(progress)}
      <div className="bar">
        <i style={{ width: `${Math.round(fraction * 100)}%` }} />
      </div>
    </div>
  )
}
