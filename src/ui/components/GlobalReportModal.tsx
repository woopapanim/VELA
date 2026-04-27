import { useStore } from '@/stores';
import { FullReportV2 as FullReport } from '@/ui/reports/vela/FullReportV2';

export function GlobalReportModal() {
  const show = useStore((s) => s.showFullReport);
  const setShow = useStore((s) => s.setShowFullReport);
  if (!show) return null;
  return <FullReport onClose={() => setShow(false)} />;
}
