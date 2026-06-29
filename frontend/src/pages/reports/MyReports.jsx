import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { getMyReports } from "../../api/reports";
import LoadingSpinner from "../../components/LoadingSpinner";

const statusStyles = {
  pending: "bg-yellow-100 text-yellow-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
};

export default function MyReports() {
  const [reports, setReports] = useState([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadReports() {
      try {
        setReports(await getMyReports());
      } catch (err) {
        setError(err.response?.data?.detail || "Could not load your reports.");
      } finally {
        setIsLoading(false);
      }
    }

    loadReports();
  }, []);

  return (
    <main className="min-h-screen bg-blue-50 px-4 py-10">
      <section className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-blue-950">My Reports</h1>
            <p className="mt-2 text-sm text-blue-700">Track the reports you submitted for review.</p>
          </div>
          <Link to="/reports/submit" className="rounded-md bg-blue-700 px-4 py-3 text-center text-sm font-semibold text-white hover:bg-blue-800">
            Submit report
          </Link>
        </div>

        {error && <div className="mb-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        {isLoading ? (
          <LoadingSpinner message="Loading your reports..." />
        ) : reports.length === 0 ? (
          <div className="rounded-lg border border-blue-100 bg-white p-8 text-center text-blue-800">You have not submitted any reports yet.</div>
        ) : (
          <div className="grid gap-5">
            {reports.map((report) => (
              <article key={report.id} className="grid gap-4 rounded-lg border border-blue-100 bg-white p-5 shadow-sm md:grid-cols-[180px_1fr_auto]">
                {report.image_url ? (
                  <img src={report.image_url} alt={report.district} className="h-36 w-full rounded-md object-cover" />
                ) : (
                  <div className="flex h-36 items-center justify-center rounded-md bg-blue-100 text-sm font-semibold text-blue-700">No photo</div>
                )}
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-lg font-bold text-slate-950">{report.district}</h2>
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${statusStyles[report.status] || statusStyles.pending}`}>
                      {report.status}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-slate-500">{new Date(report.created_at).toLocaleString()}</p>
                  <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-700">{report.description}</p>
                  <p className="mt-3 text-sm font-semibold text-blue-800">Severity {report.severity} / 5</p>
                </div>
                <Link to={`/reports/${report.id}`} className="self-start rounded-md border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-50">
                  Details
                </Link>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
