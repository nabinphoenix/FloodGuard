import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { getReport, markHelpful } from "../../api/reports";
import LoadingSpinner from "../../components/LoadingSpinner";

export default function ReportDetail() {
  const { reportId } = useParams();
  const [report, setReport] = useState(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isMarking, setIsMarking] = useState(false);

  useEffect(() => {
    async function loadReport() {
      try {
        setReport(await getReport(reportId));
      } catch (err) {
        setError(err.response?.data?.detail || "Could not load report.");
      } finally {
        setIsLoading(false);
      }
    }

    loadReport();
  }, [reportId]);

  async function handleHelpful() {
    setIsMarking(true);
    setError("");

    try {
      setReport(await markHelpful(report.id));
    } catch (err) {
      setError(err.response?.data?.detail || "Please sign in to mark this report helpful.");
    } finally {
      setIsMarking(false);
    }
  }

  if (isLoading) return <LoadingSpinner message="Loading report..." />;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <section className="mx-auto max-w-4xl">
        <Link to="/reports/community" className="text-sm font-semibold text-blue-800 hover:text-blue-950">Back to community reports</Link>

        {error && <div className="mt-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        {!report ? (
          <div className="mt-6 rounded-lg border border-blue-100 bg-white p-8 text-center text-slate-500">Report not found.</div>
        ) : (
          <article className="mt-6 overflow-hidden rounded-lg border border-blue-100 bg-white shadow-sm">
            {report.image_url && <img src={report.image_url} alt={report.district} className="max-h-[460px] w-full object-cover" />}
            <div className="p-6 md:p-8">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <h1 className="text-3xl font-bold text-slate-950">{report.district}</h1>
                  <p className="mt-2 text-sm text-slate-500">
                    Reported by {report.user_name || "Community member"} on {new Date(report.created_at).toLocaleString()}
                  </p>
                </div>
                <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-bold text-blue-800">Severity {report.severity} / 5</span>
              </div>

              <p className="mt-6 whitespace-pre-wrap leading-7 text-slate-700">{report.description}</p>

              <div className="mt-8 flex flex-col gap-3 border-t border-blue-50 pt-5 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-sm font-semibold text-slate-700">{report.helpful_count} people found this helpful</span>
                <button
                  type="button"
                  onClick={handleHelpful}
                  disabled={isMarking}
                  className="rounded-md bg-blue-700 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-blue-300"
                >
                  {isMarking ? "Updating..." : "Mark helpful"}
                </button>
              </div>
            </div>
          </article>
        )}
      </section>
    </main>
  );
}
