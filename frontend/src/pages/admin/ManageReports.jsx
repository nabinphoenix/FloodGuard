import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle, XCircle } from "lucide-react";

import { approveReport, getAdminReports, rejectReport } from "../../api/admin";
import StatusPill from "../../components/StatusPill";
import AdminLayout from "../../components/AdminLayout";

const statuses = ["pending", "approved", "rejected"];

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString() : "-";
}

export default function ManageReports() {
  const [reports, setReports] = useState([]);
  const [statusFilter, setStatusFilter] = useState("pending");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [processingId, setProcessingId] = useState(null);

  async function loadReports() {
    setIsLoading(true);
    setError("");

    try {
      const data = await getAdminReports({ status: statusFilter, limit: 50 });
      setReports(data);
    } catch (err) {
      setError(err.response?.data?.detail || "Could not load reports.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadReports();
  }, [statusFilter]);

  async function handleApprove(reportId) {
    setProcessingId(reportId);
    setError("");

    try {
      const updated = await approveReport(reportId);
      setReports((current) => current.map((report) => (report.id === reportId ? updated : report)));
    } catch (err) {
      setError(err.response?.data?.detail || "Could not approve report.");
    } finally {
      setProcessingId(null);
    }
  }

  async function handleReject(reportId) {
    const reason = window.prompt("Enter rejection reason:");
    if (!reason || reason.trim().length < 3) {
      return;
    }

    setProcessingId(reportId);
    setError("");

    try {
      const updated = await rejectReport(reportId, reason.trim());
      setReports((current) => current.map((report) => (report.id === reportId ? updated : report)));
    } catch (err) {
      setError(err.response?.data?.detail || "Could not reject report.");
    } finally {
      setProcessingId(null);
    }
  }

  return (
    <AdminLayout title="Manage Reports">
      <div className="mb-8 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-ink-primary tracking-tight">Review Incident Reports</h1>
          <p className="mt-2 text-ink-secondary">Review incident reports submitted by public users.</p>
        </div>
        
        {/* Filter Tabs */}
        <div className="flex bg-gray-100 p-1 rounded-xl shadow-inner self-start md:self-auto">
          {statuses.map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-6 py-2.5 text-sm font-semibold rounded-lg transition-all ${
                statusFilter === status 
                  ? 'bg-white text-brand shadow-sm' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="mb-8 rounded-lg border border-flood-emergency/20 bg-flood-emergency/10 px-4 py-3 text-sm text-flood-emergency font-medium">
          {error}
        </div>
      )}

      <section className="overflow-hidden rounded-xl border border-ink-border bg-surface-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-ink-border text-sm">
            <thead className="bg-surface-bg text-left text-xs uppercase tracking-wider text-ink-secondary font-semibold">
              <tr>
                <th className="px-6 py-4">ID</th>
                <th className="px-6 py-4">Photo</th>
                <th className="px-6 py-4">District</th>
                <th className="px-6 py-4">Severity</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Submitted By</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-border bg-white">
              {reports.map((report) => (
                <tr key={report.id} className="align-middle hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 font-semibold text-ink-primary whitespace-nowrap">#{report.id}</td>
                  <td className="px-6 py-4">
                    {report.image_url ? (
                      <div className="group relative h-16 w-24 overflow-hidden rounded-lg border border-gray-200 cursor-pointer">
                        <img 
                          src={report.image_url} 
                          alt={`Report ${report.id}`} 
                          className="h-full w-full object-cover transition-transform group-hover:scale-110" 
                        />
                      </div>
                    ) : (
                      <div className="flex h-16 w-24 items-center justify-center rounded-lg bg-gray-100 text-xs text-gray-400 font-medium border border-gray-200 border-dashed">
                        No photo
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 font-medium whitespace-nowrap">{report.district}</td>
                  <td className="px-6 py-4">
                    <div className="flex gap-1 text-yellow-400 text-lg">
                      {"★".repeat(report.severity)}
                      <span className="text-gray-200">{"★".repeat(5 - report.severity)}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <StatusPill status={report.status} />
                  </td>
                  <td className="px-6 py-4 text-ink-secondary whitespace-nowrap">{report.submitted_by}</td>
                  <td className="px-6 py-4 text-ink-secondary whitespace-nowrap">{formatDate(report.created_at)}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => handleApprove(report.id)}
                        disabled={processingId === report.id || report.status === "approved"}
                        className="flex items-center gap-1.5 rounded-lg bg-flood-safe px-4 py-2 text-sm font-semibold text-white hover:bg-green-600 disabled:cursor-not-allowed disabled:opacity-50 transition-colors shadow-sm"
                      >
                        <CheckCircle size={16} />
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => handleReject(report.id)}
                        disabled={processingId === report.id || report.status === "rejected"}
                        className="flex items-center gap-1.5 rounded-lg bg-flood-emergency px-4 py-2 text-sm font-semibold text-white hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-50 transition-colors shadow-sm"
                      >
                        <XCircle size={16} />
                        Reject
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {reports.length === 0 && (
                <tr>
                  <td colSpan="8" className="px-6 py-16 text-center text-ink-secondary">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 mb-2">
                        <FileText size={24} />
                      </div>
                      <p className="text-lg font-medium text-ink-primary">
                        {isLoading ? "Loading reports..." : "No reports found"}
                      </p>
                      {!isLoading && <p>Try changing the status filter.</p>}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </AdminLayout>
  );
}
