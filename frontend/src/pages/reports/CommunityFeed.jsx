import { useEffect, useMemo, useState } from "react";

import { getCommunityReports, markHelpful } from "../../api/reports";

const DISTRICTS = [
  "Kuala Lumpur",
  "Selangor",
  "Johor",
  "Kelantan",
  "Penang",
  "Perak",
  "Kedah",
  "Pahang",
  "Terengganu",
  "Negeri Sembilan",
  "Melaka",
  "Perlis",
  "Sabah",
  "Sarawak",
];

const PAGE_SIZE = 9;

function timeAgo(dateString) {
  const seconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);

  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateString).toLocaleDateString();
}

function SeverityStars({ severity }) {
  return (
    <div className="flex items-center gap-1" aria-label={`Severity ${severity} out of 5`}>
      {[1, 2, 3, 4, 5].map((rating) => (
        <span
          key={rating}
          className={rating <= severity ? "text-blue-700" : "text-blue-200"}
        >
          ★
        </span>
      ))}
    </div>
  );
}

export default function CommunityFeed() {
  const [reports, setReports] = useState([]);
  const [district, setDistrict] = useState("");
  const [severity, setSeverity] = useState("");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const activeFilters = useMemo(
    () => ({ district, severity }),
    [district, severity]
  );

  useEffect(() => {
    setReports([]);
    setPage(1);
    setHasMore(true);
  }, [activeFilters]);

  useEffect(() => {
    let ignore = false;

    async function loadReports() {
      setIsLoading(true);
      setError("");

      try {
        const data = await getCommunityReports({
          page,
          limit: PAGE_SIZE,
          district,
          severity,
        });

        if (!ignore) {
          setReports((current) => (page === 1 ? data : [...current, ...data]));
          setHasMore(data.length === PAGE_SIZE);
        }
      } catch (err) {
        if (!ignore) {
          setError(err.response?.data?.detail || "Could not load community reports.");
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    loadReports();

    return () => {
      ignore = true;
    };
  }, [page, district, severity]);

  async function handleHelpful(reportId) {
    try {
      const updated = await markHelpful(reportId);
      setReports((current) =>
        current.map((report) => (report.id === reportId ? updated : report))
      );
    } catch (err) {
      setError(err.response?.data?.detail || "Please sign in to mark a report helpful.");
    }
  }

  return (
    <main className="min-h-screen bg-blue-50 px-4 py-10">
      <section className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-blue-950">Community Reports</h1>
            <p className="mt-2 text-sm text-blue-700">
              Approved flood incident reports shared by nearby residents.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <select
              value={district}
              onChange={(event) => setDistrict(event.target.value)}
              className="rounded-md border border-blue-200 bg-white px-4 py-3 text-blue-950 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-200"
            >
              <option value="">All districts</option>
              {DISTRICTS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>

            <select
              value={severity}
              onChange={(event) => setSeverity(event.target.value)}
              className="rounded-md border border-blue-200 bg-white px-4 py-3 text-blue-950 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-200"
            >
              <option value="">All severities</option>
              {[1, 2, 3, 4, 5].map((rating) => (
                <option key={rating} value={rating}>
                  Severity {rating}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {reports.length === 0 && !isLoading ? (
          <div className="rounded-lg border border-blue-100 bg-white p-8 text-center text-blue-800">
            No approved reports match your filters yet.
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {reports.map((report) => (
              <article
                key={report.id}
                className="overflow-hidden rounded-lg border border-blue-100 bg-white shadow-lg shadow-blue-100"
              >
                {report.image_url ? (
                  <img
                    src={report.image_url}
                    alt={`Flood report from ${report.district}`}
                    className="h-48 w-full object-cover"
                  />
                ) : (
                  <div className="flex h-48 w-full items-center justify-center bg-blue-100 text-sm font-semibold text-blue-700">
                    No photo provided
                  </div>
                )}

                <div className="p-5">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800">
                      {report.district}
                    </span>
                    <span className="text-xs text-slate-500">{timeAgo(report.created_at)}</span>
                  </div>

                  <SeverityStars severity={report.severity} />

                  <p className="mt-3 line-clamp-3 min-h-[72px] text-sm leading-6 text-slate-700">
                    {report.description}
                  </p>

                  <div className="mt-5 flex items-center justify-between border-t border-blue-50 pt-4">
                    <span className="text-sm text-slate-600">
                      {report.helpful_count} helpful
                    </span>
                    <button
                      type="button"
                      onClick={() => handleHelpful(report.id)}
                      className="rounded-md bg-blue-700 px-3 py-2 text-sm font-semibold text-white transition hover:bg-blue-800"
                    >
                      Helpful
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}

        <div className="mt-8 flex justify-center">
          {hasMore && reports.length > 0 && (
            <button
              type="button"
              onClick={() => setPage((current) => current + 1)}
              disabled={isLoading}
              className="rounded-md border border-blue-300 bg-white px-5 py-3 font-semibold text-blue-800 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? "Loading..." : "Load more"}
            </button>
          )}
        </div>
      </section>
    </main>
  );
}
