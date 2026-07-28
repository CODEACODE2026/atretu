import type { CollectionCaseDetail } from "../../../../lib/api";
import { collectionAgingBucketLabel } from "../../collection-formatters";
import { CollectionPriorityBadge } from "./collection-priority-badge";
import { CollectionStatusBadge } from "./collection-status-badge";
import {
  formatCollectionDate,
  formatOutstanding,
} from "./collection-display-utils";

export function CollectionDetailsHeader({
  caseDetail,
}: {
  caseDetail: CollectionCaseDetail;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap gap-2">
            <CollectionPriorityBadge priority={caseDetail.priority} />
            <CollectionStatusBadge status={caseDetail.operationalStatus} />
          </div>
          <h3 className="mt-3 break-words text-lg font-semibold text-slate-950">
            {caseDetail.student.person.fullName}
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            {caseDetail.enrollment.institution.name} -{" "}
            {caseDetail.enrollment.academicYear.year}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {caseDetail.enrollment.course} / {caseDetail.enrollment.grade}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:min-w-[440px]">
          <Metric label="Pendente" value={formatOutstanding(caseDetail)} />
          <Metric label="Atraso" value={`${caseDetail.daysOverdue} dia(s)`} />
          <Metric
            label="Faixa"
            value={collectionAgingBucketLabel(caseDetail.agingBucket)}
          />
          <Metric label="Vencimento" value={formatCollectionDate(caseDetail.dueDate)} />
        </div>
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
      <p className="text-[11px] font-medium uppercase text-slate-500">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold text-slate-950">
        {value}
      </p>
    </div>
  );
}
