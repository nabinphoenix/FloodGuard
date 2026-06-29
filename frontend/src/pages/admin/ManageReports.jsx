import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { approveReport, getAdminReports, rejectReport } from "../../api/admin";

const statuses = ["pending", "approved", "rejected"];

function statusClass(status) {
  if (status === "approved") return "bg-green-100 text-green-800";
  if (status === "rejected") return "bg-red-100 text-red-800";
  return "bg-yellow-100 text-yellow-800";
}

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
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 md:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-950">Manage Reports</h1>
            <p className="mt-1 text-sm text-slate-600">Review incident reports submitted by public users.</p>
          </div>
          <div className="flex gap-3">
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="rounded-md border border-blue-200 bg-white px-4 py-2 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-200"
            >
              {statuses.map((status) => (
                <option key={status} value={status}>{status[0].toUpperCase() + status.slice(1)}</option>
              ))}
            </select>
            <Link to="/admin" className="rounded-md border border-blue-200 bg-white px-4 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-50">
              Dashboard
            </Link>
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        <section className="overflow-hidden rounded-lg border border-blue-100 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-blue-50 text-sm">
              <thead className="bg-blue-50 text-left text-xs uppercase tracking-wide text-blue-900">
                <tr>
                  <th className="px-4 py-3">ID</th>
                  <th className="px-4 py-3">Photo</th>
                  <th className="px-4 py-3">District</th>
                  <th className="px-4 py-3">Severity</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Submitted By</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-blue-50">
                {reports.map((report) => (
                  <tr key={report.id} className="align-middle">
                    <td className="px-4 py-3 font-semibold text-slate-900">#{report.id}</td>
                    <td className="px-4 py-3">
                      {report.image_url ? (
                        <img src={report.image_url} alt={`Report ${report.id}`} className="h-14 w-20 rounded-md object-cover" />
                      ) : (
                        <div className="flex h-14 w-20 items-center justify-center rounded-md bg-blue-50 text-xs text-blue-700">No photo</div>
                      )}
                    </td>
                    <td className="px-4 py-3">{report.district}</td>
                    <td className="px-4 py-3 text-blue-800">{"★".repeat(report.severity)}<span className="text-blue-200">{"★".repeat(5 - report.severity)}</span></td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${statusClass(report.status)}`}>
                        {report.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">{report.submitted_by}</td>
                    <td className="px-4 py-3 text-slate-500">{formatDate(report.created_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleApprove(report.id)}
                          disabled={processingId === report.id || report.status === "approved"}
                          className="rounded-md bg-green-600 px-3 py-2 text-xs font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-green-200"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => handleReject(report.id)}
                          disabled={processingId === report.id || report.status === "rejected"}
                          className="rounded-md bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-200"
                        >
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {reports.length === 0 && (
                  <tr>
                    <td colSpan="8" className="px-4 py-10 text-center text-slate-500">
                      {isLoading ? "Loading reports..." : "No reports found for this filter."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
