import { useEffect, useState } from "react";
import {
  CalendarDays,
  CheckCircle,
  FileText,
  MapPin,
  Star,
  UserRound,
  XCircle,
} from "lucide-react";

import { approveReport, getAuthorityReports, rejectReport } from "../../api/authority";
import AdminLayout from "../../components/AdminLayout";
import AdminPagination from "../../components/AdminPagination";
import Button from "../../components/Button";
import CharacterCounter from "../../components/CharacterCounter";
import ConfirmDialog from "../../components/ConfirmDialog";
import FeedbackMessage from "../../components/FeedbackMessage";
import StatusPill from "../../components/StatusPill";
import FloodGuardMap from "../../components/map/FloodGuardMap";
import { isWithinNepalOperationalBounds } from "../../components/map/mapUtils";
import { formatKathmanduDate } from "../../utils/time";
import { backendError } from "../../utils/validation";

const PAGE_SIZE = 6;
const statuses = ["pending", "approved", "rejected"];

const statusContent = {
  pending: {
    label: "Pending",
    heading: "Reports awaiting review",
    description: "Review submitted reports and decide whether they should be published to the community.",
    empty: "There are no reports waiting for review.",
  },
  approved: {
    label: "Approved",
    heading: "Approved reports",
    description: "These verified reports are ready to appear in the community feed.",
    empty: "No reports have been approved yet.",
  },
  rejected: {
    label: "Rejected",
    heading: "Rejected reports",
    description: "Review reports that were declined and the reason recorded for each decision.",
    empty: "No reports have been rejected.",
  },
};

function formatDate(value) {
  return value ? formatKathmanduDate(value) : "-";
}

function reportHasNepalLocation(report) {
  return isWithinNepalOperationalBounds(report.latitude, report.longitude);
}

function SeverityStars({ severity }) {
  const rating = Math.min(5, Math.max(0, Number(severity) || 0));

  return (
    <div className="flex gap-0.5" aria-label={`Severity ${rating} out of 5`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          size={16}
          strokeWidth={2.25}
          fill={star <= rating ? "currentColor" : "none"}
          className={star <= rating ? "text-amber-400" : "text-slate-200"}
          aria-hidden="true"
        />
      ))}
    </div>
  );
}

function ReportCard({ report, processingId, onApprove, onReject, onViewMap }) {
  const isPending = report.status === "pending";
  const isApproved = report.status === "approved";
  const isRejected = report.status === "rejected";
  const isProcessing = processingId === report.id;
  const hasLocation = reportHasNepalLocation(report);
  const location = [report.province || "Legacy report", report.district].filter(Boolean).join(" · ");

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className={`h-1 ${isApproved ? "bg-emerald-500" : isRejected ? "bg-red-500" : "bg-blue-500"}`} />
      <div className="p-5 sm:p-6">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Report #{report.id}</p>
            <h3 className="mt-1 break-words text-lg font-black text-slate-950">{location || "Incident report"}</h3>
          </div>
          <StatusPill status={report.status} />
        </header>

        <div className="mt-5 grid min-w-0 gap-5 md:grid-cols-[10rem_minmax(0,1fr)]">
          <div className="min-w-0">
            {report.image_url ? (
              <img
                src={report.image_url}
                alt={`Photo submitted with report ${report.id}`}
                className="aspect-[4/3] w-full rounded-xl border border-slate-200 object-cover"
              />
            ) : (
              <div className="flex aspect-[4/3] w-full items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-center text-xs font-semibold text-slate-500">
                <span className="flex flex-col items-center gap-2"><FileText size={20} aria-hidden="true" />No photo provided</span>
              </div>
            )}
            <Button
              variant="outline"
              onClick={() => onViewMap(report)}
              disabled={!hasLocation}
              className="mt-3 w-full px-2 py-2 text-xs"
              title={hasLocation ? "View this report on the map" : "This report has no valid Nepal map coordinates"}
            >
              <MapPin size={15} aria-hidden="true" />
              View map
            </Button>
            {!hasLocation ? <p className="mt-2 text-center text-xs leading-5 text-red-600">Map location unavailable</p> : null}
          </div>

          <div className="min-w-0">
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div className="min-w-0 rounded-xl bg-slate-50 px-3 py-2.5">
                <dt className="flex items-center gap-1.5 text-xs font-semibold text-slate-500"><MapPin size={14} aria-hidden="true" />Zone</dt>
                <dd className="mt-1 break-words font-semibold text-slate-800">{report.zone_name || "No FloodGuard zone selected"}</dd>
              </div>
              <div className="min-w-0 rounded-xl bg-slate-50 px-3 py-2.5">
                <dt className="flex items-center gap-1.5 text-xs font-semibold text-slate-500"><UserRound size={14} aria-hidden="true" />Submitted by</dt>
                <dd className="mt-1 break-words font-semibold text-slate-800">{report.submitted_by}</dd>
              </div>
              <div className="rounded-xl bg-slate-50 px-3 py-2.5">
                <dt className="text-xs font-semibold text-slate-500">Severity</dt>
                <dd className="mt-1"><SeverityStars severity={report.severity} /></dd>
              </div>
              <div className="rounded-xl bg-slate-50 px-3 py-2.5">
                <dt className="flex items-center gap-1.5 text-xs font-semibold text-slate-500"><CalendarDays size={14} aria-hidden="true" />Submitted</dt>
                <dd className="mt-1 font-semibold text-slate-800">{formatDate(report.created_at)}</dd>
              </div>
            </dl>

            <p className="mt-4 break-words text-sm leading-6 text-slate-700">{report.description || "No description was provided with this report."}</p>

            {isApproved ? (
              <div className="mt-4 flex items-start gap-3 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                <CheckCircle className="mt-0.5 shrink-0 text-emerald-600" size={18} aria-hidden="true" />
                <div><p className="font-bold">Approved for the community feed</p><p className="mt-0.5 text-emerald-800">This report is now available as a verified community report.</p></div>
              </div>
            ) : null}

            {isRejected ? (
              <div className="mt-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-900">
                <p className="flex items-center gap-2 font-bold"><XCircle size={17} aria-hidden="true" />Rejection reason</p>
                <p className="mt-1.5 break-words leading-6 text-red-800">{report.rejection_reason || "No reason was recorded."}</p>
              </div>
            ) : null}

            {isPending ? (
              <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900">
                <p className="font-bold">Ready for authority review</p>
                <p className="mt-0.5 text-blue-800">Approve to publish it to the community feed, or reject it with a reason.</p>
              </div>
            ) : null}
          </div>
        </div>

        {isPending ? (
          <footer className="mt-5 flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-500">This decision is final for the current report.</p>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => onApprove(report.id)} isLoading={isProcessing} loadingLabel="Approving..." variant="success" className="min-w-[8rem]">
                <CheckCircle size={17} aria-hidden="true" />
                Approve
              </Button>
              <Button onClick={() => onReject(report)} disabled={isProcessing} variant="danger">
                <XCircle size={17} aria-hidden="true" />
                Reject
              </Button>
            </div>
          </footer>
        ) : null}
      </div>
    </article>
  );
}

export default function ManageReports() {
  const [reports, setReports] = useState([]);
  const [statusFilter, setStatusFilter] = useState("pending");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalReports, setTotalReports] = useState(0);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [rejectingReport, setRejectingReport] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [rejectionError, setRejectionError] = useState("");
  const [selectedReport, setSelectedReport] = useState(null);

  const totalPages = Math.max(1, Math.ceil(totalReports / PAGE_SIZE));
  const currentStatus = statusContent[statusFilter];

  async function loadReports() {
    setIsLoading(true);
    setError("");

    try {
      const data = await getAuthorityReports({
        status: statusFilter,
        page: currentPage,
        limit: PAGE_SIZE,
      });
      setReports(data.items);
      setTotalReports(data.total);
    } catch (err) {
      setReports([]);
      setTotalReports(0);
      setError(err.response?.data?.detail || "Could not load reports.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadReports();
  }, [statusFilter, currentPage]);

  function switchStatus(status) {
    if (status === statusFilter) return;
    setStatusFilter(status);
    setCurrentPage(1);
    setSelectedReport(null);
    setError("");
    setMessage("");
  }

  async function handleApprove(reportId) {
    const report = reports.find((item) => item.id === reportId);
    if (!report || report.status !== "pending" || processingId) return;

    setProcessingId(reportId);
    setError("");
    setMessage("");

    try {
      await approveReport(reportId);
      setSelectedReport(null);
      setStatusFilter("approved");
      setCurrentPage(1);
      setMessage(`Report #${reportId} was approved and is now shown in Approved reports.`);
    } catch (err) {
      setError(err.response?.data?.detail || "Could not approve report.");
    } finally {
      setProcessingId(null);
    }
  }

  function requestReject(report) {
    setError("");
    setMessage("");
    setRejectionReason("");
    setRejectionError("");
    setRejectingReport(report);
  }

  async function confirmReject() {
    if (!rejectingReport) return;
    const reason = rejectionReason.trim();
    if (reason.length < 3 || reason.length > 1000) {
      setRejectionError("Rejection reason must be between 3 and 1000 characters.");
      return;
    }

    setProcessingId(rejectingReport.id);
    setError("");
    setMessage("");
    setRejectionError("");

    try {
      await rejectReport(rejectingReport.id, reason);
      const reportId = rejectingReport.id;
      setRejectingReport(null);
      setRejectionReason("");
      setSelectedReport(null);
      setStatusFilter("rejected");
      setCurrentPage(1);
      setMessage(`Report #${reportId} was rejected and is now shown in Rejected reports.`);
    } catch (err) {
      setError(backendError(err, "Could not reject report."));
    } finally {
      setProcessingId(null);
    }
  }

  return (
    <AdminLayout title="Manage Reports">
      <section className="space-y-6 pb-4">
        <header className="flex flex-col gap-5 rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-cyan-50 p-5 sm:p-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">Authority workspace</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">Review Incident Reports</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">Review community flood reports, check their location, and publish only verified information.</p>
          </div>
          <div className="grid w-full grid-cols-3 rounded-xl border border-blue-100 bg-white p-1 shadow-sm lg:w-auto" aria-label="Report status filter">
            {statuses.map((status) => {
              const isActive = statusFilter === status;
              return (
                <button
                  key={status}
                  type="button"
                  onClick={() => switchStatus(status)}
                  aria-pressed={isActive}
                  className={`min-w-0 rounded-lg px-2 py-2.5 text-sm font-bold transition sm:px-4 ${isActive ? "bg-blue-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"}`}
                >
                  <span className="block truncate">{statusContent[status].label}</span>
                </button>
              );
            })}
          </div>
        </header>

        <FeedbackMessage message={error} onDismiss={() => setError("")} />
        <FeedbackMessage message={message} type="success" onDismiss={() => setMessage("")} />
        {error && !isLoading ? <Button variant="secondary" onClick={loadReports}>Try again</Button> : null}

        {selectedReport ? (
          <section className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm" aria-labelledby="report-map-heading">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-blue-700">Report location</p>
                <h2 id="report-map-heading" className="mt-1 text-lg font-black text-slate-950">Report #{selectedReport.id} on the map</h2>
                <p className="mt-1 text-sm text-slate-600">{selectedReport.province || "Legacy report"} · {selectedReport.district}</p>
              </div>
              <button type="button" onClick={() => setSelectedReport(null)} className="rounded-lg px-2 py-1 text-sm font-bold text-slate-600 hover:bg-slate-100 hover:text-slate-950">Close map</button>
            </div>
            <FloodGuardMap
              reports={[selectedReport]}
              center={[Number(selectedReport.latitude), Number(selectedReport.longitude)]}
              focusPosition={[Number(selectedReport.latitude), Number(selectedReport.longitude)]}
              showStations={false}
              showZones={false}
              showAlerts={false}
              className="h-[320px]"
            />
          </section>
        ) : null}

        <section aria-labelledby="report-list-heading">
          <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.14em] text-blue-700">{currentStatus.label} reports</p>
              <h2 id="report-list-heading" className="mt-1 text-2xl font-black tracking-tight text-slate-950">{currentStatus.heading}</h2>
            </div>
            {!isLoading ? <p className="text-sm text-slate-500">{totalReports} {totalReports === 1 ? "report" : "reports"}</p> : null}
          </div>
          <p className="mb-5 max-w-3xl text-sm leading-6 text-slate-600">{currentStatus.description}</p>

          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((item) => <div key={item} className="animate-pulse rounded-2xl border border-slate-200 bg-white p-6"><div className="h-5 w-28 rounded bg-slate-200" /><div className="mt-5 grid gap-5 md:grid-cols-[10rem_minmax(0,1fr)]"><div className="aspect-[4/3] rounded-xl bg-slate-100" /><div><div className="h-5 w-40 rounded bg-slate-200" /><div className="mt-4 grid gap-3 sm:grid-cols-2"><div className="h-16 rounded-xl bg-slate-100" /><div className="h-16 rounded-xl bg-slate-100" /></div><div className="mt-4 h-12 rounded bg-slate-100" /></div></div></div>)}
            </div>
          ) : reports.length > 0 ? (
            <div className="space-y-4">
              {reports.map((report) => <ReportCard key={report.id} report={report} processingId={processingId} onApprove={handleApprove} onReject={requestReject} onViewMap={setSelectedReport} />)}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center shadow-sm">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400"><FileText size={24} aria-hidden="true" /></div>
              <h3 className="mt-4 text-lg font-bold text-slate-950">No reports found</h3>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">{currentStatus.empty}</p>
            </div>
          )}

          {totalReports > PAGE_SIZE ? (
            <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <AdminPagination currentPage={currentPage} totalPages={totalPages} totalItems={totalReports} pageSize={PAGE_SIZE} onPageChange={setCurrentPage} />
            </div>
          ) : null}
        </section>
      </section>

      <ConfirmDialog
        open={Boolean(rejectingReport)}
        title="Reject report?"
        description={rejectingReport ? `Provide a reason before rejecting report #${rejectingReport.id}.` : ""}
        confirmLabel="Reject report"
        confirmingLabel="Rejecting..."
        onCancel={() => {
          setRejectingReport(null);
          setRejectionError("");
        }}
        onConfirm={confirmReject}
        isConfirming={processingId === rejectingReport?.id}
        danger
      >
        <label className="block text-sm font-semibold text-ink-primary">
          Rejection reason
          <textarea
            value={rejectionReason}
            onChange={(event) => {
              setRejectionReason(event.target.value);
              setRejectionError("");
            }}
            maxLength={1000}
            rows={4}
            className="mt-2 w-full rounded-lg border border-ink-border px-3 py-2.5 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
            placeholder="Explain why this report is being rejected."
          />
          <CharacterCounter value={rejectionReason} maxLength={1000} minLength={3} />
          {rejectionError ? <p className="mt-2 text-xs font-medium text-red-700" role="alert">{rejectionError}</p> : null}
        </label>
      </ConfirmDialog>
    </AdminLayout>
  );
}
